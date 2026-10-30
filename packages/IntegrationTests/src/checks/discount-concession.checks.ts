/**
 * @fileoverview `discount-concession` — DC1–DC5. A deal line's raised discount is recorded as orders'
 * Price concession through `Sales.RecordDiscountConcession`, against a live database (golive#340).
 *
 * ── WHY THIS NEEDS A DATABASE ───────────────────────────────────────────────────────────────────
 *
 * The defect was that the concession never reached orders' server subclass: created in the browser, the
 * generated class's required-field validation failed first and the rep saw a refusal with no reason. A
 * unit test can show the operation is called; only a live run shows orders' subclass actually fills the
 * order, the value and the requester, and decides the concession, for a line saved through a deal.
 *
 * DC4 and DC5 raise the same line twice. Orders values the second concession at the line's whole
 * discount and sums every concession on the order that is not rejected, so the first one has to be
 * withdrawn or it is counted twice and the order cannot be confirmed.
 *
 * ── FIXTURE ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Each check builds its own deal with one discounted line, and its own Sales Authority and
 * ConcessionLimit rule, inside a transaction that rolls back. Rules and authorities already on the host
 * are deactivated inside that transaction first, so the outcome depends only on what the check set up.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView, type BaseEntity } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import type { mjBizAppsOrdersOrderLineEntity } from '@mj-biz-apps/orders-entities';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import {
    E_ORDERS_PRODUCT,
    ORDER_CONCESSION_ENTITY,
    ProductFilterFor,
    SalesRecordDiscountConcessionOperation,
    type DealEntity,
    type SalesRecordDiscountConcessionInput,
    type SalesRecordDiscountConcessionOutput,
} from '@mj-biz-apps/sales-entities';

import { E_DEAL, InRolledBackTransaction, ProviderOf, ResolveSalesFixture, businessToday, type SalesFixture } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_SALES_AUTHORITY = 'MJ_BizApps_Orders: Sales Authorities';
const E_SALES_RULE = 'MJ_BizApps_Orders: Sales Rules';
const REASON = 'Matching a competitor quote on renewal';

/** The fallback a refusal with no text produces. A check seeing it means orders' reason was lost again. */
const NO_REASON_FALLBACK = 'gave no reason';

/** One write through the provider, so it lands inside the check's transaction. */
async function txExec(ctx: Ctx, sql: string, description: string): Promise<void> {
    const provider = ctx.Provider as unknown as {
        ExecuteSQL: (
            sql: string,
            params: Record<string, unknown>,
            options: { isMutation: boolean; description: string },
            user: unknown,
        ) => Promise<unknown>;
    };
    await provider.ExecuteSQL(sql, {}, { isMutation: true, description }, ctx.User);
}

/** Leaves only what the check creates in force: no other ConcessionLimit rule, no other authority for this user. */
async function isolateConcessionPolicy(ctx: Ctx): Promise<void> {
    await txExec(
        ctx,
        `UPDATE __mj_BizAppsOrders.SalesRule SET IsActive = 0 WHERE RuleType = 'ConcessionLimit' AND IsActive = 1`,
        'discount-concession: deactivate host ConcessionLimit rules inside the check',
    );
    await txExec(
        ctx,
        `UPDATE __mj_BizAppsOrders.SalesAuthority SET IsActive = 0 WHERE SalesRepUserID = '${ctx.User.ID}' AND IsActive = 1`,
        'discount-concession: deactivate the user\'s own authorities inside the check',
    );
}

async function saveOk(entity: BaseEntity, what: string): Promise<void> {
    Assert(await entity.Save(), `${what} failed: ${entity.LatestResult?.CompleteMessage ?? 'unknown error'}`);
}

async function giveAuthority(ctx: Ctx, maxDiscountPct: number): Promise<void> {
    const authority = await ProviderOf(ctx).GetEntityObject<BaseEntity>(E_SALES_AUTHORITY, ctx.User);
    authority.NewRecord();
    authority.Set('SalesRepUserID', ctx.User.ID);
    authority.Set('MaxDiscountPct', maxDiscountPct);
    authority.Set('IsActive', true);
    await saveOk(authority, 'creating the check\'s Sales Authority');
}

/**
 * A role the calling user does not hold, given inside the check to another active user, so a concession
 * routed to it has someone other than the requester who could approve it.
 */
async function approverRoleTheUserLacks(ctx: Ctx): Promise<string> {
    const rv = new RunView();
    const roles = await rv.RunView<{ ID: string }>(
        {
            EntityName: 'MJ: Roles',
            ExtraFilter: `ID NOT IN (SELECT RoleID FROM __mj.UserRole WHERE UserID = '${ctx.User.ID}')`,
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    const roleID = roles.Success ? roles.Results?.[0]?.ID : undefined;
    Assert(!!roleID, `no role exists that the test user does not hold: ${roles.ErrorMessage ?? ''}`);

    const users = await rv.RunView<{ ID: string }>(
        {
            EntityName: 'MJ: Users',
            ExtraFilter: `IsActive = 1 AND ID <> '${ctx.User.ID}'`,
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    const approverID = users.Success ? users.Results?.[0]?.ID : undefined;
    Assert(!!approverID, `no active user other than the test user exists to approve: ${users.ErrorMessage ?? ''}`);

    const userRole = await ProviderOf(ctx).GetEntityObject<BaseEntity>('MJ: User Roles', ctx.User);
    userRole.NewRecord();
    userRole.Set('UserID', approverID);
    userRole.Set('RoleID', roleID);
    await saveOk(userRole, 'giving the approving role to another user');
    // Orders routes a Pending concession to an approver through the tasks app, which reaches a person
    // record linked to the approver's user. Without one, orders refuses the concession.
    await txExec(
        ctx,
        `INSERT INTO __mj_BizAppsCommon.Person (FirstName, LastName, LinkedUserID, Status) `
            + `SELECT 'Approver', 'Check', '${approverID}', 'Active' `
            + `WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Person WHERE LinkedUserID = '${approverID}' AND Status = 'Active')`,
        'discount-concession: link a person record to the approver inside the check',
    );
    return roleID as string;
}

async function addConcessionRule(ctx: Ctx, approvalRoleID: string): Promise<void> {
    const rule = await ProviderOf(ctx).GetEntityObject<BaseEntity>(E_SALES_RULE, ctx.User);
    rule.NewRecord();
    rule.Set('Name', 'IT discount concession tier');
    rule.Set('RuleType', 'ConcessionLimit');
    rule.Set('Scope', 'Global');
    rule.Set('ApprovalRequiredRoleID', approvalRoleID);
    rule.Set('IsActive', true);
    await saveOk(rule, 'creating the check\'s ConcessionLimit rule');
}

/** A one-time product the picker offers this company, so the line is priced by orders' engine. */
async function sellableProduct(ctx: Ctx, companyID: string): Promise<string> {
    const r = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: `CompanyID = '${companyID.replace(/'/g, "''")}' `
                + `AND (${ProductFilterFor(await businessToday(ctx))}) AND SubscriptionTypeID IS NULL`,
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the catalogue failed — ${r.ErrorMessage}`);
    const id = r.Results?.[0]?.ID;
    Assert(!!id, 'the catalogue offered no one-time product for this company. Seed one — see scripts/dev/seed-orders-catalog.sql.');
    return id as string;
}

/** A deal with one saved line carrying a 10% discount, returned as that line's ID. */
async function discountedLine(ctx: Ctx, f: SalesFixture): Promise<string> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = 'IT discount concession';
    deal.PipelineID = f.PipelineID;
    deal.PipelineStageID = f.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = f.PipelineCompanyID;
    await saveOk(deal, 'the first save of the deal');

    const line = await deal.OrderID_EnsureObject().Lines.Create();
    line.Set('ProductID', await sellableProduct(ctx, f.PipelineCompanyID));
    line.Set('Quantity', 1);
    line.Set('DiscountPct', 0.1);
    await saveOk(deal, 'saving the deal with a discounted line');
    const id = line.Get('ID') as string | null;
    Assert(!!id, 'the discounted line has no ID after the save');
    return id as string;
}

const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/** Raises the saved line's discount, as the editor does when the rep reopens the line. */
async function raiseDiscount(ctx: Ctx, lineID: string, discountPct: number): Promise<void> {
    const line = await ProviderOf(ctx).GetEntityObject<mjBizAppsOrdersOrderLineEntity>(E_ORDER_LINE, ctx.User);
    Assert(await line.Load(lineID), `the line ${lineID} could not be loaded`);
    line.DiscountPct = discountPct;
    await saveOk(line, 'raising the line\'s discount');
}

/** The IDs of every concession recorded on the line. */
async function concessionIDsOnLine(ctx: Ctx, lineID: string): Promise<string[]> {
    const r = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: ORDER_CONCESSION_ENTITY,
            ExtraFilter: `OrderLineID = '${lineID}'`,
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the line's concessions failed: ${r.ErrorMessage ?? ''}`);
    return (r.Results ?? []).map((row) => row.ID);
}

/** Records a concession for the line, raises its discount, records again; returns both outcomes. */
async function recordRaiseRecord(
    ctx: Ctx,
    lineID: string,
): Promise<{ first: SalesRecordDiscountConcessionOutput; second: SalesRecordDiscountConcessionOutput }> {
    const first = await record(ctx, { OrderLineID: lineID, ReasonCategory: 'Retention', Reason: REASON });
    Assert(first.Success, `the first concession was not recorded: ${first.Message}`);
    await raiseDiscount(ctx, lineID, 0.2);
    const second = await record(ctx, { OrderLineID: lineID, ReasonCategory: 'Retention', Reason: REASON });
    Assert(second.Success, `the concession for the raised discount was not recorded: ${second.Message}`);
    return { first, second };
}

function assertOnlyTheSecondRemains(ids: string[], first: SalesRecordDiscountConcessionOutput, second: SalesRecordDiscountConcessionOutput): void {
    Assert(!ids.some((id) => sameID(id, first.ConcessionID)), 'the concession for the earlier discount must be withdrawn');
    AssertEqual(ids.length, 1, `the line must carry exactly one concession; it carries ${ids.length}`);
    Assert(sameID(ids[0], second.ConcessionID), 'the remaining concession must be the one for the raised discount');
}

async function record(ctx: Ctx, input: SalesRecordDiscountConcessionInput): Promise<SalesRecordDiscountConcessionOutput> {
    const result = await new SalesRecordDiscountConcessionOperation().Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesRecordDiscountConcessionOutput })?.Output;
    Assert(!!output, `Sales.RecordDiscountConcession returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesRecordDiscountConcessionOutput;
}

/** The recorded concession, read back by its ID. */
async function concessionRow(ctx: Ctx, id: string): Promise<Record<string, unknown>> {
    const r = await new RunView().RunView<Record<string, unknown>>(
        {
            EntityName: ORDER_CONCESSION_ENTITY,
            ExtraFilter: `ID = '${id}'`,
            ResultType: 'simple',
            Fields: ['ID', 'OrderLineID', 'OrderHeaderID', 'DeliveryForm', 'Reason', 'ReasonCategory', 'ComputedValue', 'RequestedByUserID', 'DecidedByUserID'],
        },
        ctx.User,
    );
    const row = r.Success ? r.Results?.[0] : undefined;
    Assert(!!row, `concession ${id} could not be read back: ${r.ErrorMessage ?? ''}`);
    return row as Record<string, unknown>;
}

function sameID(a: unknown, b: unknown): boolean {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

export const DiscountConcessionChecks: NamedCheck[] = [
    {
        Id: 'discount-concession.DC1',
        Name: 'DC1: a discount inside the rep\'s authority is recorded with its reason and decided on save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                await isolateConcessionPolicy(ctx);
                await giveAuthority(ctx, 0.5);
                const lineID = await discountedLine(ctx, f);

                const out = await record(ctx, { OrderLineID: lineID, ReasonCategory: 'Retention', Reason: REASON });
                Assert(out.Success, `the concession was not recorded: ${out.Message}`);
                AssertEqual(out.AwaitingApproval, false, 'a discount inside the rep\'s authority must not wait for approval');

                const row = await concessionRow(ctx, out.ConcessionID as string);
                Assert(sameID(row.OrderLineID, lineID), 'the concession must name the discounted line');
                Assert(!!row.OrderHeaderID, 'orders must fill the concession\'s order — the field the browser could not');
                Assert(sameID(row.RequestedByUserID, ctx.User.ID), 'the concession must be requested by the calling user');
                Assert(Number(row.ComputedValue) > 0, `orders must value the discount; ComputedValue was ${row.ComputedValue}`);
                AssertEqual(row.Reason, REASON, 'the rep\'s reason must be stored on the concession');
                AssertEqual(row.DeliveryForm, 'Price', 'a discount is a Price concession');
                Assert(!!row.DecidedByUserID, 'a concession inside authority is decided on save');
            }),
    },
    {
        Id: 'discount-concession.DC2',
        Name: 'DC2: a discount outside the rep\'s authority is recorded and waits for the approving role',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                await isolateConcessionPolicy(ctx);
                await giveAuthority(ctx, 0.05);
                await addConcessionRule(ctx, await approverRoleTheUserLacks(ctx));
                const lineID = await discountedLine(ctx, f);

                const out = await record(ctx, { OrderLineID: lineID, ReasonCategory: 'Other', Reason: REASON });
                Assert(out.Success, `the concession was not recorded: ${out.Message}`);
                AssertEqual(out.AwaitingApproval, true, 'a discount above the rep\'s cap must wait for the approving role');

                const row = await concessionRow(ctx, out.ConcessionID as string);
                AssertEqual(row.DecidedByUserID ?? null, null, 'a concession awaiting approval has no decider yet');
                AssertEqual(row.Reason, REASON, 'the rep\'s reason must be stored for the approver');
            }),
    },
    {
        Id: 'discount-concession.DC3',
        Name: 'DC3: when orders refuses the concession, the operation returns orders\' reason',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // No authority and no ConcessionLimit rule: orders refuses, because no one could approve it.
                await isolateConcessionPolicy(ctx);
                const lineID = await discountedLine(ctx, f);

                const out = await record(ctx, { OrderLineID: lineID, ReasonCategory: 'Other', Reason: REASON });
                AssertEqual(out.Success, false, 'with no authority and no approving rule orders must refuse the concession');
                const message = out.Message ?? '';
                Assert(message.trim().length > 0, 'a refusal must say why');
                Assert(!message.includes(NO_REASON_FALLBACK), `the refusal lost orders' reason again: "${message}"`);
                Assert(/authority/i.test(message), `the refusal should be orders' own explanation; got "${message}"`);
            }),
    },
    {
        Id: 'discount-concession.DC4',
        Name: 'DC4: raising a discount approved on the rep\'s authority withdraws that concession and records one for the new discount',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                await isolateConcessionPolicy(ctx);
                await giveAuthority(ctx, 0.5);
                const lineID = await discountedLine(ctx, f);

                const { first, second } = await recordRaiseRecord(ctx, lineID);
                AssertEqual(first.AwaitingApproval, false, 'setup: the first concession must be approved on the rep\'s authority');
                AssertEqual(second.AwaitingApproval, false, 'the raised discount is still inside the rep\'s authority');
                assertOnlyTheSecondRemains(await concessionIDsOnLine(ctx, lineID), first, second);
            }),
    },
    {
        Id: 'discount-concession.DC5',
        Name: 'DC5: raising a discount whose concession is Pending withdraws it and records one for the new discount',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                await isolateConcessionPolicy(ctx);
                await giveAuthority(ctx, 0.05);
                await addConcessionRule(ctx, await approverRoleTheUserLacks(ctx));
                const lineID = await discountedLine(ctx, f);

                const { first, second } = await recordRaiseRecord(ctx, lineID);
                AssertEqual(first.AwaitingApproval, true, 'setup: the first concession must wait for the approving role');
                AssertEqual(second.AwaitingApproval, true, 'the raised discount is still outside the rep\'s authority');
                assertOnlyTheSecondRemains(await concessionIDsOnLine(ctx, lineID), first, second);
            }),
    },
];

for (const check of DiscountConcessionChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('discount-concession', {
    Setup: async () => {
        Assert(
            OrdersIsInstalled(),
            'discount-concession REQUIRES bizapps-orders: the concession is an orders record, valued and decided '
                + 'by orders\' server subclass.',
        );
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back its transaction.
    },
});
