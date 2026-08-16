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
 * ⚠️ **REQUIRES bizapps-orders.** These checks are meaningless without it and are held out of the
 * default gate for the same reason `product-picker` is — see `test-harnesses/integration.mjs`.
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
import { SeedDealWithLines } from './close-won-handoff.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/**
 * Skips the body when orders is absent, rather than failing.
 *
 * Deliberately NOT a silent pass: it asserts loudly the moment orders IS installed, so the bundle
 * cannot rot into a no-op on the very host it was written for.
 */
async function requireOrders(): Promise<boolean> {
    return OrdersIsInstalled();
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

export const CloseWonHandoffChecks: NamedCheck[] = [
    {
        Id: 'close-won-handoff.CW1',
        Name: 'CW1: closing a won deal CREATES a booked order, and its number is minted by orders',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                if (!(await requireOrders())) return;
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
                if (!(await requireOrders())) return;
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
                if (!(await requireOrders())) return;
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
                if (!(await requireOrders())) return;
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
