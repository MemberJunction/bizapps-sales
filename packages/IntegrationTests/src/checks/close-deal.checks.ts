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
    DEAL_FIELDS_EDITABLE_WHILE_LOCKED,
    E_ORDERS_PRODUCT,
    ProductFilterFor,
    StubDownstreamSeam,
    SalesCloseDealOperation,
    SalesReopenDealOperation,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
    type SalesCloseRoutingResult,
    type SalesReopenDealInput,
    type SalesReopenDealOutput,
    type DealEntity,
    type mjBizAppsSalesDealEntity,
} from '@mj-biz-apps/sales-entities';
import {
    OrdersIsInstalled,
    ResetDownstreamSeam,
    SetDownstreamSeam,
} from '@mj-biz-apps/sales-core-entities-server';

import {
    E_DEAL,
    E_SCHEDULE,
    E_STAGE_EVENT,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/**
 * A CHILD ROW as the fixture builder wants it, before it becomes a real child entity.
 *
 * These are payment-schedule INSTALMENTS now, not lines. The deal holds no lines (S-US4), and the
 * checks that need a deal WITH children need them for the close lock -- CD13 proves the lock reaches a
 * child collection, and any of the deal's own collections demonstrates that equally well.
 *
 * Instalments are the better choice for a second reason: they need no catalogue. The old seed reached
 * into orders for a real ProductID, which made a DEFAULT-GATE bundle depend on orders being installed.
 * This bundle must stay green on a sales-only host, and now it can without a conditional.
 */
interface SeedInstalment {
    Amount: number;
    Description: string;
}

/**
 * Creates a deal to close, on the pipeline the caller names.
 *
 * Every close check needs a saved OPEN deal first, and building it through the REAL SAVE PATH rather
 * than by hand is deliberate: these checks then exercise the same rows a user would produce, including
 * the server-maintained stamps, instead of a hand-assembled shape that happens to satisfy them.
 *
 * That path used to be `Sales.SaveDeal`. The operation was retired when `Deal` gained Related Record
 * Collections, so the same intent is now expressed directly on the entity graph — one `deal.Save()`
 * carrying whatever children the caller asked for, which is what the workspace does.
 */
async function openDeal(
    ctx: Ctx,
    f: SalesFixture,
    pipelineID: string,
    stageID: string,
    name: string,
    instalments: SeedInstalment[] = [],
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

    for (const seed of instalments) {
        const row = await deal.PaymentSchedule.Create();
        row.Amount = seed.Amount;
        row.Description = seed.Description;
    }
    Assert(
        await deal.Save(),
        `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
    );
    return deal.ID;
}


/**
 * Two instalments, so a deal has a child collection for the lock to reach.
 *
 * It used to be one recurring and one one-time LINE, because the policy routed the two kinds
 * differently. Nothing routes by line kind any more -- DealLineType is retired and close-won does not
 * touch the order -- so what these checks actually need from children is simply that some exist.
 */
function twoInstalments(): SeedInstalment[] {
    // No DisplayOrder: the collection sequences from array position.
    return [
        { Amount: 40000, Description: 'On execution' },
        { Amount: 20000, Description: 'On acceptance' },
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

/** The deal's INSTALMENT rows, read through the provider so the check's open transaction is visible. */
async function instalments(ctx: Ctx, dealID: string): Promise<Record<string, unknown>[]> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: E_SCHEDULE,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'DisplayOrder ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Amount', 'Description', 'DisplayOrder'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the deal's instalments failed — ${r.ErrorMessage}`);
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
                    twoInstalments(),
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
                    twoInstalments(),
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
                    twoInstalments(),
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
        Id: 'close-deal.CD14',
        Name: 'CD14: the SHARED editable-while-locked set is exactly what the server enforces',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * PINS THE CONSTANT THE EXPLORER FORM READS.
                 *
                 * `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` moved into `sales-entities` so the Deal form can
                 * grey out exactly what `DealEntityServer.Save()` refuses. That sharing is only worth
                 * anything if the constant still describes real behaviour — a list that drifts from the
                 * server turns into a form that offers a field the server rejects, or greys out one it
                 * would have accepted. Neither shows up until a user hits it.
                 *
                 * CD6 proves the carve-out exists for `Description`. This proves the WHOLE set, in both
                 * directions, so adding a field to the constant without teaching the server is a failure
                 * here rather than a surprise in the UI.
                 */
                const f = await ResolveSalesFixture(ctx);
                const md = new Metadata();

                for (const field of DEAL_FIELDS_EDITABLE_WHILE_LOCKED) {
                    const dealID = await openDeal(
                        ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, `CD14 ${field}`,
                    );
                    Assert(
                        (await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success,
                        `the close ran for ${field}`,
                    );

                    const deal = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                    Assert(await deal.Load(dealID), `the closed deal loads for ${field}`);
                    deal.Set(field, `CD14 touched ${field}`);
                    Assert(
                        await deal.Save(),
                        `'${field}' is in DEAL_FIELDS_EDITABLE_WHILE_LOCKED but the server REFUSED it — ` +
                            'the shared constant no longer matches the lock',
                    );
                }

                // And the other direction: a field OUTSIDE the set must still be refused, or the set is
                // describing a lock that is not actually holding anything.
                const lockedID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD14 negative',
                );
                Assert(
                    (await close(ctx, { DealID: lockedID, DealStatusTypeID: f.WonStatusID })).Success,
                    'the close ran for the negative case',
                );
                const locked = await md.GetEntityObject<mjBizAppsSalesDealEntity>(E_DEAL, ctx.User);
                Assert(await locked.Load(lockedID), 'the locked deal loads');
                Assert(
                    !DEAL_FIELDS_EDITABLE_WHILE_LOCKED.has('Name'),
                    'this check assumes Name is NOT carved out; update it if that ever changes',
                );
                locked.Name = 'CD14 should not be allowed to rename a closed deal';
                Assert(
                    !(await locked.Save()),
                    'a field outside the shared set must still be refused — otherwise the lock is advisory',
                );
            }),
    },
    {
        Id: 'close-deal.CD7',
        Name: 'CD7: a stubbed downstream reports Executed:false WITH a reason, and fabricates no ID',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * PINS THE STUB, rather than assuming one.
                 *
                 * This check is about STUB HONESTY — that an unreachable downstream reports
                 * `Executed: false` with a reason and fabricates no ID. On a host where orders is
                 * installed the seam selects the LIVE implementation and the order really is created,
                 * so the check would fail while both the seam and the close were behaving correctly.
                 * Installing the stub for the duration keeps the check testing what it names.
                 */
                const previousSeam = SetDownstreamSeam(new StubDownstreamSeam());
                try {
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD7 stub honesty',
                    twoInstalments(),
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
                } finally {
                    // Back to DEPLOYMENT-based selection. Restoring `previousSeam` alone would leave
                    // `SetDownstreamSeam`'s latch on and pin every later check in this process to it.
                    void previousSeam;
                    ResetDownstreamSeam();
                }
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
                    twoInstalments(),
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
                    twoInstalments(),
                );

                // ── HALF ONE: the CLOSING transition may carry final collection state ──────────────
                // The deal is still OPEN in the database at this point, so the lock must not fire. If it
                // did, a rep could never make a last correction as part of closing — and the lock would
                // be unusable rather than merely strict.
                const closing = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await closing.Load(dealID), 'the open deal loads');
                await closing.LoadRelatedRecords('PaymentSchedule');
                const lastEdit = closing.PaymentSchedule.Items[0];
                lastEdit.Amount = 41000;
                Assert(
                    await closing.Save(),
                    `an OPEN deal must accept a collection edit — ${closing.LatestResult?.CompleteMessage ?? ''}`,
                );

                const afterEdit = await TxOne<{ Amount: number }>(
                    ctx, `SELECT Amount FROM ${SALES_SCHEMA}.DealPaymentSchedule WHERE ID = '${lastEdit.ID}'`,
                );
                AssertEqual(Number(afterEdit.Amount), 41000, 'and the edit actually landed');

                // ── now close it ──────────────────────────────────────────────────────────────────
                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.Locked, 'the won status carries LocksDeal, so the close must report Locked');

                const before = await instalments(ctx, dealID);

                // ── HALF TWO: a REMOVAL on the closed deal is refused ──────────────────────────────
                const locked = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await locked.Load(dealID), 'the closed deal loads');
                await locked.LoadRelatedRecords('PaymentSchedule');
                AssertEqual(locked.PaymentSchedule.Count, 2, 'both instalments came back');

                locked.PaymentSchedule.Remove(locked.PaymentSchedule.Items[1]);
                AssertEqual(
                    await locked.Save(),
                    false,
                    'removing an instalment from a CLOSED deal must be refused — the header is untouched, so only ' +
                        'the collection check can catch this',
                );

                AssertEqual(
                    (await instalments(ctx, dealID)).length,
                    before.length,
                    'and the refusal kept the instalment in the database',
                );

                // ── HALF TWO (b): an EDIT on the closed deal is refused too ────────────────────────
                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(dealID), 'the closed deal loads again');
                await edited.LoadRelatedRecords('PaymentSchedule');
                const target = edited.PaymentSchedule.Items[0];
                target.Amount = 99900;
                AssertEqual(await edited.Save(), false, 'editing an instalment on a CLOSED deal must be refused');

                const finalRow = await TxOne<{ Amount: number }>(
                    ctx, `SELECT Amount FROM ${SALES_SCHEMA}.DealPaymentSchedule WHERE ID = '${target.ID}'`,
                );
                AssertEqual(Number(finalRow.Amount), 41000, 'the stored amount is still the pre-close value');
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
