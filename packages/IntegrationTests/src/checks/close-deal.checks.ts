/**
 * @fileoverview `close-deal` — CD1–CD12. `Sales.CloseDeal`, `Sales.ReopenDeal` and the close lock
 * against a live database, nothing mocked.
 *
 * WHY THIS BUNDLE EXISTS. Two of these checks are the ones `index.ts` has been carrying as "specified,
 * not yet built" since S1 — CD5 is the §7.3 / L-17 promise that a closed deal is immutable at the
 * ENTITY-SERVER level, proven by a raw `BaseEntity.Save()` that gets refused. Asserting that through the
 * UI would prove nothing: the whole point of the lock is that an Action, an agent and a hand-written
 * save all hit the same wall, and only a direct save can demonstrate it.
 *
 * THE ROUTING CHECKS ARE THE INTERESTING ONES. CD1 and CD2 close the SAME deal shape into the SAME won
 * status down two different pipelines, and get two different routes. Nothing about the deal changed —
 * only the policy did. That is the property the app sells, and it is why the fixture picks its pipelines
 * by parsing `CloseWonPolicy` rather than by the names "B2B" and "D2C" (see `resolvePipelinesByPolicy`).
 * Rename both pipelines and this bundle still passes.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check below is `RequiresMutation`, so without that
 * variable the bundle runs ZERO checks and reports success — the vacuous pass `assert-check-count.mjs`
 * exists to catch. A green run that says "0 checks" is a failure wearing a pass.
 *
 * ── WHAT THESE CHECKS DELIBERATELY DO NOT ASSERT ────────────────────────────────────────────────
 *
 * That a contract or an order actually EXISTS downstream. Neither sibling is reachable from this repo
 * yet, so `StubDownstreamSeam` stands in. CD7 therefore asserts the honest thing — that a stubbed route
 * reports `Executed: false` WITH a reason and leaves no fabricated ID on the deal. When orders links,
 * CD7 is the check that should start failing, and that failure is the signal to write the real one.
 *
 * Each check rolls its transaction back, so the suite is safe to run repeatedly and leaves no rows.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import {
    SalesCloseDealOperation,
    SalesReopenDealOperation,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
    type SalesCloseRoutingResult,
    type SalesReopenDealInput,
    type SalesReopenDealOutput,
    type DealEntity,
    type mjBizAppsSalesDealEntity,
    type mjBizAppsSalesDealLineEntity,
} from '@mj-biz-apps/sales-entities';

import {
    E_DEAL,
    E_DEAL_LINE,
    E_STAGE_EVENT,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/** A line as the fixture builder wants it, before it becomes a real child entity. */
interface SeedLine {
    DealLineTypeID: string;
    ProductName: string;
    Quantity: number;
}

/**
 * Creates a deal to close, on the pipeline the caller names.
 *
 * Every close check needs a saved OPEN deal first, and building it through the REAL SAVE PATH rather
 * than by hand is deliberate: these checks then exercise the same rows a user would produce, including
 * the server-maintained stamps, instead of a hand-assembled shape that happens to satisfy them.
 *
 * That path used to be `Sales.SaveDeal`. The operation was retired when `Deal` gained Related Record
 * Collections, so the same intent is now expressed directly on the entity graph — `deal.Lines.Create()`
 * and one `deal.Save()`, which is exactly what the workspace does.
 */
async function openDeal(
    ctx: Ctx,
    f: SalesFixture,
    pipelineID: string,
    stageID: string,
    name: string,
    lines: SeedLine[] = [],
): Promise<string> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = name;
    deal.PipelineID = pipelineID;
    deal.PipelineStageID = stageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = f.PipelineCompanyID;
    deal.TermMonths = 12;

    for (const seed of lines) {
        const line: mjBizAppsSalesDealLineEntity = await deal.Lines.Create();
        line.DealLineTypeID = seed.DealLineTypeID;
        line.ProductName = seed.ProductName;
        line.Quantity = seed.Quantity;
    }

    Assert(
        await deal.Save(),
        `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
    );
    return deal.ID;
}

/** One recurring line and one one-time line, so the policy has both kinds to route. */
function bothLineKinds(f: SalesFixture): SeedLine[] {
    // No DisplayOrder and no ClientKey: the collection sequences from array position, and identity is
    // the entity's own primary key. Both were payload concerns of the retired operation.
    return [
        { DealLineTypeID: f.RecurringLineTypeID, ProductName: 'Platform — Enterprise Seat', Quantity: 40 },
        { DealLineTypeID: f.OneTimeLineTypeID, ProductName: 'Onboarding', Quantity: 1 },
    ];
}

/** Runs the close the way a resolver does, on the check's own connection. */
async function close(ctx: Ctx, input: SalesCloseDealInput): Promise<SalesCloseDealOutput> {
    const op = new SalesCloseDealOperation();
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesCloseDealOutput;
}

async function reopen(ctx: Ctx, input: SalesReopenDealInput): Promise<SalesReopenDealOutput> {
    const op = new SalesReopenDealOperation();
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesReopenDealOutput })?.Output;
    Assert(!!output, `Sales.ReopenDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesReopenDealOutput;
}

const routeTo = (out: SalesCloseDealOutput, target: string): SalesCloseRoutingResult | undefined =>
    out.Routing.find((r) => r.Target === target);

/** The stage events on a deal, newest last. Append-only, so the count only ever grows. */
async function stageEvents(ctx: Ctx, dealID: string): Promise<Record<string, unknown>[]> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: E_STAGE_EVENT,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'ChangedAt ASC',
            ResultType: 'simple',
            Fields: ['ID', 'ToDealStatusTypeID', 'AmountAtTransition', 'ProbabilityAtTransition', 'Notes'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading stage events failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** The deal's line rows, read through the provider so the check's open transaction is visible. */
async function children(ctx: Ctx, dealID: string): Promise<Record<string, unknown>[]> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: E_DEAL_LINE,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'DisplayOrder ASC',
            ResultType: 'simple',
            Fields: ['ID', 'ProductName', 'Quantity', 'DisplayOrder'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading deal lines failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

export const CloseDealChecks: NamedCheck[] = [
    {
        Id: 'close-deal.CD1',
        Name: 'CD1: a contract-creating POLICY routes to a Contract',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD1 contract policy',
                    bothLineKinds(f),
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });

                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.IsWon, 'the target status carries IsWon, so the close must report it');
                Assert(!!routeTo(out, 'Contract'), 'a policy with CreateContract:true must plan a Contract route');
                AssertEqual(out.EffectivePolicy?.CreateContract, true, 'the effective policy came from the pipeline');
            }),
    },
    {
        Id: 'close-deal.CD2',
        Name: 'CD2: the SAME won status down a non-contract policy routes NO contract — policy decides, not the status',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // Identical deal shape, identical target status. The ONLY difference from CD1 is which
                // pipeline it sits on — so any difference in routing is attributable to the policy alone.
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD2 order-only policy',
                    bothLineKinds(f),
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });

                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.IsWon, 'same won status as CD1');
                Assert(
                    !routeTo(out, 'Contract'),
                    'a policy with CreateContract:false must NOT plan a Contract, even for a won deal — ' +
                        'if this fails, something is branching on the status or the pipeline name',
                );
                Assert(!!routeTo(out, 'Order'), 'this policy sends one-time lines to an Order');
            }),
    },
    {
        Id: 'close-deal.CD3',
        Name: 'CD3: a caller override beats the pipeline default, without touching the pipeline',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD3 override',
                    bothLineKinds(f),
                );

                const out = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.WonStatusID,
                    PolicyOverrides: { CreateContract: false },
                });

                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                AssertEqual(out.EffectivePolicy?.CreateContract, false, 'the override wins over the pipeline default');
                Assert(!routeTo(out, 'Contract'), 'and the routing follows the EFFECTIVE policy, not the stored one');
            }),
    },
    {
        Id: 'close-deal.CD4',
        Name: 'CD4: the close stamps an append-only DealStageEvent with the amount and probability AT transition',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD4 provenance',
                );

                const before = (await stageEvents(ctx, dealID)).length;
                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);

                const after = await stageEvents(ctx, dealID);
                AssertEqual(after.length, before + 1, 'exactly one event was appended');

                const last = after[after.length - 1];
                AssertEqual(
                    String(last.ToDealStatusTypeID).toLowerCase(),
                    f.WonStatusID.toLowerCase(),
                    'the event records the status it moved INTO',
                );
                // Without the stamps, "what did we think this was worth when we closed it" is
                // unanswerable once amounts change. The columns must be PRESENT, not merely nullable.
                Assert('AmountAtTransition' in last, 'the event stamps AmountAtTransition');
                Assert('ProbabilityAtTransition' in last, 'the event stamps ProbabilityAtTransition');
                Assert(
                    typeof last.Notes === 'string' && (last.Notes as string).length > 0,
                    'the routing outcome is recorded in Notes — that is what preserves the INTENT of a ' +
                        'close whose downstream was stubbed',
                );
            }),
    },
    {
        Id: 'close-deal.CD5',
        Name: 'CD5: a closed deal is immutable — a raw BaseEntity.Save() is REFUSED at the entity server',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD5 lock',
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.Locked, 'the won status carries LocksDeal, so the close must report Locked');

                // THE POINT OF THE WHOLE BUNDLE. Not through an operation, not through the UI — a plain
                // entity load and save, exactly what an Action or an agent would do.
                const md = new Metadata();
                const deal = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(dealID), 'the closed deal loads');
                deal.Name = 'CD5 renamed after close';
                const saved = await deal.Save();

                Assert(saved === false, 'a locked deal must refuse a direct save — the lock is not a UI concern');

                const row = await TxOne<{ Name: string }>(
                    ctx, `SELECT Name FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                Assert(row.Name !== 'CD5 renamed after close', 'and the refusal actually kept the row unchanged');
            }),
    },
    {
        Id: 'close-deal.CD6',
        Name: 'CD6: Description stays editable on a locked deal — the lock is field-by-field, not a wall',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD6 carve-out',
                );
                Assert((await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success, 'the close ran');

                // §7.3 carves these two out on purpose: a closed deal still gets commentary, and forcing
                // a reopen to add a note would corrupt the reopen record with administrative noise.
                const md = new Metadata();
                const deal = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(dealID), 'the closed deal loads');
                deal.Description = 'Signed at the eleventh hour.';

                Assert(await deal.Save(), 'Description is editable after close');
            }),
    },
    {
        Id: 'close-deal.CD7',
        Name: 'CD7: a stubbed downstream reports Executed:false WITH a reason, and fabricates no ID',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD7 stub honesty',
                    bothLineKinds(f),
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, 'a close COMMITS even when the downstream is stubbed — see D-CF1');

                for (const r of out.Routing) {
                    AssertEqual(r.Executed, false, `${r.Target} cannot have executed: neither sibling is reachable`);
                    Assert(
                        typeof r.Reason === 'string' && (r.Reason as string).length > 0,
                        `${r.Target} must say WHY it did not execute — a silent false is indistinguishable ` +
                            'from a bug',
                    );
                    Assert(!r.RecordID, `${r.Target} must not invent a record ID`);
                }

                const row = await TxOne<{ ContractID: string | null }>(
                    ctx, `SELECT ContractID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                Assert(!row.ContractID, 'and no fabricated contract was stamped onto the deal');
            }),
    },
    {
        Id: 'close-deal.CD8',
        Name: 'CD8: closing as LOST without a loss reason is refused',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD8 no reason',
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.LostStatusID });

                Assert(!out.Success, 'the app\'s one mandatory field — the friction is deliberate');
                Assert(
                    out.Issues.some((i) => i.Field === 'LossReasonID'),
                    `the refusal must name the field: ${JSON.stringify(out.Issues)}`,
                );
            }),
    },
    {
        Id: 'close-deal.CD9',
        Name: 'CD9: a loss reason flagged RequiresNotes is refused without notes, and accepted with them',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD9 notes',
                );

                const refused = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.LostStatusID,
                    LossReasonID: f.LossReasonNeedsNotesID,
                });
                Assert(!refused.Success, 'RequiresNotes is a FLAG on the reason, and the close reads it');
                Assert(
                    refused.Issues.some((i) => i.Field === 'LossNotes'),
                    `the refusal must name LossNotes: ${JSON.stringify(refused.Issues)}`,
                );

                const accepted = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.LostStatusID,
                    LossReasonID: f.LossReasonNeedsNotesID,
                    LossNotes: 'Lost the security review on SSO scoping.',
                });
                Assert(accepted.Success, `with notes it must close: ${JSON.stringify(accepted.Issues)}`);
                Assert(accepted.IsLost, 'and report the lost path');
                AssertEqual(accepted.Routing.length, 0, 'a lost deal routes nothing downstream');
            }),
    },
    {
        Id: 'close-deal.CD10',
        Name: 'CD10: reopen without a reason is refused',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD10 no reason',
                );
                Assert((await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success, 'closed');

                const out = await reopen(ctx, { DealID: dealID, Reason: '   ' });

                Assert(!out.Success, 'undoing a lock has to be explainable — whitespace is not a reason');
                Assert(out.Issues.some((i) => i.Field === 'Reason'), `must name Reason: ${JSON.stringify(out.Issues)}`);
            }),
    },
    {
        Id: 'close-deal.CD11',
        Name: 'CD11: reopen unlocks the deal, clears the close stamps, and PRESERVES the close event',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD11 reopen',
                );
                Assert((await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success, 'closed');
                const afterClose = (await stageEvents(ctx, dealID)).length;

                const out = await reopen(ctx, { DealID: dealID, Reason: 'Signature bounced; back to legal.' });
                Assert(out.Success, `the reopen failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.Unlocked, 'and reports the unlock');

                // Provenance is append-only: reopening ADDS to the record rather than erasing it, so the
                // fact that a close happened survives the close being undone.
                AssertEqual((await stageEvents(ctx, dealID)).length, afterClose + 1, 'the close event survives');

                const row = await TxOne<{ ClosedAt: unknown; ClosedByUserID: unknown; ActualCloseDate: unknown }>(
                    ctx, `SELECT ClosedAt, ClosedByUserID, ActualCloseDate FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                Assert(!row.ClosedAt, 'ClosedAt is cleared — it describes a close no longer in effect');
                Assert(!row.ClosedByUserID, 'ClosedByUserID is cleared');
                Assert(!row.ActualCloseDate, 'ActualCloseDate is cleared, so period rollups stay honest');

                // And the lock is genuinely gone, by the only test that matters.
                const md = new Metadata();
                const deal = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(dealID), 'the reopened deal loads');
                deal.Name = 'CD11 renamed after reopen';
                Assert(await deal.Save(), 'a reopened deal accepts an ordinary save again');
            }),
    },
    {
        Id: 'close-deal.CD12',
        Name: 'CD12: PreviewOnly shows the consequences and writes NOTHING',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD12 preview',
                    bothLineKinds(f),
                );
                const before = (await stageEvents(ctx, dealID)).length;

                const out = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.WonStatusID,
                    PreviewOnly: true,
                });

                Assert(out.Success, `the preview failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.WasPreview, 'and says it was a preview');
                Assert(out.Routing.length > 0, 'a preview still shows what WOULD be routed');
                Assert(!out.Locked, 'a preview locks nothing');

                AssertEqual((await stageEvents(ctx, dealID)).length, before, 'no event was appended');
                const row = await TxOne<{ ClosedAt: unknown }>(
                    ctx, `SELECT ClosedAt FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                Assert(!row.ClosedAt, 'and the deal was not stamped closed');

                // Still open afterwards, which is what makes a preview safe to run from a button.
                const md = new Metadata();
                const deal = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(dealID), 'the deal loads');
                deal.Name = 'CD12 still editable';
                Assert(await deal.Save(), 'and is still editable — no lock was applied');
            }),
    },
    {
        Id: 'close-deal.CD13',
        Name: 'CD13: the lock covers the CHILD COLLECTIONS too — and the closing transition may still carry them',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);

                /**
                 * THE GAP CD5 CANNOT SEE, and it opened when the deal gained Related Record Collections.
                 *
                 * CD5 proves a locked deal refuses a HEADER edit. But `Lines`, `PaymentSchedule` and
                 * `Team` are COMPANIONS, not fields — they never appear in `this.Fields`, so a lock built
                 * only on dirty fields would refuse a renamed deal and happily accept a DELETED LINE. A
                 * deal's lines are exactly what the contract and the order were derived from, so that is
                 * the more damaging edit of the two.
                 *
                 * This check pins both halves of the rule, because they pull in opposite directions and
                 * getting either wrong is silent.
                 */
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD13 collection lock',
                    bothLineKinds(f),
                );

                // ── HALF ONE: the CLOSING transition may carry final collection state ──────────────
                // The deal is still OPEN in the database at this point, so the lock must not fire. If it
                // did, a rep could never make a last correction as part of closing — and the lock would
                // be unusable rather than merely strict.
                const closing = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await closing.Load(dealID), 'the open deal loads');
                await closing.LoadRelatedRecords('Lines');
                const lastEdit = closing.Lines.Items[0];
                lastEdit.Quantity = 41;
                Assert(
                    await closing.Save(),
                    `an OPEN deal must accept a collection edit — ${closing.LatestResult?.CompleteMessage ?? ''}`,
                );

                const afterEdit = await TxOne<{ Quantity: number }>(
                    ctx, `SELECT Quantity FROM ${SALES_SCHEMA}.DealLine WHERE ID = '${lastEdit.ID}'`,
                );
                AssertEqual(Number(afterEdit.Quantity), 41, 'and the edit actually landed');

                // ── now close it ──────────────────────────────────────────────────────────────────
                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.Locked, 'the won status carries LocksDeal, so the close must report Locked');

                const before = await children(ctx, dealID);

                // ── HALF TWO: a REMOVAL on the closed deal is refused ──────────────────────────────
                const locked = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await locked.Load(dealID), 'the closed deal loads');
                await locked.LoadRelatedRecords('Lines');
                AssertEqual(locked.Lines.Count, 2, 'both lines came back');

                locked.Lines.Remove(locked.Lines.Items[1]);
                AssertEqual(
                    await locked.Save(),
                    false,
                    'removing a line from a CLOSED deal must be refused — the header is untouched, so only ' +
                        'the collection check can catch this',
                );

                AssertEqual(
                    (await children(ctx, dealID)).length,
                    before.length,
                    'and the refusal kept the line in the database',
                );

                // ── HALF TWO (b): an EDIT on the closed deal is refused too ────────────────────────
                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(dealID), 'the closed deal loads again');
                await edited.LoadRelatedRecords('Lines');
                const target = edited.Lines.Items[0];
                target.Quantity = 999;
                AssertEqual(await edited.Save(), false, 'editing a line on a CLOSED deal must be refused');

                const finalRow = await TxOne<{ Quantity: number }>(
                    ctx, `SELECT Quantity FROM ${SALES_SCHEMA}.DealLine WHERE ID = '${target.ID}'`,
                );
                AssertEqual(Number(finalRow.Quantity), 41, 'the stored quantity is still the pre-close value');
            }),
    },
];

for (const check of CloseDealChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/**
 * Setup and Teardown are BOTH NO-OPS, for the same reason as `save-deal`: the fixture is discovered from
 * the seeded database rather than created, and every check rolls its own transaction back.
 */
IntegrationCheckRegistry.Instance.RegisterLifecycle('close-deal', {
    Setup: async () => {
        // Nothing to create: the fixture is discovered, not built.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadCloseDealChecks(): void {
    void Metadata;
}
