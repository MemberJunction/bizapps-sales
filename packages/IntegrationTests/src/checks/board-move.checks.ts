/**
 * @fileoverview `board-move` — BD1–BD4. A stage move writes its provenance, exactly once.
 *
 * WHY THIS BUNDLE EXISTS. The pipeline board's one destructive gesture is a drag, and the guarantee it
 * has to keep is that moving a deal appends **exactly one** `DealStageEvent` stamping what the deal was
 * worth on the way out. That is not checkable from the UI: a board that wrote two events, or none, or one
 * with the arrival probability instead of the departure probability, looks identical on screen.
 *
 * WHERE THE BEHAVIOUR LIVES. `Sales.SaveDeal`, not the board. The board moves a deal by loading its draft,
 * setting the stage and saving — so the event is appended by the operation whenever it sees the stage
 * change, and an Action, an agent or the workspace's own stage dropdown all get it too. These checks
 * therefore exercise the operation directly, which is the level the promise is made at.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check here writes. Each rolls its transaction back.
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
import { DealEntity } from '@mj-biz-apps/sales-entities';

import {
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_STAGE_EVENT = 'MJ_BizApps_Sales: Deal Stage Events';
const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';

/**
 * WHAT THESE CHECKS DRIVE, AND WHY IT CHANGED.
 *
 * They used to call `Sales.SaveDeal`, a remote operation that no longer exists. The stage-event append
 * moved with it, onto `DealEntityServer.Save()` — and that relocation is the point rather than an
 * inconvenience. An operation could only stamp moves that came through IT, so a stage change made by an
 * Action, an agent, a fixture or a raw `BaseEntity.Save()` left no trace at all. On the entity server it
 * is the one path every write takes.
 *
 * So these now drive the ENTITY, which means they exercise the same code path a board drag, the deal
 * workspace and a script all share. Every assertion below is unchanged: exactly one event per move,
 * stamped with the values the deal held on the way OUT.
 */
interface DealDraft {
    ID?: string;
    Name: string;
    PipelineID: string;
    PipelineStageID: string;
    DealTypeID: string;
    DealStatusTypeID: string;
    AccountID: string;
    TermMonths?: number;
    Amount?: number;
    Probability?: number;
}

/** What the old operation's envelope carried, kept so the checks below read unchanged. */
interface DealSaveResult {
    Success: boolean;
    DealID: string | null;
    Issues: { Message: string }[];
}

async function save(ctx: Ctx, input: DealDraft): Promise<DealSaveResult> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>('MJ_BizApps_Sales: Deals', ctx.User);
    if (input.ID) {
        // A MOVE IS A LOAD THEN AN EDIT, which is what the board actually does. Constructing a fresh
        // record with an ID would leave every OldValue null, and the append reads OldValue to decide
        // whether the stage moved at all — so a shortcut here would quietly test nothing.
        Assert(await deal.Load(input.ID), `the deal ${input.ID} could not be loaded`);
    } else {
        deal.NewRecord();
    }

    deal.Name = input.Name;
    deal.PipelineID = input.PipelineID;
    deal.PipelineStageID = input.PipelineStageID;
    deal.DealTypeID = input.DealTypeID;
    deal.DealStatusTypeID = input.DealStatusTypeID;
    deal.AccountID = input.AccountID;
    if (input.TermMonths != null) deal.TermMonths = input.TermMonths;
    if (input.Amount != null) deal.Amount = input.Amount;
    if (input.Probability != null) deal.Probability = input.Probability;

    const ok = await deal.Save();
    return {
        Success: ok,
        DealID: ok ? deal.ID : null,
        Issues: ok ? [] : [{ Message: deal.LatestResult?.CompleteMessage ?? 'unknown error' }],
    };
}

function draft(f: SalesFixture, name: string, overrides: Partial<DealDraft> = {}): DealDraft {
    return {
        Name: name,
        PipelineID: f.PipelineID,
        PipelineStageID: f.StageID,
        DealTypeID: f.DealTypeID,
        DealStatusTypeID: f.OpenStatusID,
        AccountID: f.AccountID,
        TermMonths: 12,
        ...overrides,
    };
}
/** Two stages on the fixture's pipeline, in DisplayOrder — a move needs somewhere to go. */
async function twoStages(ctx: Ctx, f: SalesFixture): Promise<{ from: string; to: string } | null> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string; DisplayOrder: number }>(
        {
            EntityName: E_STAGE,
            ExtraFilter: `PipelineID = '${f.PipelineID}' AND IsActive = 1`,
            OrderBy: 'DisplayOrder ASC',
            ResultType: 'simple',
            Fields: ['ID', 'DisplayOrder'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading stages failed — ${r.ErrorMessage}`);
    const stages = r.Results ?? [];
    return stages.length >= 2 ? { from: stages[0].ID, to: stages[1].ID } : null;
}

async function eventsFor(ctx: Ctx, dealID: string): Promise<Array<Record<string, unknown>>> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: E_STAGE_EVENT,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'ChangedAt ASC',
            ResultType: 'simple',
            Fields: ['ID', 'FromStageID', 'ToStageID', 'AmountAtTransition', 'ProbabilityAtTransition', 'ChangedByUserID'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading stage events failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Array<Record<string, unknown>>;
}

export const BoardMoveChecks: NamedCheck[] = [
    {
        Id: 'board-move.BD1',
        Name: 'BD1: a stage move updates the stage and appends EXACTLY ONE DealStageEvent',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const stages = await twoStages(ctx, f);
                Assert(
                    !!stages,
                    'this check needs a pipeline with at least two active stages — run scripts/seed-dev-data.sh',
                );
                const { from, to } = stages as { from: string; to: string };

                const created = await save(ctx, draft(f, 'BD1 move', { PipelineStageID: from, Amount: 50000 }));
                Assert(created.Success, `setup save failed: ${JSON.stringify(created.Issues)}`);
                const dealID = created.DealID as string;

                // A CREATE is not a transition: there is no stage it came from.
                AssertEqual((await eventsFor(ctx, dealID)).length, 0, 'creating a deal appends no stage event');

                const moved = await save(
                    ctx,
                    draft(f, 'BD1 move', { ID: dealID, PipelineStageID: to, Amount: 50000 }),
                );
                Assert(moved.Success, `the move failed: ${JSON.stringify(moved.Issues)}`);

                const events = await eventsFor(ctx, dealID);
                AssertEqual(events.length, 1, 'exactly one event — not zero, and not one per save');
                AssertEqual(String(events[0].FromStageID).toLowerCase(), from.toLowerCase(), 'it records where it left');
                AssertEqual(String(events[0].ToStageID).toLowerCase(), to.toLowerCase(), 'and where it arrived');

                const row = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(String(row.PipelineStageID).toLowerCase(), to.toLowerCase(), 'the deal actually moved');
            }),
    },
    {
        Id: 'board-move.BD2',
        Name: 'BD2: the event stamps the amount and probability the deal held ON THE WAY OUT',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const stages = await twoStages(ctx, f);
                Assert(!!stages, 'needs two stages');
                const { from, to } = stages as { from: string; to: string };

                const created = await save(
                    ctx,
                    draft(f, 'BD2 stamps', { PipelineStageID: from, Amount: 82000, Probability: 30 }),
                );
                Assert(created.Success, `setup save failed: ${JSON.stringify(created.Issues)}`);
                const dealID = created.DealID as string;

                // The board applies the TARGET stage's probability on arrival, so the move sends a
                // different probability than the deal held. The stamp must be the departure value —
                // otherwise every velocity report reads the number the deal acquired by arriving.
                const moved = await save(
                    ctx,
                    draft(f, 'BD2 stamps', { ID: dealID, PipelineStageID: to, Amount: 82000, Probability: 75 }),
                );
                Assert(moved.Success, `the move failed: ${JSON.stringify(moved.Issues)}`);

                const events = await eventsFor(ctx, dealID);
                AssertEqual(events.length, 1, 'one event');
                AssertEqual(Number(events[0].AmountAtTransition), 82000, 'the amount as it left');
                AssertEqual(
                    Number(events[0].ProbabilityAtTransition),
                    30,
                    'the DEPARTURE probability (30), not the one applied on arrival (75)',
                );
            }),
    },
    {
        Id: 'board-move.BD3',
        Name: 'BD3: saving with the stage UNCHANGED appends nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await save(ctx, draft(f, 'BD3 no move'));
                Assert(created.Success, `setup save failed: ${JSON.stringify(created.Issues)}`);
                const dealID = created.DealID as string;

                // An ordinary edit. If this appended an event, the log would fill with noise and
                // "how long did this sit in that stage" would become unanswerable.
                const edited = await save(ctx, draft(f, 'BD3 renamed', { ID: dealID }));
                Assert(edited.Success, `the edit failed: ${JSON.stringify(edited.Issues)}`);

                AssertEqual((await eventsFor(ctx, dealID)).length, 0, 'no stage change, no event');
            }),
    },
    {
        Id: 'board-move.BD4',
        Name: 'BD4: two successive moves append two events — the log is append-only, never rewritten',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const stages = await twoStages(ctx, f);
                Assert(!!stages, 'needs two stages');
                const { from, to } = stages as { from: string; to: string };

                const created = await save(ctx, draft(f, 'BD4 back and forth', { PipelineStageID: from }));
                Assert(created.Success, `setup save failed: ${JSON.stringify(created.Issues)}`);
                const dealID = created.DealID as string;

                Assert((await save(ctx, draft(f, 'BD4 back and forth', { ID: dealID, PipelineStageID: to }))).Success, 'forward');
                Assert((await save(ctx, draft(f, 'BD4 back and forth', { ID: dealID, PipelineStageID: from }))).Success, 'back');

                const events = await eventsFor(ctx, dealID);
                AssertEqual(events.length, 2, 'a move back is its own event, not an undo of the first');
                AssertEqual(String(events[0].ToStageID).toLowerCase(), to.toLowerCase(), 'first went forward');
                AssertEqual(String(events[1].ToStageID).toLowerCase(), from.toLowerCase(), 'second came back');
                Assert(!!events[0].ChangedByUserID, 'and each records who moved it');
            }),
    },
];

for (const check of BoardMoveChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('board-move', {
    Setup: async () => {
        // Nothing to create: the fixture is discovered, not built.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadBoardMoveChecks(): void {
    void Metadata;
}
