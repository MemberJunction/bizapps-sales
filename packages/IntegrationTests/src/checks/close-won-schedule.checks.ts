/**
 * @fileoverview `close-won-schedule` — CS1–CS5. A deal's payment schedule reaches its order at Close Won,
 * and later edits to a won deal's schedule follow it (bc-aidp-next-golive#290).
 *
 * Orders writes the rows (`Orders.ReplacePaymentSchedule`); these checks drive the sales side through the
 * real close operation and the real entity saves, and read the order's rows back from the database.
 *
 *   CS1  four deal rows become four order rows with the same dates and amounts at Close Won
 *   CS2  after Won, a row's new date saved from the grid reaches the order
 *   CS3  after Won, a row edit that leaves the rows out of tie is kept on the deal; the order keeps its
 *        previous schedule and the save says so
 *   CS4  after Won, an edit to an instalment the order has invoiced is refused and the deal row is unchanged
 *   CS5  a deal whose rows do not add up to the order cannot close Won
 *
 * ⚠️ REQUIRES bizapps-orders with `Orders.ReplacePaymentSchedule`.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { CompositeKey, RunView, type BaseEntity } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import { SalesCloseDealOperation, type SalesCloseDealInput, type SalesCloseDealOutput } from '@mj-biz-apps/sales-entities';

import { E_DEAL, E_SCHEDULE, InRolledBackTransaction, ResolveSalesFixture, TxOne, type SalesFixture } from '../fixture.js';
import { SeedDealOnPipeline, type SeededOrderDeal } from './close-won-order.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const ORDERS_SCHEMA = '__mj_BizAppsOrders';
const DATES = ['2026-11-01', '2027-02-01', '2027-05-01', '2027-08-01'];

function requireOrders(): void {
    Assert(OrdersIsInstalled(), 'bizapps-orders is NOT installed on this host, so these checks cannot prove anything.');
}

async function close(ctx: Ctx, input: SalesCloseDealInput): Promise<SalesCloseDealOutput> {
    const result = await new SalesCloseDealOperation().Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesCloseDealOutput;
}

async function exec(ctx: Ctx, sql: string): Promise<void> {
    const provider = ctx.Provider as unknown as {
        ExecuteSQL: (sql: string, params: Record<string, unknown>, options: { isMutation: boolean; description: string }, user: unknown) => Promise<unknown>;
    };
    await provider.ExecuteSQL(sql, {}, { isMutation: true, description: 'close-won-schedule setup' }, ctx.User);
}

/** The order's schedule as stored, `n:date:amount:status` per row in instalment order. */
async function orderSchedule(ctx: Ctx, orderID: string): Promise<string> {
    const r = await new RunView().RunView<{ InstallmentNumber: number; DueDate: string; Amount: number; Status: string }>(
        {
            EntityName: 'MJ_BizApps_Orders: Order Header Payment Schedules',
            ExtraFilter: `OrderHeaderID = '${orderID}'`,
            OrderBy: 'InstallmentNumber',
            Fields: ['InstallmentNumber', 'DueDate', 'Amount', 'Status'],
            ResultType: 'simple',
            BypassCache: true,
        },
        ctx.User,
    );
    Assert(r.Success, `reading the order's schedule failed — ${r.ErrorMessage}`);
    return (r.Results ?? [])
        .map((row) => `${row.InstallmentNumber}:${new Date(row.DueDate).toISOString().slice(0, 10)}:${Number(row.Amount).toFixed(2)}:${row.Status}`)
        .join(' | ');
}

/** Four amounts that tie to the order's total: 1.00 three times and the rest on the last row. */
function fourAmounts(gross: number): number[] {
    return [1, 1, 1, Math.round((gross - 3) * 100) / 100]; // money-grep-allow: a test fixture splits the order's own total so the rows tie; no price is derived.
}

/** A deal on the order-only pipeline, one line, with a four-row schedule tying to its order. */
async function seedWithSchedule(ctx: Ctx, f: SalesFixture, tie = true): Promise<SeededOrderDeal & { Gross: number; Amounts: number[] }> {
    const seeded = await SeedDealOnPipeline(ctx, f, {
        PipelineID: f.OrderOnlyPolicyPipelineID,
        StageID: f.OrderOnlyPolicyStageID,
        CompanyID: f.OrderOnlyPolicyCompanyID,
        LineCount: 1,
    });
    const { TotalGross } = await TxOne<{ TotalGross: number }>(ctx, `SELECT TotalGross FROM ${ORDERS_SCHEMA}.OrderHeader WHERE ID = '${seeded.OrderID}'`);
    const gross = Number(TotalGross);
    Assert(gross > 3, `setup: the seeded order needs a total above 3.00 to split, got ${gross}`);
    const amounts = fourAmounts(gross);
    if (!tie) amounts[3] = Math.round((amounts[3] - 0.01) * 100) / 100; // money-grep-allow: a deliberate one-cent shortfall for CS5.

    const deal = await loadDeal(ctx, seeded.DealID);
    await deal.PaymentSchedule.Load();
    for (let i = 0; i < 4; i++) {
        const row = await deal.PaymentSchedule.Create();
        row.PaymentDate = new Date(`${DATES[i]}T00:00:00Z`);
        row.Amount = amounts[i];
    }
    Assert(await deal.Save(), `setup: the schedule could not be saved — ${deal.LatestResult?.CompleteMessage ?? ''}`);
    return { ...seeded, Gross: gross, Amounts: amounts };
}

type DealWithSchedule = BaseEntity & {
    PaymentSchedule: {
        Load(): Promise<unknown>;
        Create(): Promise<{ PaymentDate: Date | null; Amount: number | null }>;
    };
};

async function loadDeal(ctx: Ctx, dealID: string): Promise<DealWithSchedule> {
    const deal = (await ctx.Provider.GetEntityObject(E_DEAL, ctx.User)) as unknown as DealWithSchedule;
    const key = new CompositeKey();
    key.KeyValuePairs.push({ FieldName: 'ID', Value: dealID });
    Assert(await deal.InnerLoad(key), `deal ${dealID} could not be loaded`);
    return deal;
}

/** One deal schedule row, loaded on its own the way the Explorer grid saves it. */
async function dealRow(ctx: Ctx, dealID: string, date: string): Promise<BaseEntity> {
    const { ID } = await TxOne<{ ID: string }>(
        ctx,
        `SELECT ID FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID = '${dealID}' AND PaymentDate = '${date}'`,
    );
    const row = (await ctx.Provider.GetEntityObject(E_SCHEDULE, ctx.User)) as BaseEntity;
    const key = new CompositeKey();
    key.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
    Assert(await row.InnerLoad(key), `schedule row ${ID} could not be loaded`);
    return row;
}

const expected = (amounts: number[], dates = DATES, status = 'Scheduled') =>
    amounts.map((a, i) => `${i + 1}:${dates[i]}:${a.toFixed(2)}:${status}`).join(' | ');

export const CloseWonScheduleChecks: NamedCheck[] = [
    {
        Id: 'close-won-schedule.CS1',
        Name: "CS1: four deal rows become the order's four instalments at Close Won",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedWithSchedule(ctx, f);
                AssertEqual(await orderSchedule(ctx, seeded.OrderID), '', 'nothing reaches the order before Won');

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close should succeed — ${JSON.stringify(out.Issues).slice(0, 400)}`);
                AssertEqual(await orderSchedule(ctx, seeded.OrderID), expected(seeded.Amounts), 'one order row per deal row, same date and amount');
            }),
    },
    {
        Id: 'close-won-schedule.CS2',
        Name: "CS2: after Won, a row's new date saved from the grid reaches the order",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedWithSchedule(ctx, f);
                Assert((await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID })).Success, 'setup: close Won');

                const row = await dealRow(ctx, seeded.DealID, DATES[1]);
                row.Set('PaymentDate', new Date('2027-03-15T00:00:00Z'));
                Assert(await row.Save(), `the edit must save: ${row.LatestResult?.CompleteMessage ?? ''}`);
                AssertEqual(
                    await orderSchedule(ctx, seeded.OrderID),
                    expected(seeded.Amounts, [DATES[0], '2027-03-15', DATES[2], DATES[3]]),
                    "the order's instalment 2 moved with the deal row",
                );
            }),
    },
    {
        Id: 'close-won-schedule.CS3',
        Name: 'CS3: after Won, an edit that breaks the tie stays on the deal and the order keeps its schedule',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedWithSchedule(ctx, f);
                Assert((await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID })).Success, 'setup: close Won');

                const row = await dealRow(ctx, seeded.DealID, DATES[0]);
                row.Set('Amount', 2);
                Assert(await row.Save(), `a mid-edit row is kept: ${row.LatestResult?.CompleteMessage ?? ''}`);
                Assert(/previous schedule/.test(String(row.LatestResult?.Message ?? '')), `the save says the order did not change: ${row.LatestResult?.Message}`);
                AssertEqual(await orderSchedule(ctx, seeded.OrderID), expected(seeded.Amounts), 'the order keeps the schedule that ties');
            }),
    },
    {
        Id: 'close-won-schedule.CS4',
        Name: 'CS4: after Won, an edit to an instalment the order has invoiced is refused',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedWithSchedule(ctx, f);
                Assert((await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID })).Success, 'setup: close Won');

                // Sales never confirms or invoices, so the order is moved there directly; orders' own
                // checks (schedule-replace RP4/RP5) drive the real path.
                await exec(ctx, `UPDATE ${ORDERS_SCHEMA}.OrderHeader SET Status = 'Confirmed', ConfirmedAt = SYSDATETIMEOFFSET() WHERE ID = '${seeded.OrderID}'`);
                await exec(
                    ctx,
                    `UPDATE ${ORDERS_SCHEMA}.OrderHeaderPaymentSchedule
                        SET Status = 'Invoiced', DocumentNumber = CONCAT('CS4-', CONVERT(varchar(36), NEWID())), InvoicedAt = SYSDATETIMEOFFSET()
                      WHERE OrderHeaderID = '${seeded.OrderID}' AND InstallmentNumber = 1`,
                );
                const before = await orderSchedule(ctx, seeded.OrderID);

                const row = await dealRow(ctx, seeded.DealID, DATES[0]);
                row.Set('PaymentDate', new Date('2026-11-15T00:00:00Z'));
                Assert(!(await row.Save()), 'an edit to an invoiced instalment must be refused');
                Assert(/Instalment 1/.test(row.LatestResult?.CompleteMessage ?? ''), `the refusal names it: ${row.LatestResult?.CompleteMessage}`);
                const { PaymentDate } = await TxOne<{ PaymentDate: string }>(
                    ctx,
                    `SELECT CONVERT(varchar(10), PaymentDate, 23) AS PaymentDate FROM __mj_BizAppsSales.DealPaymentSchedule WHERE ID = '${row.Get('ID')}'`,
                );
                AssertEqual(PaymentDate, DATES[0], 'the deal row is unchanged');
                AssertEqual(await orderSchedule(ctx, seeded.OrderID), before, 'and so is the order');
            }),
    },
    {
        Id: 'close-won-schedule.CS5',
        Name: 'CS5: a deal whose rows do not add up to the order cannot close Won',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedWithSchedule(ctx, f, false);
                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(!out.Success, 'the close must be refused');
                Assert(/does not tie|unscheduled/.test(JSON.stringify(out.Issues)), `the refusal says why: ${JSON.stringify(out.Issues).slice(0, 400)}`);
                AssertEqual(await orderSchedule(ctx, seeded.OrderID), '', 'nothing reached the order');
            }),
    },
];

for (const check of CloseWonScheduleChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-schedule', {
    Setup: async () => {
        /* every check seeds and rolls back its own deal */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
