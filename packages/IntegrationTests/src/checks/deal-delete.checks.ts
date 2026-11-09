/**
 * Deleting a deal, against a live database (golive#429).
 *
 * `DealDelete.test.ts` pins the rules with a mocked provider. These checks prove the parts a mock
 * cannot: that the shipped roles, authorizations and entity permissions actually let a Sales User or
 * Sales Admin through MemberJunction's own delete permission check, that the child rows and the order
 * really go in one transaction, and that a refusal leaves every row in place.
 *
 * WHO IS DELETING. Each check acts as a copy of the context user whose roles are replaced by `UI` plus
 * the Sales role under test, and whose Employee is set to the deal's owner (or to someone else). That
 * is the shape of a real account director: read access from `UI`, delete from the Sales role, and no
 * `Developer` grant to hide a missing permission. The Sales roles hold no delete on orders' entities;
 * the deal's order is deleted as the system user, so DD1 and DD3 prove that path and DD8 that the
 * roles cannot delete order rows on their own. The metadata under `metadata/roles`,
 * `metadata/authorizations`, `metadata/authorization-roles` and `metadata/entity-permissions` must be
 * pushed first; DD0 says so if it is not.
 */
import { Metadata, type UserInfo } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import {
    SalesCloseDealOperation,
    SalesReopenDealOperation,
    type DealEntity,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
} from '@mj-biz-apps/sales-core-entities-server';

import {
    E_DEAL,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const ORDERS_SCHEMA = '__mj_BizAppsOrders';

/** Orders' header and the ten entities a draft order's delete removes. */
const ORDER_ENTITIES = [
    'Order Headers',
    'Order Lines',
    'Order Line Price Components',
    'Order Line Dimensions',
    'Order Concessions',
    'Order Adjustments',
    'Order Adjustment Allocations',
    'Order Charges',
    'Order Charge Allocations',
    'Order Checkout Answers',
    'Order Header Payment Schedules',
].map((n) => `MJ_BizApps_Orders: ${n}`);
const SOMEONE_ELSE = '00000000-0000-4000-8000-00000000d429';

/** A copy of the context user holding `UI` plus `salesRole` (or nothing else), with the given Employee. */
function actingAs(ctx: Ctx, salesRole: 'Sales User' | 'Sales Admin' | null, employeeID: string | null): UserInfo {
    const roles = ProviderOf(ctx).Roles;
    const pick = (name: string) => {
        const role = roles.find((r) => r.Name === name);
        Assert(!!role, `role "${name}" is not in this host's metadata — push metadata/ first`);
        return { UserID: ctx.User.ID, RoleID: role!.ID, Role: role!.Name };
    };
    const userRoles = [pick('UI'), ...(salesRole ? [pick(salesRole)] : [])];
    const copy = Object.create(Object.getPrototypeOf(ctx.User)) as UserInfo;
    Object.assign(copy, ctx.User);
    Object.defineProperty(copy, 'UserRoles', { value: userRoles, writable: true });
    Object.defineProperty(copy, 'EmployeeID', { value: employeeID, writable: true });
    return copy;
}

/** A saved open deal, built through the real save path so it carries an order and an owner. */
async function openDeal(ctx: Ctx, f: SalesFixture, name: string): Promise<{ ID: string; OwnerEmployeeID: string; OrderID: string | null }> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = name;
    deal.PipelineID = f.PipelineID;
    deal.PipelineStageID = f.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = f.CompanyID;
    const row = await deal.Team.Create();
    row.EmployeeID = f.EmployeeID;
    row.DealRoleID = (await TxOne<{ ID: string }>(ctx, `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealRole WHERE IsOwnerRole = 1`)).ID;
    const schedule = await deal.PaymentSchedule.Create();
    schedule.Amount = 1000;
    schedule.Description = 'On signature';
    Assert(await deal.Save(), `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    Assert(!!deal.OwnerEmployeeID, 'setup: the saved deal has no owner stamp');
    return { ID: deal.ID, OwnerEmployeeID: deal.OwnerEmployeeID!, OrderID: deal.OrderID ?? null };
}

/** Load the deal as `user` and delete it. Returns the outcome and the reason on a refusal. */
async function deleteAs(ctx: Ctx, user: UserInfo, dealID: string): Promise<{ Deleted: boolean; Message: string }> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, user);
    Assert(await deal.Load(dealID), `setup: the deal could not be loaded as the acting user`);
    const deleted = await deal.Delete();
    return { Deleted: deleted, Message: deal.LatestResult?.Message ?? '' };
}

/** What is left of a deal: the row, its four child tables and its order. */
async function remains(ctx: Ctx, dealID: string, orderID: string | null): Promise<Record<string, number>> {
    const order = orderID ? `(SELECT COUNT(*) FROM ${ORDERS_SCHEMA}.OrderHeader WHERE ID = '${orderID}')` : '0';
    const row = await TxOne<Record<string, number>>(ctx, `
        SELECT
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}') AS Deal,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.DealTeamMember WHERE DealID = '${dealID}') AS Team,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.DealPaymentSchedule WHERE DealID = '${dealID}') AS Schedule,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.DealContactRole WHERE DealID = '${dealID}') AS Contacts,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.DealStageEvent WHERE DealID = '${dealID}') AS StageEvents,
            ${order} AS OrderHeader`);
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
}

async function closeLost(ctx: Ctx, f: SalesFixture, dealID: string): Promise<void> {
    const input: SalesCloseDealInput = { DealID: dealID, DealStatusTypeID: f.LostStatusID, LossReasonID: f.LossReasonPlainID };
    const result = await new SalesCloseDealOperation().Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output?.Success, `setup: the lost close failed — ${JSON.stringify(output?.Issues ?? result).slice(0, 300)}`);
}

async function reopen(ctx: Ctx, dealID: string): Promise<void> {
    const result = await new SalesReopenDealOperation().Execute({ DealID: dealID, Reason: 'DD: reopening to test delete.' }, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: { Success: boolean; Issues: unknown } })?.Output;
    Assert(!!output?.Success, `setup: the reopen failed — ${JSON.stringify(output?.Issues ?? result).slice(0, 300)}`);
}

function assertAllGone(left: Record<string, number>): void {
    for (const [table, n] of Object.entries(left)) AssertEqual(n, 0, `${table} rows remain after the delete`);
}

export const DealDeleteChecks: NamedCheck[] = [
    {
        Id: 'deal-delete.DD1',
        Name: 'DD1: a Sales User deletes an open deal they own, with its team, schedule, stage history and order',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD1 own open deal');
                Assert(!!deal.OrderID, 'setup: the deal has no embedded order, so this would not prove the order goes with it');
                const before = await remains(ctx, deal.ID, deal.OrderID);
                Assert(before.Team > 0 && before.Schedule > 0, `setup: the deal needs child rows to prove they go: ${JSON.stringify(before)}`);

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales User', deal.OwnerEmployeeID), deal.ID);
                Assert(out.Deleted, `the owner's delete was refused: ${out.Message}`);
                assertAllGone(await remains(ctx, deal.ID, deal.OrderID));
            }),
    },
    {
        Id: 'deal-delete.DD2',
        Name: "DD2: a Sales User cannot delete someone else's deal, and nothing is removed",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD2 not mine');
                const before = await remains(ctx, deal.ID, deal.OrderID);

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales User', SOMEONE_ELSE), deal.ID);
                Assert(!out.Deleted, 'a Sales User deleted a deal they do not own');
                Assert(out.Message.includes('only deals you own'), `the refusal does not say why: ${out.Message}`);
                AssertEqual(JSON.stringify(await remains(ctx, deal.ID, deal.OrderID)), JSON.stringify(before), 'a refused delete removed rows');
            }),
    },
    {
        Id: 'deal-delete.DD3',
        Name: "DD3: a Sales Admin deletes someone else's open deal",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD3 admin delete');

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales Admin', SOMEONE_ELSE), deal.ID);
                Assert(out.Deleted, `the Sales Admin's delete was refused: ${out.Message}`);
                assertAllGone(await remains(ctx, deal.ID, deal.OrderID));
            }),
    },
    {
        Id: 'deal-delete.DD4',
        Name: 'DD4: a user with neither Sales role cannot delete a deal',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD4 no role');

                const out = await deleteAs(ctx, actingAs(ctx, null, deal.OwnerEmployeeID), deal.ID);
                Assert(!out.Deleted, 'a user with no Sales role deleted a deal');
                AssertEqual((await remains(ctx, deal.ID, deal.OrderID)).Deal, 1, 'the deal is still there');
            }),
    },
    {
        Id: 'deal-delete.DD5',
        Name: 'DD5: a closed deal cannot be deleted, even by a Sales Admin',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD5 closed');
                await closeLost(ctx, f, deal.ID);

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales Admin', SOMEONE_ELSE), deal.ID);
                Assert(!out.Deleted, 'a closed deal was deleted');
                Assert(out.Message.includes('it is closed'), `the refusal does not say why: ${out.Message}`);
                AssertEqual((await remains(ctx, deal.ID, deal.OrderID)).Deal, 1, 'the deal is still there');
            }),
    },
    {
        Id: 'deal-delete.DD6',
        Name: 'DD6: a deal closed and reopened cannot be deleted',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD6 reopened');
                await closeLost(ctx, f, deal.ID);
                await reopen(ctx, deal.ID);

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales Admin', SOMEONE_ELSE), deal.ID);
                Assert(!out.Deleted, 'a reopened deal was deleted');
                Assert(out.Message.includes('closed before and reopened'), `the refusal does not say why: ${out.Message}`);
            }),
    },
    {
        Id: 'deal-delete.DD7',
        Name: 'DD7: a deal whose order is booked cannot be deleted, and nothing is removed',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await openDeal(ctx, f, 'DD7 booked order');
                Assert(!!deal.OrderID, 'setup: the deal has no embedded order');
                // Booking for real needs accounting's journal; only the status matters to this rule.
                await TxOne(ctx, `UPDATE ${ORDERS_SCHEMA}.OrderHeader SET Status = 'Confirmed' WHERE ID = '${deal.OrderID}'; SELECT 1 AS Done`);
                const before = await remains(ctx, deal.ID, deal.OrderID);

                const out = await deleteAs(ctx, actingAs(ctx, 'Sales Admin', SOMEONE_ELSE), deal.ID);
                Assert(!out.Deleted, 'a deal with a booked order was deleted');
                Assert(out.Message.includes('order is Confirmed'), `the refusal does not say why: ${out.Message}`);
                AssertEqual(JSON.stringify(await remains(ctx, deal.ID, deal.OrderID)), JSON.stringify(before), 'a refused delete removed rows');
            }),
    },
    {
        Id: 'deal-delete.DD8',
        Name: 'DD8: neither Sales role may delete order rows directly',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const md = new Metadata();
            for (const role of ['Sales User', 'Sales Admin'] as const) {
                const user = actingAs(ctx, role, SOMEONE_ELSE);
                for (const name of ORDER_ENTITIES) {
                    const entity = md.EntityByName(name);
                    Assert(!!entity, `entity "${name}" is not in this host's metadata`);
                    Assert(
                        !entity!.GetUserPermisions(user).CanDelete,
                        `${role} may delete ${name} directly, which reaches rows of a booked order`,
                    );
                }
            }
        },
    },
];

for (const check of DealDeleteChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('deal-delete', {
    Setup: async () => {
        // Nothing to create: each check builds its own deal inside its transaction.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadDealDeleteChecks(): void {
    void Metadata;
}
