/**
 * @fileoverview `close-won-order` — CO1–CO5. What closing a deal as Won does, and does NOT do, to the
 * deal's embedded order.
 *
 * ── THIS BUNDLE REPLACES TWO THAT ASSERTED THE OPPOSITE ─────────────────────────────────────────
 *
 * `close-won-handoff` (CW1–CW6) and `close-won-d2c` (D1–D4) pinned **close-won CREATES an order**: it
 * minted a number, carried the deal's lines across, priced them and posted them to the ledger. That
 * behaviour is gone. The order is an embedded record created with the deal (S-US4), and S-US5/S-US6 say a
 * won close leaves it ALONE — unchanged in status and still editable — so finance can review and correct
 * before the Confirm that locks it and triggers invoicing.
 *
 * Retiring those bundles without writing this one would have traded a wrong assertion for NO assertion,
 * on the behaviour finance actually depends on. CO3–CO5 are that inverse, and they are new.
 *
 * CO1 and CO2 are salvaged rather than rewritten: both were pure ROUTING assertions (D2 and D4), true
 * before the rework and true after, and losing them with the bundle would have been careless.
 *
 * ⚠️ **REQUIRES bizapps-orders**, and refuses to run without it rather than passing vacuously — a skipped
 * bundle is visually identical to a passing one, which is the failure `assert-check-count.mjs` exists for.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { CompositeKey, RunView, type BaseEntity } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import { SalesCloseDealOperation, type SalesCloseDealInput, type SalesCloseDealOutput } from '@mj-biz-apps/sales-entities';

import { InRolledBackTransaction, ResolveSalesFixture, type SalesFixture } from '../fixture.js';
import { SeedDealOnPipeline, type SeededOrderDeal } from './close-won-order.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';

/** Refuses the run when orders is absent, instead of quietly passing. */
function requireOrders(): void {
    Assert(
        OrdersIsInstalled(),
        'bizapps-orders is NOT installed on this host, so these checks cannot prove anything. Run this ' +
            'bundle only against a stack that includes orders — see docs/WORKSPACE-SETUP.md. (Reporting a ' +
            'pass here would be a vacuous one.)',
    );
}

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** Runs `Sales.CloseDeal` in-process and unwraps its payload — the envelope is not the answer. */
async function close(ctx: Ctx, input: SalesCloseDealInput): Promise<SalesCloseDealOutput> {
    const op = new SalesCloseDealOperation();
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesCloseDealOutput;
}

/** The order-only motion: the pipeline whose policy does NOT create a contract. */
async function seedOrderOnly(ctx: Ctx, f: SalesFixture, lineCount: number): Promise<SeededOrderDeal> {
    return SeedDealOnPipeline(ctx, f, {
        PipelineID: f.OrderOnlyPolicyPipelineID,
        StageID: f.OrderOnlyPolicyStageID,
        CompanyID: f.OrderOnlyPolicyCompanyID,
        LineCount: lineCount,
    });
}

/** One order header, read back through the entity layer. */
async function orderRow(ctx: Ctx, orderID: string): Promise<Record<string, unknown>> {
    const [row] = await rows(ctx, E_ORDER_HEADER, `ID = '${orderID}'`);
    Assert(!!row, `the order ${orderID} was not readable`);
    return row;
}

export const CloseWonOrderChecks: NamedCheck[] = [
    {
        Id: 'close-won-order.CO1',
        Name: 'CO1: no contract is PLANNED when the policy says not to',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * SALVAGED FROM D2, unchanged in substance. `CreateContract: false` must mean no contract
                 * was even PLANNED. Asserting only that none was CREATED would pass while the operation
                 * planned one and then failed to build it — a routing bug wearing a downstream error as a
                 * disguise. Still exactly true after the rework, which is why it survives.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);
                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });

                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);
                const contract = out.Routing.find((r) => r.Target === 'Contract');
                Assert(
                    !contract,
                    `the policy sets CreateContract:false, yet a Contract route was planned — ${JSON.stringify(contract)}`,
                );
            }),
    },
    {
        Id: 'close-won-order.CO2',
        Name: 'CO2: a header-only deal closes CLEANLY, routing nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * SALVAGED FROM D4. Routing nothing is a SUCCESS: the deal still closes, still locks, still
                 * records its stage event, and there is simply nothing to hand downstream. An
                 * implementation treating "no lines" as an error would break the lineless motion entirely.
                 *
                 * The order COUNT is taken before and after, and that detail is inherited for a reason: the
                 * first version of D4 looked for an order whose Description was the deal ID, but the seam
                 * wrote the deal NAME there — so it could not have matched anything and would have passed
                 * no matter what happened.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 0);
                const before = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `a header-only deal must close — ${JSON.stringify(out.Issues).slice(0, 300)}`);

                const after = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;
                AssertEqual(after, before, 'closing a header-only deal must create no order');
            }),
    },
    {
        Id: 'close-won-order.CO3',
        Name: 'CO3: a won close leaves the order STATUS untouched',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * NEW, AND THE INVERSE OF WHAT CW1–CW3 USED TO PIN.
                 *
                 * Those asserted that closing a deal Won produced a BOOKED order and posted it to the
                 * ledger. S-US5 and S-US6 now say the opposite: Closed Won does not touch the order's
                 * status. It stays as it was — Draft, or Quoted if the deal reached Agreement — so finance
                 * can review and correct before the Confirm that locks it, books the journal entries and
                 * triggers invoicing.
                 *
                 * Read BEFORE and AFTER and compare, rather than asserting a literal 'Draft': the status a
                 * deal arrives with depends on the stage it reached, and hardcoding one would make this
                 * check pass for the wrong reason on a pipeline that quotes. What matters is that the close
                 * changed NOTHING.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);

                const statusBefore = String((await orderRow(ctx, seeded.OrderID)).Status ?? '');
                Assert(statusBefore.length > 0, 'the seeded order has no status to compare against');

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);

                const statusAfter = String((await orderRow(ctx, seeded.OrderID)).Status ?? '');
                AssertEqual(
                    statusAfter,
                    statusBefore,
                    'a won close must leave the order status exactly as it was — finance advances it, not sales',
                );
            }),
    },
    {
        Id: 'close-won-order.CO4',
        Name: 'CO4: a won close creates NO second order',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * NEW. The deal already owns an order, so a close that created another would leave two
                 * orders for one deal — one carrying the lines a rep entered and one empty, with
                 * `Deal.OrderID` pointing at whichever won the race. Nothing in the schema forbids it:
                 * `Deal.OrderID` is a single nullable FK, so the second order would simply be orphaned and
                 * invisible until somebody reconciled revenue.
                 *
                 * Asserted three ways, because a count alone would miss a SWAP: the total is unchanged, the
                 * deal still points at the SAME order, and no route reports having created one.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);
                const before = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);

                const after = (await rows(ctx, E_ORDER_HEADER, '1 = 1')).length;
                AssertEqual(after, before, 'a won close must create no additional order');

                const [deal] = await rows(ctx, 'MJ_BizApps_Sales: Deals', `ID = '${seeded.DealID}'`);
                AssertEqual(
                    String(deal.OrderID).toLowerCase(),
                    seeded.OrderID.toLowerCase(),
                    'and the deal must still point at the order it had before the close',
                );

                const orderRoute = out.Routing.find((r) => r.Target === 'Order');
                Assert(
                    !orderRoute,
                    `close-won must not plan an Order route at all — ${JSON.stringify(orderRoute)}`,
                );
            }),
    },
    {
        Id: 'close-won-order.CO5',
        Name: 'CO5: the order stays EDITABLE after the deal is locked',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * NEW, and the one most likely to break by accident.
                 *
                 * A won close LOCKS the deal — that is L-17, enforced in `DealEntityServer.Save()`, and
                 * CD5/CD13 pin it including its child collections. S-US3 requires the opposite of the
                 * order: finance reviews and CORRECTS it after the close, then advances it. So the lock
                 * must stop at the deal.
                 *
                 * The risk is real rather than theoretical. The order is now reachable THROUGH the locked
                 * deal as an embedded peer, so any future widening of the lock to "the deal and everything
                 * it owns" would silently make finance's job impossible — and it would look like a
                 * correctness improvement while doing it.
                 *
                 * Edits the order DIRECTLY, not through the deal, because that is what finance does.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 1);

                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);

                // Typed as the base: sales must not import orders' entity classes into a check, and everything
                // asserted here is generic entity behaviour -- load, set, save.
                const order = (await ctx.Provider.GetEntityObject(E_ORDER_HEADER, ctx.User)) as BaseEntity;
                // `InnerLoad` with a CompositeKey, not `Load(id)`: the typed `Load` overload lives on the
                // GENERATED subclass, and sales must not import orders' entity classes into a check. This is
                // exactly what that generated overload does internally.
                const key = new CompositeKey();
                key.KeyValuePairs.push({ FieldName: 'ID', Value: seeded.OrderID });
                Assert(await order.InnerLoad(key), 'the order must still be loadable after the close');
                order.Set('Notes', 'finance reviewed this after the close');
                Assert(
                    await order.Save(),
                    'the order must remain editable after a won close — finance corrects it before ' +
                        `advancing it: ${order.LatestResult?.CompleteMessage ?? 'refused with no message'}`,
                );

                const after = await orderRow(ctx, seeded.OrderID);
                AssertEqual(
                    String(after.Notes ?? ''),
                    'finance reviewed this after the close',
                    'and the edit must have persisted',
                );
            }),
    },
];

for (const check of CloseWonOrderChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-order', {
    Setup: async () => {
        /* every check seeds and rolls back its own deal */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
