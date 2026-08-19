/**
 * @fileoverview `close-won-handoff` — CW1–CW4. The seam where a won deal becomes a real order.
 *
 * WHAT THIS BUNDLE IS FOR. Everything else about the close flow can pass while the handoff is a
 * fiction: `close-deal` proves the routing PLAN is right, and it does so against a stub that returns
 * `Success: false` by design. These checks prove the other half — that an order actually exists
 * afterwards, that orders' engine priced it, and that the number sales shows is the number orders
 * computed rather than one sales invented.
 *
 * ── WHY IT ASSERTS ON WHAT ORDERS WROTE, NOT ON WHAT SALES SENT ─────────────────────────────────
 *
 * The interesting failures here are all silent. A handoff that drops `ProductID` still creates an
 * order — an empty, unpriceable one. A handoff that saves lines separately still creates an order —
 * one whose number was minted before its lines existed. Neither throws. So every assertion below
 * reads ORDERS' rows back through orders' own entities, and CW4 compares the booked order against an
 * independent `Orders.PriceOrder` preview of the same draft, because two numbers agreeing is evidence
 * and one number existing is not.
 *
 * ⚠️ **REQUIRES bizapps-orders**, and REFUSES loudly without it rather than passing vacuously. These
 * checks are meaningless without orders and are held out of the default gate for the same reason
 * `product-picker` is — see `test-harnesses/integration.mjs`, and `requireOrders` below for why the
 * refusal is an assertion rather than a skip.
 *
 * These four all exercise the CONFIRMED order path. The Draft path — a different route through orders,
 * with no ledger posting — is covered by `close-won-d2c`, which pins the differences explicitly.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import { SalesCloseDealOperation, type SalesCloseDealInput, type SalesCloseDealOutput } from '@mj-biz-apps/sales-entities';
import { LiveOrdersSeam, OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';

import { InRolledBackTransaction, ResolveSalesFixture } from '../fixture.js';
import { SeedDealOnPipeline, SeedDealWithLines } from './close-won-handoff.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/**
 * Refuses the run when orders is absent, instead of quietly passing.
 *
 * ── THIS USED TO BE A SILENT SKIP, AND THAT WAS A BUG ───────────────────────────────────────────
 *
 * Each check opened with a guard that RETURNED when orders was missing, so on a host without orders
 * the bundle reported **"4 passed"** having tested nothing — the same vacuous pass fixed in
 * `close-won-contract.checks.ts` (PR #16), and the exact failure mode `assert-check-count.mjs` exists
 * to catch. A reader would reasonably take that green as "the order handoff works here".
 *
 * There is no per-check skip in this harness — `skipped` is driven solely by `RequiresMutation`
 * filtering — and this bundle is held out of the default gate, so reaching it at all means someone
 * asked for it. The only useful answer on a host without orders is to say so.
 */
function requireOrders(): void {
    Assert(
        OrdersIsInstalled(),
        'bizapps-orders is NOT installed on this host, so these checks cannot prove anything. ' +
            'Run this bundle only against a stack that includes orders — see docs/WORKSPACE-SETUP.md. ' +
            '(Reporting a pass here would be a vacuous one.)',
    );
}

async function close(ctx: Ctx, input: SalesCloseDealInput): Promise<SalesCloseDealOutput> {
    const op = new SalesCloseDealOperation();
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesCloseDealOutput;
}

async function orderLines(ctx: Ctx, orderID: string): Promise<Record<string, unknown>[]> {
    const rv = new RunView();
    const r = await rv.RunView(
        { EntityName: E_ORDER_LINE, ExtraFilter: `OrderHeaderID = '${orderID}'`, ResultType: 'simple' },
        ctx.User,
    );
    Assert(r.Success, `reading order lines failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

async function orderHeader(ctx: Ctx, orderID: string): Promise<Record<string, unknown>> {
    const rv = new RunView();
    const r = await rv.RunView(
        { EntityName: E_ORDER_HEADER, ExtraFilter: `ID = '${orderID}'`, ResultType: 'simple' },
        ctx.User,
    );
    Assert(r.Success && (r.Results ?? []).length === 1, `the order header was not readable — ${r.ErrorMessage}`);
    return (r.Results ?? [])[0] as Record<string, unknown>;
}

/**
 * The booked total, from orders' own column.
 *
 * `TotalGross`, to match `PriceOrderOutput.Totals.Gross` — comparing gross to net would fail for a
 * reason that has nothing to do with the handoff and everything to do with picking the wrong field.
 */
function bookedTotal(header: Record<string, unknown>): number | null {
    const v = header['TotalGross'];
    return typeof v === 'number' ? v : null;
}

/** The persisted deal row, so a check reads what the database holds rather than the entity in hand. */
async function dealRow(ctx: Ctx, dealID: string): Promise<Record<string, unknown>> {
    const r = await new RunView().RunView(
        { EntityName: 'MJ_BizApps_Sales: Deals', ExtraFilter: `ID = '${dealID}'`, ResultType: 'simple' },
        ctx.User,
    );
    Assert(r.Success && (r.Results ?? []).length === 1, `the deal was not readable — ${r.ErrorMessage}`);
    return (r.Results ?? [])[0] as Record<string, unknown>;
}

export const CloseWonHandoffChecks: NamedCheck[] = [
    {
        Id: 'close-won-handoff.CW1',
        Name: 'CW1: closing a won deal CREATES a booked order, and its number is minted by orders',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealWithLines(ctx, f);

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues).slice(0, 400)}`);

                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(!!order, 'the close produced no Order routing result at all');
                Assert(
                    order?.Executed === true,
                    `the order was planned but NOT created — ${order?.Reason ?? 'no reason given'}`,
                );
                Assert(!!order?.RecordID, 'the routing reported success without an order ID');

                const header = await orderHeader(ctx, String(order?.RecordID));
                // The order NUMBER is orders' to mint. Sales supplying one would be sales owning
                // orders' sequence, which is exactly the kind of quiet ownership creep this checks for.
                Assert(
                    !!header['OrderNumber'],
                    'the order exists but has no OrderNumber — orders\' entity server did not run',
                );
            }),
    },
    {
        Id: 'close-won-handoff.CW2',
        Name: 'CW2: the order lines carry the PICKER-SET ProductIDs, one line per one-time deal line',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealWithLines(ctx, f);

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(order?.Executed === true, `no order was created — ${order?.Reason ?? 'unknown'}`);

                const lines = await orderLines(ctx, String(order?.RecordID));
                AssertEqual(
                    lines.length,
                    seeded.ExpectedOrderProductIDs.length,
                    'the order must have exactly one line per ONE-TIME deal line',
                );

                const got = lines.map((l) => String(l['ProductID']).toLowerCase()).sort();
                const want = seeded.ExpectedOrderProductIDs.map((p) => p.toLowerCase()).sort();
                AssertEqual(
                    JSON.stringify(got),
                    JSON.stringify(want),
                    'the order lines must reference the SAME products the picker set on the deal lines',
                );

                for (const l of lines) {
                    Assert(Number(l['Quantity']) > 0, 'every order line must carry the deal line\'s quantity');
                }
            }),
    },
    {
        Id: 'close-won-handoff.CW3',
        Name: 'CW3: orders PRICED the lines and POSTED them to the ledger — sales computed nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealWithLines(ctx, f);

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(order?.Executed === true, `no order was created — ${order?.Reason ?? 'unknown'}`);

                const lines = await orderLines(ctx, String(order?.RecordID));
                /**
                 * SALES SENT NO PRICE. Every line went out with ProductID and Quantity only, so a unit
                 * price existing here can only have come from orders' pricing engine. That is the whole
                 * money-boundary claim, stated as an assertion rather than a comment.
                 */
                for (const l of lines) {
                    const unit = Number(l['UnitPrice'] ?? 0);
                    Assert(
                        unit > 0,
                        `order line ${String(l['ID'])} has no UnitPrice — orders' pricing engine did not run`,
                    );
                }

                /**
                 * BOOKED MEANS POSTED TO THE LEDGER, not "a payment exists".
                 *
                 * An earlier version of this check asserted an initial payment had been raised. That was
                 * wrong about orders, not about the handoff: `OrderEntityServer.createInitialPayment`
                 * returns early unless the ORDER STATES one (`InitialPaymentTypeID` plus a positive
                 * `InitialPaymentAmount`) — a deposit captured at order entry. A won deal carries no such
                 * intent, and sales inventing a tender and an amount to satisfy a test would be sales
                 * making up money, which is the one thing this app must never do.
                 *
                 * What a Confirmed order DOES do is post to accounting. Every line carries the journal
                 * entry it booked through, so that is the assertion: the GL is where "booked" is visible.
                 */
                for (const l of lines) {
                    Assert(
                        !!l['JournalEntryID'],
                        `order line ${String(l['ID'])} booked no journal entry — the order is not on the ledger`,
                    );
                }
            }),
    },
    {
        Id: 'close-won-handoff.CW4',
        Name: 'CW4: the booked order equals an INDEPENDENT PriceOrder preview of the same draft',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealWithLines(ctx, f);

                /**
                 * THE POINT OF THIS CHECK. One number existing proves nothing — it could be a default, a
                 * zero, or something sales made up. Two independently-produced numbers agreeing is
                 * evidence that the quote and the booking are the same computation, which is the
                 * guarantee the app sells.
                 */
                const seam = new LiveOrdersSeam(ctx.User, ctx.Provider);
                const preview = await seam.PreviewOrderMoney({
                    Header: { CompanyID: seeded.CompanyID, OrganizationID: seeded.AccountID },
                    Lines: seeded.ExpectedOrderProductIDs.map((ProductID, i) => ({
                        ProductID,
                        Quantity: seeded.ExpectedOrderQuantities[i],
                    })),
                    Status: 'Draft',
                    OrderType: 'Sale',
                });
                Assert(preview.Success, `Orders.PriceOrder preview failed — ${preview.Message}`);
                Assert(
                    typeof preview.Amount === 'number' && preview.Amount > 0,
                    `the preview returned no amount (${String(preview.Amount)}) — there is nothing to compare`,
                );

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(order?.Executed === true, `no order was created — ${order?.Reason ?? 'unknown'}`);

                const header = await orderHeader(ctx, String(order?.RecordID));
                const booked = bookedTotal(header);
                Assert(booked !== null, `the order header carries no total — fields: ${Object.keys(header).join(', ')}`);
                AssertEqual(
                    Number(booked).toFixed(2),
                    Number(preview.Amount).toFixed(2),
                    'the booked order must equal the preview — the quote and the invoice are the same computation',
                );
            }),
    },
    {
        Id: 'close-won-handoff.CW5',
        Name: 'CW5: a name-only line REFUSES the close up front, and the deal stays open',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * KI-14, PINNED. A one-time line carrying a product NAME with no `ProductID` cannot
                 * become an order line: `buildOrderInput` coerces it to `ProductID: ''`, and an empty
                 * string against orders' `uniqueidentifier` fails INSIDE orders' save — after the close
                 * has already written the status. The deal ended up WON WITH NO ORDER, and the error
                 * surfaced as `No active transaction to commit`, which names nothing useful.
                 *
                 * IT LIVES HERE, NOT IN `close-deal`, because the refusal only fires when orders is
                 * LIVE. Without orders the Order route goes to the stub, which refuses harmlessly —
                 * and refusing the close there would make a lined deal uncloseable on every
                 * standalone host. So this check's precondition is orders being installed, which is
                 * exactly this bundle's precondition.
                 *
                 * The second assertion is the one that matters: the deal must still be OPEN. A close
                 * that cannot finish must not have started.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealOnPipeline(ctx, f, {
                    PipelineID: f.OrderOnlyPolicyPipelineID,
                    StageID: f.OrderOnlyPolicyStageID,
                    CompanyID: f.OrderOnlyPolicyCompanyID,
                    LineCount: 1,
                    NameOnly: true,
                });

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success === false, 'a deal with an unroutable line must NOT close');

                const named = out.Issues.filter((i) => i.Section === 'lines' && i.Field === 'ProductID');
                AssertEqual(named.length, 1, 'exactly one line should have been reported');
                Assert(
                    named[0].Message.includes('has no catalogue product selected'),
                    `the refusal must explain itself — got "${named[0].Message}"`,
                );

                /**
                 * THE DEAL IS UNTOUCHED — the half that was corrupting data. Read back through the
                 * provider so this is the persisted row, not the in-memory entity.
                 */
                const row = await dealRow(ctx, seeded.DealID);
                AssertEqual(
                    String(row['DealStatusTypeID']).toLowerCase(),
                    String(f.OpenStatusID).toLowerCase(),
                    'a refused close must leave the deal OPEN — never Won with no order',
                );

            }),
    },
    {
        Id: 'close-won-handoff.CW6',
        Name: 'CW6: a properly-picked line is NOT caught by that refusal, and still closes',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE CONTROL FOR CW5, and it is why CW5 means anything: a refusal that fired on every
                 * deal would make CW5 pass too.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await SeedDealOnPipeline(ctx, f, {
                    PipelineID: f.OrderOnlyPolicyPipelineID,
                    StageID: f.OrderOnlyPolicyStageID,
                    CompanyID: f.OrderOnlyPolicyCompanyID,
                    LineCount: 1,
                });

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                AssertEqual(
                    out.Issues.filter((i) => i.Section === 'lines' && i.Field === 'ProductID').length,
                    0,
                    'a picked product must never trip the unroutable-line refusal',
                );
                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);
                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(order?.Executed === true, `and the order should exist — ${order?.Reason ?? 'no route'}`);
            }),
    },
];

for (const check of CloseWonHandoffChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-handoff', {
    Setup: async () => {
        /* every check seeds and rolls back its own deal */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
