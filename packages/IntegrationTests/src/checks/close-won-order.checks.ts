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
import { OrdersIsInstalled, type DealEntityServer } from '@mj-biz-apps/sales-core-entities-server';
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

const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/**
 * Sets a stage's `OrderStatusOnEntry` for the duration of THIS CHECK ONLY.
 *
 * Written through the entity layer inside the check's open transaction, so it rolls back with
 * everything else and the seeded pipelines are never permanently altered. That is what lets these
 * checks assert the MECHANISM rather than the seed: whatever Andrew finally decides Closed Won should
 * carry, the mechanism is the same and these still pass.
 */
async function setStageOrderStatus(ctx: Ctx, stageID: string, status: string | null): Promise<void> {
    const stage = (await ctx.Provider.GetEntityObject(E_STAGE, ctx.User)) as BaseEntity;
    const key = new CompositeKey();
    key.KeyValuePairs.push({ FieldName: 'ID', Value: stageID });
    Assert(await stage.InnerLoad(key), `stage ${stageID} could not be loaded`);
    stage.Set('OrderStatusOnEntry', status);
    Assert(await stage.Save(), `the stage could not be updated: ${stage.LatestResult?.CompleteMessage ?? ''}`);
}

/** Another active stage on the same pipeline — the one the deal will MOVE to. */
async function otherStageOn(ctx: Ctx, pipelineID: string, notThis: string): Promise<string> {
    const r = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: E_STAGE,
            ExtraFilter: `PipelineID = '${pipelineID}' AND IsActive = 1 AND ID <> '${notThis}'`,
            OrderBy: 'DisplayOrder ASC',
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the pipeline's stages failed — ${r.ErrorMessage}`);
    const id = (r.Results ?? [])[0]?.ID;
    Assert(!!id, `the pipeline needs a second active stage to move to; only ${notThis} exists`);
    return id as string;
}

/** Moves a deal to a stage through the WRITE PATH — the same call the board's drag makes. */
async function moveToStage(ctx: Ctx, dealID: string, stageID: string): Promise<DealEntityServer> {
    const deal = (await ctx.Provider.GetEntityObject(E_DEAL, ctx.User)) as unknown as DealEntityServer;
    const key = new CompositeKey();
    key.KeyValuePairs.push({ FieldName: 'ID', Value: dealID });
    Assert(await deal.InnerLoad(key), `deal ${dealID} could not be loaded`);
    deal.PipelineStageID = stageID;
    Assert(
        await deal.Save(),
        `the stage change must succeed: ${deal.LatestResult?.CompleteMessage ?? 'refused with no message'}`,
    );
    return deal;
}

/** Puts an order into a given status directly, so a check can set up a refusal. */
async function forceOrderStatus(ctx: Ctx, orderID: string, status: string): Promise<void> {
    const order = (await ctx.Provider.GetEntityObject(E_ORDER_HEADER, ctx.User)) as BaseEntity;
    const key = new CompositeKey();
    key.KeyValuePairs.push({ FieldName: 'ID', Value: orderID });
    Assert(await order.InnerLoad(key), `order ${orderID} could not be loaded`);
    order.Set('Status', status);
    Assert(await order.Save(), `the order could not be moved to ${status}: ${order.LatestResult?.CompleteMessage ?? ''}`);
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
        Name: 'CO3: the order follows the STAGE — OrderStatusOnEntry is what moves it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * REFRAMED ONTO THE MECHANISM, and the reason matters more than the rewrite.
                 *
                 * This check used to assert "a won close leaves the order STATUS untouched" — read the
                 * status before, read it after, demand they match. That was true of the code, and it was
                 * true of only ONE reading of what S-US5 asks for. The moment a stage says what the order
                 * should become (D-OS1), "untouched" stops being the requirement and starts being an
                 * accident of which stage the fixture happened to seed.
                 *
                 * So it asserts the mechanism instead: a stage names a status, a deal enters that stage
                 * through the WRITE PATH, and the order arrives at that status. The stage's value is set
                 * inside this check's own transaction, so the answer does not depend on the seed — and
                 * whichever status Andrew finally puts on Closed Won (DECISIONS-NEEDED DN-10), this check
                 * keeps measuring the thing that has to work.
                 *
                 * `moveToStage` is a plain `deal.Save()`, deliberately: the writer lives on the write path
                 * precisely because a stage change arrives from the board's drag, an importer or an agent,
                 * and never only from the close operation.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 2);

                const before = String((await orderRow(ctx, seeded.OrderID)).Status ?? '');
                Assert(before.length > 0, 'the seeded order has no status to move from');
                Assert(before !== 'Quoted', `this check needs to MOVE the status; it is already ${before}`);

                const target = await otherStageOn(ctx, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID);
                await setStageOrderStatus(ctx, target, 'Quoted');

                const deal = await moveToStage(ctx, seeded.DealID, target);
                AssertEqual(deal.OrderStatusWarnings.length, 0, `a legal move must warn about nothing: ${deal.OrderStatusWarnings.join(' | ')}`);

                AssertEqual(
                    String((await orderRow(ctx, seeded.OrderID)).Status ?? ''),
                    'Quoted',
                    'the order took the status the stage named — asserted from the DATABASE, not from the entity',
                );

                /**
                 * AND A STAGE THAT SAYS NOTHING CHANGES NOTHING. This is the other half of the rule and
                 * the one a naive implementation gets wrong: NULL must mean "this stage has no opinion",
                 * not "set it back to Draft".
                 */
                const quiet = await otherStageOn(ctx, f.OrderOnlyPolicyPipelineID, target);
                await setStageOrderStatus(ctx, quiet, null);
                await moveToStage(ctx, seeded.DealID, quiet);
                AssertEqual(
                    String((await orderRow(ctx, seeded.OrderID)).Status ?? ''),
                    'Quoted',
                    'a stage with no OrderStatusOnEntry leaves the order exactly where it was',
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
        Name: 'CO5: a REFUSED order status never blocks the stage change — and the order stays editable',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * D-OS1's THIRD RULE, which is the one with teeth: *"The Deal stage is the salesperson's
                 * record of the sales process; it should never be held hostage by order-side rules."*
                 *
                 * The refusal is not hypothetical and not an edge case — S-US8 GUARANTEES it. A lost deal
                 * voids its order, `Voided` is terminal in orders, and reopening moves the deal into a
                 * stage asking for `Quoted`. Orders says no. The deal must reopen anyway.
                 *
                 * Set up here with the same shape and without needing the loss path: put the order at
                 * `Voided`, point the target stage at `Quoted`, and move. Three things must all hold —
                 * the stage change LANDED, the order did NOT move, and something SAID SO. A version
                 * missing the third would pass while the rep silently lost half of what they asked for.
                 *
                 * This check also carries what it used to assert on its own — that the deal's close lock
                 * stops at the deal — because the order is edited directly at the end, after the deal has
                 * been locked by a won close.
                 */
                requireOrders();
                const f = await ResolveSalesFixture(ctx);
                const seeded = await seedOrderOnly(ctx, f, 1);

                await forceOrderStatus(ctx, seeded.OrderID, 'Voided');
                const target = await otherStageOn(ctx, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID);
                await setStageOrderStatus(ctx, target, 'Quoted');

                // The stage change itself must SUCCEED. `moveToStage` asserts that.
                const deal = await moveToStage(ctx, seeded.DealID, target);

                const [row] = await rows(ctx, E_DEAL, `ID = '${seeded.DealID}'`);
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    target.toLowerCase(),
                    'the stage change reached the DATABASE — an in-memory-only move would be the worst outcome',
                );
                AssertEqual(
                    String((await orderRow(ctx, seeded.OrderID)).Status ?? ''),
                    'Voided',
                    'and the order was left exactly as it was, not half-moved',
                );

                const warnings = deal.OrderStatusWarnings;
                AssertEqual(warnings.length, 1, `exactly one warning was expected, got ${JSON.stringify(warnings)}`);
                Assert(
                    warnings[0].includes('Voided'),
                    `the warning must name the status the order stayed in: '${warnings[0]}'`,
                );
                // NOT a search for the word "terminal". The first version of this looked for it and
                // failed: orders says "Voided is final", which is the same fact in different words. A
                // check that guesses another app's phrasing measures the phrasing. So it asserts the
                // SHAPE a useful warning must have — both statuses named, and the outcome stated —
                // which stays true however orders words the reason.
                Assert(
                    warnings[0].includes('Quoted'),
                    `the warning must name the status that was ASKED for: '${warnings[0]}'`,
                );
                Assert(
                    warnings[0].includes('The stage change was kept'),
                    `and must say the stage change survived, or a rep reads it as a failure: '${warnings[0]}'`,
                );
                Assert(
                    warnings[0].length > 'The deal moved stage, but its order stayed Voided: '.length + 20,
                    `and must carry orders' REASON, not just the fact: '${warnings[0]}'`,
                );

                // ── the close lock stops at the DEAL ──────────────────────────────────────────
                const out = await close(ctx, { DealID: seeded.DealID, DealStatusTypeID: seeded.WonStatusID });
                Assert(out.Success, `the close should have succeeded — ${JSON.stringify(out.Issues).slice(0, 300)}`);

                const order = (await ctx.Provider.GetEntityObject(E_ORDER_HEADER, ctx.User)) as BaseEntity;
                const key = new CompositeKey();
                key.KeyValuePairs.push({ FieldName: 'ID', Value: seeded.OrderID });
                Assert(await order.InnerLoad(key), 'the order must still be loadable after the close');
                order.Set('Notes', 'finance reviewed this after the close');
                Assert(
                    await order.Save(),
                    'the order must remain editable after a won close — finance corrects it before ' +
                        `advancing it: ${order.LatestResult?.CompleteMessage ?? 'refused with no message'}`,
                );
                AssertEqual(
                    String((await orderRow(ctx, seeded.OrderID)).Notes ?? ''),
                    'finance reviewed this after the close',
                    'and the edit actually landed',
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
