/**
 * @fileoverview `close-won-d2c` — D1–D4. The OTHER order path: a Draft order on a lineless motion.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────────────────────────
 *
 * Every order-path check we had (CW1–CW4) seeds its deal on the pipeline whose policy says
 * `OrderState: 'Confirmed'`. That is one route through orders. The order-only motion is a genuinely
 * different one:
 *
 *     contract policy   { CreateContract: true,  OneTimeLinesTo: 'Order', OrderState: 'Confirmed' }
 *     order-only policy { CreateContract: false, OneTimeLinesTo: 'Order', OrderState: 'Draft'     }
 *
 * ── WHAT IS ACTUALLY DIFFERENT, MEASURED ────────────────────────────────────────────────────────
 *
 * Established by RUNNING this bundle against a live orders install, not by reading orders' code — and
 * the result contradicted the obvious guess, which is why it is written down here:
 *
 *   · a Draft order IS created, and Sales' routing reports `Executed: true` — a real order, not
 *     "routed nothing";
 *   · it comes back **PRICED**. `UnitPrice` is populated by orders' engine, and `TotalGross` is
 *     computed on the header. Pricing is NOT part of the booking walk. Draft therefore still honours
 *     the money boundary: sales sent no price and got one back;
 *   · it comes back **NUMBERED** — `OrderNumber` is minted on save regardless of state. The natural
 *     assumption is that numbering is part of booking; measurably it is not;
 *   · the ONE thing it does not do is **post to the ledger** — no `JournalEntryID` on any line.
 *
 * So a Draft order is a fully-formed, priced, numbered order that simply has not hit the GL. The only
 * assertion in CW1–CW4 that would genuinely fail here is CW3's `JournalEntryID`; `OrderNumber` and
 * `TotalGross` hold on both routes. Nothing in our seam depends on the difference — `CreateOrder`
 * returns the order ID and never reads a number, a total or a journal entry — which is why this path
 * works, and D1/D3 pin all four properties so a future change in orders cannot alter it silently.
 *
 * ── AND THE LINELESS CASE ───────────────────────────────────────────────────────────────────────
 *
 * The order-only pipeline is seeded with `RequiresDealLines = 0`: these deals normally carry no
 * catalogue lines at all. D4 proves that a header-only won deal closes CLEANLY — routing nothing is a
 * legitimate outcome, not a failure, and must not raise.
 *
 * ⚠️ **REQUIRES bizapps-orders**, and says so loudly rather than passing vacuously. See the header of
 * `close-won-contract.checks.ts` for why a deliberately-invoked bundle must refuse rather than skip.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import { SalesCloseDealOperation, type SalesCloseDealInput, type SalesCloseDealOutput } from '@mj-biz-apps/sales-entities';

import { InRolledBackTransaction, ResolveSalesFixture, type SalesFixture } from '../fixture.js';
import { SeedDealOnPipeline, type SeededHandoffDeal } from './close-won-handoff.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/** Refuses the run when orders is absent, instead of quietly passing. */
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

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** Seeds on the ORDER-ONLY pipeline — chosen by its policy, never by the name "D2C". */
async function seedOrderOnly(ctx: Ctx, f: SalesFixture, lineCount: number): Promise<SeededHandoffDeal> {
    return SeedDealOnPipeline(ctx, f, {
        PipelineID: f.OrderOnlyPolicyPipelineID,
        StageID: f.OrderOnlyPolicyStageID,
        CompanyID: f.OrderOnlyPolicyCompanyID,
        LineCount: lineCount,
    });
}

/** Closes a seeded order-only deal and returns the Order routing result, asserting it executed. */
async function closeAndGetOrder(ctx: Ctx, seeded: SeededHandoffDeal) {
    const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
    Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues).slice(0, 400)}`);
    const order = out.Routing.find((r) => r.Target === 'Order');
    Assert(!!order, 'the close produced no Order routing result at all — the policy routes one-time lines to an Order');
    Assert(
        order?.Executed === true,
        `the order was planned but NOT created — ${order?.Reason ?? 'no reason given'}`,
    );
    Assert(!!order?.RecordID, 'the routing reported success without an order ID');
    return { out, order };
}

export const CloseWonD2CChecks: NamedCheck[] = [
    {
        Id: 'close-won-d2c.D1',
        Name: 'D1: an order-only deal creates a DRAFT order that is real — executed, but unbooked',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);
                const { order } = await closeAndGetOrder(ctx, seeded);

                const [header] = await rows(ctx, E_ORDER_HEADER, `ID = '${String(order?.RecordID)}'`);
                Assert(!!header, 'the order ID does not resolve to a row');

                /**
                 * THE POLICY'S STATE, HONOURED. `Draft` comes from the pipeline's `CloseWonPolicy` and is
                 * stated on the header. If this ever reads `Confirmed`, sales has started booking orders
                 * the policy said to leave as drafts — which on this motion means invoicing a customer
                 * who has not been billed yet.
                 */
                AssertEqual(String(header['Status']), 'Draft', 'the order must land in the state the POLICY stated');

                /**
                 * AND IT IS A FULLY-FORMED ORDER, not a placeholder.
                 *
                 * This is the assertion that was WRONG when first written, and the reason it is worth
                 * having. The natural assumption is that numbering belongs to the booking walk, so a
                 * Draft would be unnumbered. Measurably it is not: orders mints `OrderNumber` on save
                 * regardless of state. Pinned as the observed truth so that if orders ever moves
                 * numbering into booking, this fails and tells us — rather than sales quietly showing a
                 * rep a blank order reference.
                 */
                Assert(
                    !!header['OrderNumber'],
                    'a Draft order is still numbered by orders on save — an empty OrderNumber means ' +
                        'numbering moved into the booking walk, and sales now shows a blank reference',
                );
                Assert(
                    typeof header['TotalGross'] === 'number' && Number(header['TotalGross']) > 0,
                    `a Draft order is priced too — TotalGross is ${String(header['TotalGross'])}, so either ` +
                        `orders stopped pricing drafts or sales sent an unpriceable payload`,
                );
            }),
    },
    {
        Id: 'close-won-d2c.D2',
        Name: 'D2: no contract is created, because the policy says not to',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);
                const { out } = await closeAndGetOrder(ctx, seeded);

                /**
                 * `CreateContract: false` must mean NO contract was even PLANNED. Asserting only that
                 * none was created would pass while the operation planned one and then failed to build
                 * it — a routing bug wearing a downstream error as a disguise.
                 */
                const contract = out.Routing.find((r) => r.Target === 'Contract');
                Assert(
                    !contract,
                    `the policy sets CreateContract:false, yet a Contract route was planned — ` +
                        `${JSON.stringify(contract)}`,
                );

                const [deal] = await rows(ctx, 'MJ_BizApps_Sales: Deals', `ID = '${seeded.DealID}'`);
                Assert(
                    !deal['ContractID'],
                    `the deal was stamped with a ContractID (${String(deal['ContractID'])}) on a motion ` +
                        `whose policy creates no contract`,
                );
            }),
    },
    {
        Id: 'close-won-d2c.D3',
        Name: 'D3: the Draft order carries the picker-set ProductIDs, priced by orders — sales sent no money',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);
                const { order } = await closeAndGetOrder(ctx, seeded);

                const lines = await rows(ctx, E_ORDER_LINE, `OrderHeaderID = '${String(order?.RecordID)}'`);
                AssertEqual(
                    lines.length,
                    seeded.ExpectedOrderProductIDs.length,
                    'the Draft order must have exactly one line per ONE-TIME deal line',
                );

                const got = lines.map((l) => String(l['ProductID']).toLowerCase()).sort();
                const want = seeded.ExpectedOrderProductIDs.map((p) => p.toLowerCase()).sort();
                AssertEqual(
                    JSON.stringify(got),
                    JSON.stringify(want),
                    'the order lines must reference the SAME products the picker set on the deal lines',
                );

                const wantQty = [...seeded.ExpectedOrderQuantities].sort((a, b) => a - b);
                const gotQty = lines.map((l) => Number(l['Quantity'])).sort((a, b) => a - b);
                AssertEqual(
                    JSON.stringify(gotQty),
                    JSON.stringify(wantQty),
                    'each line must carry its deal line\'s quantity, not a default of 1',
                );

                /**
                 * THE MONEY BOUNDARY ON THE DRAFT PATH.
                 *
                 * Sales sent ProductID and Quantity and no price at all, so a unit price existing here
                 * can only have come from orders' engine. Draft DOES price — pricing lives in orders'
                 * line entity server, not in its state walk — so the boundary holds on this route for the
                 * same reason it holds on the Confirmed one, and this is the assertion that proves it
                 * rather than assuming it.
                 */
                for (const l of lines) {
                    Assert(
                        Number(l['UnitPrice'] ?? 0) > 0,
                        `Draft order line ${String(l['ID'])} has no UnitPrice — orders' pricing engine did ` +
                            `not run on the Draft path, so sales would have nothing to show the rep`,
                    );
                }

                /**
                 * AND NOTHING REACHED THE LEDGER. A Draft order is not booked, so it must post no journal
                 * entry — the exact inverse of CW3. If this ever fails, an unbooked order is hitting the
                 * GL and the accounting close is wrong.
                 */
                for (const l of lines) {
                    Assert(
                        !l['JournalEntryID'],
                        `Draft order line ${String(l['ID'])} booked a journal entry — an unbooked order ` +
                            `must never post to the ledger`,
                    );
                }
            }),
    },
    {
        Id: 'close-won-d2c.D4',
        Name: 'D4: a header-only deal on the same motion closes CLEANLY, routing nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                // Zero lines — the normal shape on this pipeline, which is seeded RequiresDealLines = 0.
                const seeded = await seedOrderOnly(ctx, f, 0);

                // Counted BEFORE, so the "nothing was created" claim is measured rather than inferred
                // from a filter that might simply never match. (The first version of this check looked
                // for an order whose Description was the deal ID; the seam writes the deal NAME there,
                // so it could not have matched anything and would have passed no matter what happened.)
                const before = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });

                /**
                 * ROUTING NOTHING IS A SUCCESS. The deal still closes, still locks, still records its
                 * stage event — there is simply nothing to hand downstream. An implementation that
                 * treated "no lines" as an error would break the entire lineless motion, and one that
                 * silently created an EMPTY order would hand orders something unpriceable.
                 */
                Assert(
                    out.Success,
                    `a header-only won deal must close cleanly — ${JSON.stringify(out.Issues).slice(0, 400)}`,
                );

                const order = out.Routing.find((r) => r.Target === 'Order');
                Assert(
                    !order,
                    `no Order should be routed with no lines to put on it, but one was: ${JSON.stringify(order)}`,
                );

                const after = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;
                AssertEqual(
                    after,
                    before,
                    'a lineless close must not leave an EMPTY order behind — orders cannot price a ' +
                        'header with no lines, so creating one would hand orders a record it can do nothing with',
                );
            }),
    },
];

for (const check of CloseWonD2CChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-d2c', {
    Setup: async () => {
        /* every check seeds and rolls back its own deal */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
