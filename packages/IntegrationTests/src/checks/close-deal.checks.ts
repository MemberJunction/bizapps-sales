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
import { IsBooked, ORDER_STATUSES } from '@mj-biz-apps/orders-entities';
import {
    DEFAULT_DUE_IN_DAYS,
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

/** Tasks' schema, named here because sales holds no compile-time dependency on it. */
const TASKS_SCHEMA = '__mj_BizAppsTasks';

/**
 * EVERY row of raw SQL, through the provider so it sees the check's open transaction.
 *
 * `TxOne` is the fixture's single-row reader and asserts a row exists; this is the same call without that
 * assertion, because "how many tasks did the close raise" is a question whose answer can legitimately be
 * more than one and must not be truncated to the first.
 */
async function TxAll<T extends Record<string, unknown>>(ctx: Ctx, sql: string): Promise<T[]> {
    const provider = ctx.Provider as unknown as {
        ExecuteSQL: (
            sql: string,
            params: Record<string, unknown>,
            options: { isMutation: boolean; description: string },
            user: unknown,
        ) => Promise<Record<string, unknown>[]>;
    };
    const rows = await provider.ExecuteSQL(
        sql, {}, { isMutation: false, description: 'sales check read (multi-row)' }, ctx.User,
    );
    return (rows ?? []) as T[];
}

    /**
     * The same call with `isMutation: true`, for the one check that has to MOVE an order's status.
     *
     * CD24 needs an order that is Confirmed, and then the same order Voided with its `ConfirmedAt` still
     * standing. Neither state is reachable by driving sales -- sales never confirms an order, which is
     * the whole point of the boundary -- so the row is moved directly, inside the check's own
     * transaction, and rolled back with everything else.
     */
async function TxExec(ctx: Ctx, sql: string, description: string): Promise<void> {
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

/**
 * Orders' schema, named here rather than imported: sales holds no compile-time dependency on orders, and
 * the sibling bundles spell it out the same way.
 */
const ORDERS_SCHEMA = '__mj_BizAppsOrders';

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
            Fields: [
                'ID',
                // FromStageID/ToStageID are read because CD15 needs to tell one row from another. Without
                // them a duplicated transition and a single one look identical in this projection.
                'FromStageID',
                'ToStageID',
                'ToDealStatusTypeID',
                'AmountAtTransition',
                'ProbabilityAtTransition',
                'Notes',
            ],
        },
        ctx.User,
    );
    Assert(r.Success, `reading stage events failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/**
 * Another stage on the same pipeline, and its probability.
 *
 * `ClosingStageID` is the input that makes a close move the stage, and no fixture field carries a second
 * stage — which is exactly why CD1–CD14 never passed one, and why the close spent a round writing two
 * provenance rows for every close that did. Resolved by DisplayOrder rather than by name: a stage called
 * "Signed" is a label (§3), and this must keep working on a pipeline that calls it anything else.
 */
async function otherStage(
    ctx: Ctx,
    pipelineID: string,
    notStageID: string,
): Promise<{ ID: string; Probability: number | null }> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: 'MJ_BizApps_Sales: Pipeline Stages',
            ExtraFilter: `PipelineID = '${pipelineID}' AND ID <> '${notStageID}'`,
            OrderBy: 'DisplayOrder DESC',
            ResultType: 'simple',
            Fields: ['ID', 'Probability'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the pipeline's stages failed — ${r.ErrorMessage}`);
    const row = (r.Results ?? [])[0] as { ID?: string; Probability?: number | null } | undefined;
    Assert(!!row?.ID, 'setup: the pipeline needs a second stage for a close to move INTO');
    return { ID: String(row?.ID), Probability: row?.Probability ?? null };
}

/**
 * The first stage on a pipeline whose declared `DealStatusType` satisfies a FLAG predicate.
 *
 * Flags, never names: the caller passes `IsWon = 1` or `IsLost = 1` and gets whatever that pipeline calls
 * the stage. Used to build the deliberately-contradictory pairing CD17 needs.
 */
async function stageDeclaring(
    ctx: Ctx,
    pipelineID: string,
    statusFlagPredicate: string,
): Promise<{ ID: string } | null> {
    const row = await TxOne<{ ID: string }>(
        ctx,
        `SELECT TOP 1 s.ID
           FROM ${SALES_SCHEMA}.PipelineStage s
           JOIN ${SALES_SCHEMA}.DealStatusType t ON t.ID = s.DealStatusTypeID
          WHERE s.PipelineID = '${pipelineID}' AND s.IsActive = 1 AND ${statusFlagPredicate}
          ORDER BY s.DisplayOrder`,
    );
    return row?.ID ? { ID: String(row.ID) } : null;
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
                /**
                 * AND NO ORDER EITHER, which is the assertion that changed. This line used to read
                 * `Assert(!!routeTo(out, 'Order'))` -- the policy's whole point was that it sent one-time
                 * lines to a new Order instead of a contract. The Order route is GONE: the deal now carries
                 * its order from creation (S-US4) and a won close leaves it alone (S-US5), so there is
                 * nothing left for the close to create.
                 *
                 * Inverting it rather than deleting it keeps CD2 doing its real job. The check is about
                 * POLICY deciding routing rather than the status -- CD1 and CD2 close the identical deal
                 * shape to the identical won status and differ only in pipeline. What that comparison
                 * proves now is that one plans a contract and the other plans NOTHING.
                 */
                Assert(
                    !routeTo(out, 'Order'),
                    'no Order is planned any more — the deal already has one. close-won-order.CO4 is the ' +
                        'check that owns this behaviour; this asserts the policy path agrees with it.',
                );
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

                /**
                 * THE DEAL IS GIVEN REAL FIGURES FIRST, and that is the whole difference between this
                 * check and the one it replaces.
                 *
                 * The previous version asserted `'AmountAtTransition' in last`. That is true of every row
                 * `stageEvents()` returns, because the column is named in the RunView's `Fields` — so it
                 * held whether the close stamped the value, stamped a null, or stamped nothing at all. A
                 * mutation that replaced `event.AmountAtTransition = deal.Amount` with `= null` left the
                 * whole suite green: measured, which is how this was found rather than reasoned about.
                 *
                 * A seeded deal carries no amount, so null-versus-null was indistinguishable. Setting the
                 * figures here is what makes the comparison mean something.
                 */
                const priced = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await priced.Load(dealID), 'the open deal loads so it can be given figures');
                priced.Amount = 123456.78;
                priced.Probability = 42;
                Assert(
                    await priced.Save(),
                    `an OPEN deal must accept an amount — ${priced.LatestResult?.CompleteMessage ?? ''}`,
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
                // Without the stamps, "what did we think this was worth when we closed it" is unanswerable
                // once amounts change. So the VALUES are compared, not the presence of the keys.
                AssertEqual(
                    Number(last.AmountAtTransition),
                    123456.78,
                    'the event stamps the amount the deal carried AT the transition',
                );
                AssertEqual(
                    Number(last.ProbabilityAtTransition),
                    42,
                    'and the probability it carried at the transition',
                );
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
        Id: 'close-deal.CD23',
        Name: 'CD23: a refused downstream route reports a WARNING in Issues, and does NOT fail the close',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE GAP THIS CLOSES IS PROGRAMMATIC, NOT VISUAL.
                 *
                 * `Routing[].Reason` already carried the refusal, and the workspace already renders it —
                 * `deal-workspace.component.html` shows `not created: {{ r.Reason }}` on a failed row, so a
                 * rep sees it. What did not carry it was `Issues`, the field every OTHER failure mode in
                 * this operation reports through. An API client, an agent or an importer that checks
                 * `Success` and reads `Issues` saw `Success: true` and an empty array on a close whose
                 * contract had been declined.
                 *
                 * Measured before the fix: `DEAL-9003` is a renewal with no `RenewsContractID`, the seam
                 * declined with exactly that reason, and the envelope reported unqualified success.
                 *
                 * ── BOTH HALVES ARE ASSERTED, AND THE SECOND IS THE POINT ────────────────────────────
                 *
                 * The obvious regression is the warning going missing. The DANGEROUS one is the opposite:
                 * somebody reads a warning-severity Issue as a defect and "fixes" it by failing the close.
                 * That would trade a recorded win for an unrecorded one over a contract that legitimately
                 * could not be derived — a renewal with no parent, or a subscription route still waiting on
                 * orders' C0. So `Success` staying true is asserted as loudly as the warning appearing, and
                 * the same for the deal actually being won in the database.
                 *
                 * Uses the stub seam for the same reason CD7 does: on a host where the siblings ARE
                 * reachable the route would execute, and a check about refusals would have nothing to
                 * observe.
                 */
                const previousSeam = SetDownstreamSeam(new StubDownstreamSeam());
                try {
                    const f = await ResolveSalesFixture(ctx);
                    const dealID = await openDeal(
                        ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID,
                        'CD23 refusal is a warning', twoInstalments(),
                    );

                    const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });

                    const refused = out.Routing.filter((r) => r.Planned === true && r.Executed !== true);
                    Assert(
                        refused.length > 0,
                        'setup: the stub seam must refuse at least one planned route, or this check has '
                            + 'nothing to assert about',
                    );

                    // ── half one: the warning is there, and it carries the reason ──────────────────
                    const warnings = (out.Issues ?? []).filter((i) => i.Severity === 'warning');
                    Assert(
                        warnings.length >= refused.length,
                        `each refused route owes one warning Issue — ${refused.length} refused, `
                            + `${warnings.length} warning(s) in Issues: ${JSON.stringify(out.Issues)}`,
                    );
                    for (const r of refused) {
                        const carried = warnings.find((w) => w.Message.includes(r.Target));
                        Assert(
                            !!carried,
                            `${r.Target} was refused and no Issue names it — a caller reading Issues alone `
                                + 'still cannot tell',
                        );
                        Assert(
                            typeof r.Reason === 'string' && carried!.Message.includes(r.Reason as string),
                            `the Issue for ${r.Target} must carry the SAME reason Routing gives, or the two `
                                + `channels can drift: Routing said "${r.Reason}", Issues said `
                                + `"${carried!.Message}"`,
                        );
                    }

                    // ── half two: none of that failed the close ────────────────────────────────────
                    Assert(
                        out.Success,
                        'A REFUSED DOWNSTREAM ROUTE MUST NOT FAIL A WON DEAL. If this line is red because '
                            + 'somebody made refusals fatal, that is the regression this check exists for — '
                            + 'the deal is won, the status is written and the order is intact; rolling that '
                            + 'back over a contract that could not be derived is the wrong trade.',
                    );
                    AssertEqual(
                        (out.Issues ?? []).filter((i) => i.Severity === 'error').length, 0,
                        'and a refusal is a warning, never an error',
                    );
                    Assert(out.IsWon, 'the outcome is still a win');

                    const row = await TxOne<{ DealStatusTypeID: string | null; ActualCloseDate: string | null }>(
                        ctx, `SELECT DealStatusTypeID, ActualCloseDate FROM ${SALES_SCHEMA}.Deal `
                            + `WHERE ID = '${dealID}'`,
                    );
                    AssertEqual(
                        String(row.DealStatusTypeID).toLowerCase(), String(f.WonStatusID).toLowerCase(),
                        'and the DATABASE agrees the deal is won — the warning did not roll anything back',
                    );
                    Assert(!!row.ActualCloseDate, 'the close date was written');
                } finally {
                    SetDownstreamSeam(previousSeam);
                }
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
    {
        Id: 'close-deal.CD15',
        Name: 'CD15: a close that MOVES the stage writes ONE event, not two',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE BLIND SPOT CD4 LEFT, AND THE DEFECT THAT LIVED IN IT ────────────────────────
                 *
                 * CD4 already asserts "exactly one event was appended". It stayed green through a round in
                 * which every close that moved a stage appended TWO, because no check in this bundle ever
                 * passed `ClosingStageID` — the only input that makes the stage move. `stampClose` wrote
                 * its row and then set `deal.PipelineStageID`, and the save that followed saw a stage
                 * change and wrote a second row for the same transition, into an append-only log.
                 *
                 * So this is CD4's assertion under the input CD4 never supplied. The row that survives
                 * must also be the RIGHT one: `From` the stage the deal was in, `To` the closing stage,
                 * and carrying the routing note — the entity's own appender had no note to write, so a
                 * null `Notes` here would mean the wrong writer won.
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD15 one row',
                );
                const closing = await otherStage(ctx, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID);

                const before = (await stageEvents(ctx, dealID)).length;
                const out = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.WonStatusID,
                    ClosingStageID: closing.ID,
                });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);

                const after = await stageEvents(ctx, dealID);
                AssertEqual(
                    after.length,
                    before + 1,
                    'ONE event for one transition — two means the operation and the entity both wrote it',
                );

                const last = after[after.length - 1];
                AssertEqual(
                    String(last.FromStageID).toLowerCase(),
                    f.OrderOnlyPolicyStageID.toLowerCase(),
                    'the surviving row records the stage the deal moved OUT of',
                );
                AssertEqual(
                    String(last.ToStageID).toLowerCase(),
                    closing.ID.toLowerCase(),
                    'and the closing stage it moved INTO',
                );
                Assert(
                    typeof last.Notes === 'string' && (last.Notes as string).length > 0,
                    'and it carries the routing note, so the row that survived is the CLOSE\'s row',
                );

                // The stage really did move. Otherwise the count above could be satisfied by a close that
                // silently ignored ClosingStageID.
                const row = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    closing.ID.toLowerCase(),
                    'and the deal is left in the closing stage',
                );

                // And the DealStageEventID the operation reports is a row that exists — it used to come
                // from the hand-written event, and now comes back from the save.
                Assert(
                    !!out.DealStageEventID &&
                        after.some((e) => String(e.ID).toLowerCase() === String(out.DealStageEventID).toLowerCase()),
                    'the reported DealStageEventID names one of the deal\'s actual events',
                );
            }),
    },
    {
        Id: 'close-deal.CD16',
        Name: 'CD16: a reopen INTO a stage writes one event and keeps the probability a human set',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE THIRD CONSEQUENCE OF FOUR WRITERS ON ONE TRIGGER ────────────────────────────
                 *
                 * `ReopenDeal` passing a `StageID` did three things nobody had audited together: it wrote
                 * its event, moved the stage — which made the save write a SECOND event — and, because the
                 * stage moved, silently invoked the stage-DEFAULTS writer, which re-derived `Probability`
                 * from the arriving stage AFTER the event had stamped the old one. The provenance row and
                 * the deal it described disagreed, and CD11 could not see any of it because it reopens
                 * without a stage.
                 *
                 * The probability assertion is the sharp one: it must be the figure the human set, and it
                 * must NOT be the arriving stage's default. Asserted as inequality too, because if the two
                 * happened to be equal the check would pass while proving nothing.
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD16 reopen into a stage',
                );
                const landing = await otherStage(ctx, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID);

                // A deliberately odd figure, and one the stage cannot be carrying.
                const HAND_SET = 37;
                Assert(
                    Number(landing.Probability ?? -1) !== HAND_SET,
                    `setup: the landing stage's own probability must differ from ${HAND_SET}, or this check ` +
                        'cannot tell the two apart',
                );

                const priced = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await priced.Load(dealID), 'the open deal loads');
                priced.Probability = HAND_SET;
                Assert(await priced.Save(), `an open deal accepts a probability — ${priced.LatestResult?.CompleteMessage ?? ''}`);

                Assert((await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success, 'closed');
                const afterClose = (await stageEvents(ctx, dealID)).length;

                const out = await reopen(ctx, {
                    DealID: dealID,
                    Reason: 'Signature bounced; back to legal.',
                    StageID: landing.ID,
                });
                Assert(out.Success, `the reopen failed: ${JSON.stringify(out.Issues)}`);

                const after = await stageEvents(ctx, dealID);
                AssertEqual(after.length, afterClose + 1, 'the reopen appends ONE event, not two');
                Assert(
                    typeof after[after.length - 1].Notes === 'string' &&
                        (after[after.length - 1].Notes as string).startsWith('REOPENED:'),
                    'and the surviving row is the REOPEN\'s, carrying its reason',
                );

                const row = await TxOne<{ Probability: number | null; PipelineStageID: string }>(
                    ctx,
                    `SELECT Probability, PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    landing.ID.toLowerCase(),
                    'the deal lands in the stage the reopen named',
                );
                AssertEqual(
                    Number(row.Probability),
                    HAND_SET,
                    'and KEEPS the probability a human set — the arriving stage does not re-derive it on a ' +
                        'declared transition',
                );
            }),
    },
    {
        Id: 'close-deal.CD17',
        Name: 'CD17: the CLOSING status wins over the status the closing stage declares',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE THIRD CASE OF "THE STATUS COMES FROM THE STAGE" ─────────────────────────────
                 *
                 * A stage now declares the deal's status (SD33/SD34), and a close both sets a status AND
                 * may move the stage. If the two writers raced, a close would land whatever the closing
                 * stage happens to declare instead of the outcome the caller asked for — silently, and on
                 * the one transition that is the provenance of a contract.
                 *
                 * They cannot race, and the reason is structural rather than lucky: a DECLARED TRANSITION
                 * suppresses stage defaults entirely, so `planStageDefaults()` is never called on a close.
                 *
                 * THE PAIRING HERE IS DELIBERATELY CONTRADICTORY — closing as LOST into a stage that
                 * declares a WON status. Nobody would do this on purpose, and that is the point: it is the
                 * only shape in which the two writers can be told apart, because on every sane pairing
                 * they agree and the check would pass while proving nothing.
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD17 status source',
                );

                const wonStage = await stageDeclaring(ctx, f.OrderOnlyPolicyPipelineID, 'IsWon = 1');
                Assert(
                    !!wonStage,
                    'the pipeline needs a stage declaring a WON status for this contradiction to be built',
                );

                const reason = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.LossReason WHERE IsActive = 1 AND RequiresNotes = 0
                      ORDER BY DisplayRank`,
                );
                Assert(!!reason?.ID, 'a loss reason that demands no notes is needed');

                const out = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.LostStatusID,
                    ClosingStageID: wonStage!.ID,
                    LossReasonID: String(reason!.ID),
                });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);

                const row = await TxOne<{ DealStatusTypeID: string; PipelineStageID: string }>(
                    ctx,
                    `SELECT DealStatusTypeID, PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(row.DealStatusTypeID).toLowerCase(),
                    f.LostStatusID.toLowerCase(),
                    'the deal lands in the status the CLOSE asked for, not the one its stage declares',
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    wonStage!.ID.toLowerCase(),
                    'and it really is in that stage, so the stage writer was reachable and stood down',
                );
            }),
    },
    {
        Id: 'close-deal.CD18',
        Name: 'CD18: a reopen with NO StageID restores the stage the deal was in before the close',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── DN-18. THE LOG ALREADY HELD THE ANSWER ──────────────────────────────────────────
                 *
                 * The story says a reopened deal returns to its prior stage. `DealStageEvent.FromStageID`
                 * records exactly that and `input.StageID` already existed — the workspace simply never
                 * sent one, so no stage was ever re-entered, `OrderStatusOnEntry` never fired, and a
                 * reopened deal sat pointing at a voided order with nothing on screen saying so.
                 *
                 * Derived in the OPERATION, so an agent, an importer and an API caller get the same
                 * restoration a rep does, and `input.StageID` stays an override rather than a requirement.
                 *
                 * The order assertion is an either/or on purpose, and it is D-OS1: the restored stage's
                 * `OrderStatusOnEntry` is either applied, or the operation SAYS it could not. What must
                 * never happen is silence — a reopened deal whose order neither followed nor complained.
                 */
                const f = await ResolveSalesFixture(ctx);
                const startStage = f.OrderOnlyPolicyStageID;
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, startStage, 'CD18 restore the stage',
                );

                const closing = await otherStage(ctx, f.OrderOnlyPolicyPipelineID, startStage);
                Assert(
                    (await close(ctx, {
                        DealID: dealID,
                        DealStatusTypeID: f.WonStatusID,
                        ClosingStageID: closing.ID,
                    })).Success,
                    'the stage-moving close must succeed',
                );

                const closed = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(closed.PipelineStageID).toLowerCase(),
                    closing.ID.toLowerCase(),
                    'setup: the close moved the stage, which is what gives the reopen something to restore',
                );

                // NO StageID — the whole point. The operation reads it out of the close event.
                const out = await reopen(ctx, { DealID: dealID, Reason: 'CD18: restoring the prior stage.' });
                Assert(out.Success, `the reopen failed: ${JSON.stringify(out.Issues)}`);

                const after = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(after.PipelineStageID).toLowerCase(),
                    startStage.toLowerCase(),
                    'the reopen restores the stage the deal was in BEFORE the close — from FromStageID',
                );

                /**
                 * AND THE ORDER EITHER FOLLOWED OR SAID WHY NOT (D-OS1). Read the restored stage's
                 * declaration and compare; if it does not match, an issue must name it.
                 */
                const restored = await TxOne<{ OrderStatusOnEntry: string | null }>(
                    ctx,
                    `SELECT OrderStatusOnEntry FROM ${SALES_SCHEMA}.PipelineStage WHERE ID = '${startStage}'`,
                );
                if (restored.OrderStatusOnEntry) {
                    const order = await TxOne<{ Status: string }>(
                        ctx,
                        `SELECT o.Status FROM ${ORDERS_SCHEMA}.OrderHeader o
                          JOIN ${SALES_SCHEMA}.Deal d ON d.OrderID = o.ID WHERE d.ID = '${dealID}'`,
                    );
                    const followed =
                        String(order.Status).toLowerCase() === String(restored.OrderStatusOnEntry).toLowerCase();
                    Assert(
                        followed || out.Issues.length > 0,
                        `the restored stage declares '${restored.OrderStatusOnEntry}' and the order is ` +
                            `'${order.Status}' — so the reopen owed a warning and reported none. Silence is ` +
                            'the one outcome D-OS1 forbids',
                    );
                }
            }),
    },
    {
        Id: 'close-deal.CD19',
        Name: 'CD19: after a STATUS-ONLY close there is nothing to restore, and nothing fires',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE OTHER DIRECTION, and it is what makes CD18 safe rather than merely convenient.
                 *
                 * A close with no `ClosingStageID` never moved the stage, so its event holds
                 * `FromStageID === ToStageID`. The reopen therefore derives the stage the deal is ALREADY
                 * in, the order-status writer's own comparison finds no move, and nothing happens. No
                 * special case is needed for this — but if the derivation ever started returning something
                 * else, a reopen would silently relocate a deal that never went anywhere.
                 */
                /**
                 * ── HOW THIS CASE IS REACHED CHANGED, AND THE PROPERTY DID NOT ──────────────────────
                 *
                 * This used to omit `ClosingStageID` and rely on the close leaving the stage alone. That
                 * stopped being true the moment `closingStageForOutcome` landed: a close with no stage now
                 * DERIVES one, which is the entire point of that fix. The check was asserting the absence
                 * of a feature.
                 *
                 * The status-only transition is still perfectly reachable — put the deal IN the stage the
                 * outcome names FIRST, so the derivation resolves to the stage it is already in. Then
                 * `FromStageID === ToStageID`, nothing moved, and nothing may fire. Same property, reached
                 * deliberately instead of by omission, and it stays the direction `M-RO2` cannot fell.
                 *
                 * Moving into that stage with a PLAIN SAVE is only safe because of `SD35`: the stage
                 * declares a locking status, and the defaults writer refuses to derive one. If that guard
                 * regresses, this check's setup closes the deal early and the assertions below say so.
                 */
                const f = await ResolveSalesFixture(ctx);
                const winningStage = await stageDeclaring(ctx, f.OrderOnlyPolicyPipelineID, 'IsWon = 1');
                Assert(!!winningStage, 'the pipeline needs a stage declaring a WON status');
                const startStage = String(winningStage!.ID);

                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD19 nothing to restore',
                );

                const parked = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await parked.Load(dealID), 'the deal loads so it can be parked in the winning stage');
                parked.PipelineStageID = startStage;
                Assert(
                    await parked.Save(),
                    `setup: the plain move must succeed — ${parked.LatestResult?.CompleteMessage ?? ''}`,
                );
                const stillOpen = await TxOne<{ IsOpen: boolean }>(
                    ctx,
                    `SELECT t.IsOpen FROM ${SALES_SCHEMA}.Deal d
                       JOIN ${SALES_SCHEMA}.DealStatusType t ON t.ID = d.DealStatusTypeID
                      WHERE d.ID = '${dealID}'`,
                );
                Assert(
                    stillOpen.IsOpen === true,
                    'setup: a plain move into a closing stage must NOT have closed the deal (SD35)',
                );

                const orderBefore = await TxOne<{ Status: string }>(
                    ctx,
                    `SELECT o.Status FROM ${ORDERS_SCHEMA}.OrderHeader o
                      JOIN ${SALES_SCHEMA}.Deal d ON d.OrderID = o.ID WHERE d.ID = '${dealID}'`,
                );

                // No ClosingStageID: the derivation resolves to the stage the deal is already in.
                Assert(
                    (await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success,
                    'the status-only close must succeed',
                );
                const closed = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(closed.PipelineStageID).toLowerCase(),
                    startStage.toLowerCase(),
                    'setup: the derived stage is the one the deal is already in, so nothing moved',
                );

                const out = await reopen(ctx, { DealID: dealID, Reason: 'CD19: no stage to restore.' });
                Assert(out.Success, `the reopen failed: ${JSON.stringify(out.Issues)}`);

                const after = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(after.PipelineStageID).toLowerCase(),
                    startStage.toLowerCase(),
                    'the deal is where it always was — a derivation that moved it here would be a bug',
                );

                const orderAfter = await TxOne<{ Status: string }>(
                    ctx,
                    `SELECT o.Status FROM ${ORDERS_SCHEMA}.OrderHeader o
                      JOIN ${SALES_SCHEMA}.Deal d ON d.OrderID = o.ID WHERE d.ID = '${dealID}'`,
                );
                AssertEqual(
                    String(orderAfter.Status),
                    String(orderBefore.Status),
                    'and the order was never asked to move, because no stage was entered',
                );
            }),
    },
    {
        Id: 'close-deal.CD20',
        Name: 'CD20: the stage event stamps WHOSE number the amount was, and a later reprice cannot rewrite it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE PROVENANCE OF A CLOSE AMOUNT, WHICH FINANCE COULD NOT RECOVER ───────────────
                 *
                 * `AmountAtTransition` was stamped and its provenance was not. The flag that carries it
                 * lives on `Deal.AmountIsComputed` — a mutable row — so the moment a closed deal was
                 * repriced, the question "was this booking priced by the engine or typed by a person"
                 * became unanswerable for that close. Every historical close was unclassifiable.
                 *
                 * The second half of this check is the part that matters and the part a column on `Deal`
                 * can never satisfy: after the event is written, the deal's own flag is FLIPPED, and the
                 * stamp must not move. That is the difference between a stamp and a join.
                 *
                 * Read through `Get` because the column is registered by an additive migration and the
                 * generated subclass does not carry a typed property for it yet — CodeGen cannot be run
                 * against this database (see the migration header).
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, f.OrderOnlyPolicyStageID, 'CD20 amount provenance',
                );

                // A STATED amount: typed, not priced. That is the interesting case, because it is the one
                // a reader would otherwise trust.
                const stated = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await stated.Load(dealID), 'the open deal loads');
                stated.Amount = 40404;
                stated.AmountIsComputed = false;
                Assert(await stated.Save(), `a stated amount must save — ${stated.LatestResult?.CompleteMessage ?? ''}`);

                Assert(
                    (await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success,
                    'the close must succeed',
                );

                const event = await TxOne<{ AmountAtTransition: number; Provenance: boolean | null }>(
                    ctx,
                    `SELECT TOP 1 AmountAtTransition, AmountAtTransitionIsComputed AS Provenance
                       FROM ${SALES_SCHEMA}.DealStageEvent
                      WHERE DealID = '${dealID}' ORDER BY ChangedAt DESC`,
                );
                AssertEqual(Number(event.AmountAtTransition), 40404, 'the amount is stamped');
                AssertEqual(
                    event.Provenance === true,
                    false,
                    'and it is stamped as NOT engine-priced — a stated figure recorded as stated',
                );
                Assert(
                    event.Provenance !== null,
                    'and NOT null: null means "written before this was tracked", which a close made now ' +
                        'is not',
                );

                /**
                 * NOW REPRICE THE DEAL, which is what made this unrecoverable before. The deal is closed
                 * and locked, so this goes through the sanctioned reopen rather than around the lock.
                 */
                Assert(
                    (await reopen(ctx, { DealID: dealID, Reason: 'CD20: reprice after the close.' })).Success,
                    'the reopen must succeed',
                );
                const repriced = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await repriced.Load(dealID), 'the reopened deal loads');
                repriced.AmountIsComputed = true;
                repriced.Amount = 99999;
                Assert(await repriced.Save(), `the reprice must save — ${repriced.LatestResult?.CompleteMessage ?? ''}`);

                const after = await TxOne<{ AmountAtTransition: number; Provenance: boolean | null }>(
                    ctx,
                    `SELECT TOP 1 AmountAtTransition, AmountAtTransitionIsComputed AS Provenance
                       FROM ${SALES_SCHEMA}.DealStageEvent
                      WHERE DealID = '${dealID}' AND ToDealStatusTypeID = '${f.WonStatusID}'
                      ORDER BY ChangedAt DESC`,
                );
                AssertEqual(
                    Number(after.AmountAtTransition),
                    40404,
                    'the CLOSE event still holds the amount as it was — provenance is pen, not pencil',
                );
                AssertEqual(
                    after.Provenance === true,
                    false,
                    'and still says a person stated it, though the deal now says otherwise. This is the ' +
                        'whole reason the flag cannot live on Deal',
                );
            }),
    },
    {
        Id: 'close-deal.CD21',
        Name: 'CD21: close-won tasks carry a DUE DATE, computed from the close',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * Every task this app has ever raised had a NULL due date, because `CloseWonTaskService`
                 * accepts `DueAt` and the operation never supplied one. Tasks already ships `Task.DueAt`,
                 * `IsOverdue`, an Overdue KPI and an `OnOverdue` hook — all of it inert for our rows.
                 *
                 * Asserted as a REAL DATE at the expected offset rather than merely non-null, because
                 * "non-null" is what orders' own overdue worklist had when it reported one month overdue
                 * as 46,264 days. A due-date feature that has never seen a real date is untested by
                 * construction.
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID ?? f.OrderOnlyPolicyPipelineID,
                    f.ContractPolicyStageID ?? f.OrderOnlyPolicyStageID, 'CD21 task due dates',
                );

                const out = await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);

                const tasks = await TxAll<{ Name: string; DueAt: string | null; ClosedAt: string }>(
                    ctx,
                    `SELECT t.Name, CONVERT(varchar(33), t.DueAt, 126) AS DueAt,
                            CONVERT(varchar(33), d.ClosedAt, 126) AS ClosedAt
                       FROM ${TASKS_SCHEMA}.Task t
                       JOIN ${TASKS_SCHEMA}.TaskLink tl ON tl.TaskID = t.ID
                       JOIN ${SALES_SCHEMA}.Deal d ON d.ID = '${dealID}'
                      WHERE tl.RecordID IN ('${dealID}', CAST(ISNULL(
                                (SELECT CAST(OrderID AS NVARCHAR(50)) FROM ${SALES_SCHEMA}.Deal
                                  WHERE ID = '${dealID}'), '${dealID}') AS NVARCHAR(50)))`,
                );
                Assert(tasks.length > 0, 'the close must raise at least one task for this to say anything');

                for (const t of tasks) {
                    Assert(
                        !!t.DueAt,
                        `"${t.Name}" has a NULL due date — every downstream due-date feature is inert for it`,
                    );
                    const due = new Date(String(t.DueAt));
                    const closed = new Date(String(t.ClosedAt));
                    /**
                     * ── AN EXACT OFFSET, NOT A PLAUSIBLE RANGE. THE RANGE WAS THE BUG ───────────────
                     *
                     * This first asserted `days >= 0 && days <= 60`, and mutant `M-DA2` — which replaces
                     * the date arithmetic with `closedAt.getTime() + days`, adding the offset as
                     * MILLISECONDS — sailed straight through it: five milliseconds after the close rounds
                     * to 0 days, and 0 satisfies `>= 0`. The check was written to guard exactly that class
                     * of error (orders' overdue worklist reporting one month as 46,264 days) and would not
                     * have caught it.
                     *
                     * The offset is compared to `DEFAULT_DUE_IN_DAYS` because this fixture configures no
                     * `DueInDays`, so the default is the contract. A range cannot distinguish a wrong unit
                     * from a right one; an equality can.
                     */
                    /**
                     * BOTH SIDES TRUNCATED TO UTC MIDNIGHT BEFORE DIFFERENCING, and the first version of
                     * this line was wrong in the way the fix's own comment warns about: `DueAt` is a
                     * midnight DATE while `ClosedAt` is a full timestamp, so subtracting them lost the
                     * afternoon and a five-day offset measured as four. The check had the day-arithmetic
                     * bug it was written to catch.
                     */
                    const closedMidnight = Date.UTC(
                        closed.getUTCFullYear(), closed.getUTCMonth(), closed.getUTCDate(),
                    );
                    const days = Math.round((due.getTime() - closedMidnight) / 86_400_000);
                    AssertEqual(
                        days,
                        DEFAULT_DUE_IN_DAYS,
                        `"${t.Name}" is due ${days} days after the close, not ${DEFAULT_DUE_IN_DAYS} — ` +
                            'either the offset changed or the arithmetic is in the wrong unit',
                    );
                    // And the date is a real UTC midnight, like Deal.ActualCloseDate. A time component
                    // makes "due today" depend on the reader's timezone.
                    AssertEqual(
                        due.getUTCHours() + due.getUTCMinutes() + due.getUTCSeconds(),
                        0,
                        `"${t.Name}" carries a time of day, so "due today" is timezone-dependent`,
                    );
                }
            }),
    },
    {
        Id: 'close-deal.CD22',
        Name: 'CD22: a close with NO ClosingStageID still moves into the stage its outcome names',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE OTHER HALF OF DN-18, AND WHAT MAKES CD18 REACHABLE FROM A BROWSER ───────────
                 *
                 * `ConfirmClose()` sends no `ClosingStageID`, so before this every browser-driven close
                 * left the stage where it was, every close event recorded `FromStageID === ToStageID`, and
                 * the reopen had nothing to restore. `CD18` proved a mechanism the UI could not reach.
                 *
                 * The stage is resolved by the FLAG its status carries, so this passes on a pipeline that
                 * calls its winning stage anything at all — which is why the expectation below is computed
                 * the same way rather than hardcoded.
                 */
                const f = await ResolveSalesFixture(ctx);
                const start = f.OrderOnlyPolicyStageID;
                const expected = await stageDeclaring(ctx, f.OrderOnlyPolicyPipelineID, 'IsWon = 1');
                Assert(!!expected, 'the pipeline needs a stage declaring a WON status');
                Assert(
                    String(expected!.ID).toLowerCase() !== start.toLowerCase(),
                    'setup: the deal must not already be in the winning stage, or nothing is proven',
                );

                const dealID = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, start, 'CD22 derived closing stage',
                );
                Assert(
                    (await close(ctx, { DealID: dealID, DealStatusTypeID: f.WonStatusID })).Success,
                    'the close must succeed',
                );

                const row = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${dealID}'`,
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    String(expected!.ID).toLowerCase(),
                    'the close lands in the stage its OUTCOME names, with no ClosingStageID supplied',
                );

                // And the event records a real move, which is what gives the reopen something to restore.
                const ev = await TxOne<{ FromStageID: string; ToStageID: string }>(
                    ctx,
                    `SELECT TOP 1 FromStageID, ToStageID FROM ${SALES_SCHEMA}.DealStageEvent
                      WHERE DealID = '${dealID}' ORDER BY ChangedAt DESC`,
                );
                AssertEqual(
                    String(ev.FromStageID).toLowerCase(), start.toLowerCase(),
                    'the event records the stage it came FROM — this is what CD18 reads',
                );
                Assert(
                    String(ev.ToStageID).toLowerCase() !== String(ev.FromStageID).toLowerCase(),
                    'and From differs from To, so this was a real transition rather than a self-move',
                );
            }),
    },
    {
        Id: 'close-deal.CD24',
        Name: 'CD24: a BOOKED order refuses the reopen; a confirmed-then-VOIDED one does not (DN-20)',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── DN-20, AND BOTH DIRECTIONS ARE THE POINT ────────────────────────────────────
                 *
                 * Finance asked for a reopen to be refused outright once the order has booked, because
                 * the ledger has moved and editing the deal behind a live receivable is not the
                 * instrument. The refusal reads orders' own `IsBooked` -- `Confirmed | Posted |
                 * Fulfilled` -- rather than either obvious alternative, and this check exists because
                 * BOTH alternatives fail one half of it:
                 *
                 *   `Status === 'Confirmed'` passes half A and FAILS half B only by luck; it also
                 *   under-blocks `Posted`/`Fulfilled`, which this check's half A would still catch if
                 *   the fixture advanced further. It is a vocabulary string-compare besides.
                 *
                 *   `ConfirmedAt IS NOT NULL` passes half A and FAILS HALF B OUTRIGHT. That is the
                 *   assertion below that earns its keep: the voided order still carries `ConfirmedAt`,
                 *   so a timestamp test refuses a reopen that must be allowed.
                 *
                 * A later "simplification" to either one goes red here rather than in production.
                 */
                const f = await ResolveSalesFixture(ctx);
                const startStage = f.OrderOnlyPolicyStageID;

                /* ── HALF A: booked refuses ──────────────────────────────────────────────────── */
                const bookedDeal = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, startStage, 'CD24 booked order refuses',
                );
                Assert(
                    (await close(ctx, { DealID: bookedDeal, DealStatusTypeID: f.WonStatusID })).Success,
                    'setup: the close must succeed, or there is nothing to reopen',
                );

                const bookedOrder = await TxOne<{ ID: string; OrderNumber: string }>(
                    ctx,
                    `SELECT o.ID, o.OrderNumber FROM ${ORDERS_SCHEMA}.OrderHeader o
                      JOIN ${SALES_SCHEMA}.Deal d ON d.OrderID = o.ID WHERE d.ID = '${bookedDeal}'`,
                );
                await TxExec(
                    ctx,
                    `UPDATE ${ORDERS_SCHEMA}.OrderHeader
                        SET Status = 'Confirmed', ConfirmedAt = SYSDATETIMEOFFSET()
                      WHERE ID = '${bookedOrder.ID}'`,
                    'CD24: book the order',
                );

                const refused = await reopen(
                    ctx, { DealID: bookedDeal, Reason: 'CD24: attempting a reopen behind a booked order.' },
                );
                Assert(refused.Success === false, 'a reopen behind a BOOKED order must be refused');
                Assert(refused.Unlocked === false, 'and the deal must stay locked');
                Assert(
                    refused.Issues.some((i) => /booked/i.test(i.Message ?? '')),
                    `the refusal must say the order has booked — got ${JSON.stringify(refused.Issues)}`,
                );
                /**
                 * The order NUMBER, not its id. A rep cannot act on a UUID, and naming the order is the
                 * whole of the handoff this message is allowed to make.
                 */
                Assert(
                    refused.Issues.some((i) => (i.Message ?? '').includes(bookedOrder.OrderNumber)),
                    `the refusal must name the order — got ${JSON.stringify(refused.Issues)}`,
                );
                /**
                 * AND IT MUST NOT PRESCRIBE AN INSTRUMENT. The remedy differs by status and belongs to
                 * orders; sales narrating another app's workflow is worse than an honest handoff.
                 */
                Assert(
                    !refused.Issues.some((i) => /\b(void|reversing|credit note|change order)\b/i.test(i.Message ?? '')),
                    `the refusal must not name an orders instrument — got ${JSON.stringify(refused.Issues)}`,
                );
                const stillClosed = await TxOne<{ n: number }>(
                    ctx,
                    `SELECT COUNT(*) AS n FROM ${SALES_SCHEMA}.Deal d
                       JOIN ${SALES_SCHEMA}.DealStatusType st ON st.ID = d.DealStatusTypeID
                      WHERE d.ID = '${bookedDeal}' AND st.IsOpen = 1`,
                );
                AssertEqual(Number(stillClosed.n), 0, 'and the deal was not reopened behind the refusal');


                /* ── HALF B: confirmed-then-voided does NOT refuse ───────────────────────────── */
                const voidedDeal = await openDeal(
                    ctx, f, f.OrderOnlyPolicyPipelineID, startStage, 'CD24 voided order allows',
                );
                Assert(
                    (await close(ctx, { DealID: voidedDeal, DealStatusTypeID: f.WonStatusID })).Success,
                    'setup: the second close must succeed too',
                );

                const voidedOrder = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT o.ID FROM ${ORDERS_SCHEMA}.OrderHeader o
                      JOIN ${SALES_SCHEMA}.Deal d ON d.OrderID = o.ID WHERE d.ID = '${voidedDeal}'`,
                );
                /**
                 * CONFIRMED FIRST, THEN VOIDED -- and `ConfirmedAt` is left standing, because that is
                 * exactly what a real confirm-then-void leaves behind. It is what makes this half a
                 * test of `IsBooked` rather than of the timestamp.
                 */
                await TxExec(
                    ctx,
                    `UPDATE ${ORDERS_SCHEMA}.OrderHeader
                        SET Status = 'Voided', ConfirmedAt = SYSDATETIMEOFFSET()
                      WHERE ID = '${voidedOrder.ID}'`,
                    'CD24: confirm then void the order',
                );
                const carried = await TxOne<{ ConfirmedAt: string | null; Status: string }>(
                    ctx,
                    `SELECT ConfirmedAt, Status FROM ${ORDERS_SCHEMA}.OrderHeader WHERE ID = '${voidedOrder.ID}'`,
                );
                Assert(
                    !!carried.ConfirmedAt,
                    'setup: the voided order must still carry ConfirmedAt, or half B proves nothing',
                );
                AssertEqual(String(carried.Status), 'Voided', 'setup: and it must be Voided');

                const allowed = await reopen(
                    ctx, { DealID: voidedDeal, Reason: 'CD24: reopening behind a voided order.' },
                );
                Assert(
                    allowed.Success,
                    'a reopen behind a CONFIRMED-THEN-VOIDED order must be ALLOWED — the reversal is its '
                        + `own record, so that ledger is settled. Got ${JSON.stringify(allowed.Issues)}`,
                );
                const reopened = await TxOne<{ n: number }>(
                    ctx,
                    `SELECT COUNT(*) AS n FROM ${SALES_SCHEMA}.Deal d
                       JOIN ${SALES_SCHEMA}.DealStatusType st ON st.ID = d.DealStatusTypeID
                      WHERE d.ID = '${voidedDeal}' AND st.IsOpen = 1`,
                );
                AssertEqual(Number(reopened.n), 1, 'and the deal really is open again');

                /**
                 * ── THE PINS RUN LAST, AND THAT ORDERING IS LOAD-BEARING ────────────────────────
                 *
                 * They used to sit between the halves, where a stale host aborted the check before half
                 * B ever ran. That is the worst possible placement: the DN-20 protection silently stops
                 * working on exactly the hosts that are behind, and the check still reports red, so
                 * nothing looks wrong. Proven on 2026-08-28 — with the refusal mutated to the
                 * `ConfirmedAt IS NOT NULL` shortcut this check exists to catch, CD24 failed on the host
                 * message and never reached the half that catches it.
                 *
                 * Behaviour first, environment second. A stale host now still gets the full DN-20
                 * verdict, and only then hears that its migrations are outstanding.
                 */
                /**
                 * ── THE `Posted` STEP THAT USED TO BE HERE IS GONE, AND ITS ABSENCE IS NOW ASSERTED ──
                 *
                 * This used to advance the same order to `Posted` and demand the refusal again, killing the
                 * "just simplify IsBooked to status === 'Confirmed'" shortcut. Orders has since COLLAPSED the
                 * lifecycle: `CK_OrderHeader_Status` permits only Draft | Quoted | Confirmed | Voided,
                 * fulfillment moved to its own `FulfillmentStatus` column, and orders' `IsBooked` on `next` is
                 * now literally `status === 'Confirmed'`. The shortcut became the design. See KI-27.
                 *
                 * Writing 'Posted' here now violates the CHECK constraint outright, which is how this surfaced —
                 * as a bare "Error executing SQL" on a fresh all-`next` install.
                 *
                 * Rather than delete the intent, it is INVERTED: pin the collapse. If orders ever re-expands the
                 * lifecycle this fails and names the assertion to restore — the only way a check removed because
                 * of a design change survives that design change being undone.
                 *
                 * ── WHAT THE PIN READS, AND WHY IT MOVED OFF THE CHECK CONSTRAINT ──────────────────
                 *
                 * It used to read `CK_OrderHeader_Status` out of `sys.check_constraints` and fail if the
                 * definition still mentioned Posted or Fulfilled. That conflated TWO different facts, and
                 * on 2026-08-28 it reported the wrong one: it announced "orders has RE-EXPANDED" against a
                 * host whose orders migrations simply stopped at V202608141800, ten days short of the
                 * V202608241300 collapse. Orders had not re-expanded anything; the DATABASE was stale.
                 *
                 * A check that names the wrong cause is worse than one that stays silent — the message is
                 * what the next person acts on, and this one sent them to restore an assertion that was
                 * already correctly absent.
                 *
                 * So the two facts are now separated and each is asserted where it actually lives:
                 *
                 *   THE DESIGN lives in orders' CODE. `IsBooked` is the thing the removed Posted step was
                 *   defending, so the pin reads `IsBooked` directly against orders' own `ORDER_STATUSES`.
                 *   One booked status means the equality shortcut IS the design and the step stays gone;
                 *   more than one means it must come back. This travels with the linked package, so it is
                 *   true of the orders being tested rather than of whatever the host was last migrated to.
                 *
                 *   THE HOST'S CURRENCY lives in the database, and is a separate failure with a separate
                 *   remedy. A constraint permitting statuses orders' code does not know means migrations
                 *   are outstanding, and the message says so instead of blaming a design change.
                 */
                const bookedStatuses = ORDER_STATUSES.filter((s) => IsBooked(s));
                Assert(
                    bookedStatuses.length > 0,
                    'CD24: orders recognises NO booked status, so half A cannot mean what it claims — '
                        + `ORDER_STATUSES = ${JSON.stringify(ORDER_STATUSES)}`,
                );
                Assert(
                    bookedStatuses.length === 1,
                    `orders now recognises ${bookedStatuses.length} BOOKED statuses (${bookedStatuses.join(', ')}), `
                        + 'so the lifecycle has re-expanded. Restore the "advance past Confirmed" assertion '
                        + 'removed here — with more than one booked status, IsBooked can be narrowed to an '
                        + 'equality test again and nothing else in this check would catch it.',
                );

                const statusRule = await TxOne<{ definition: string }>(
                    ctx,
                    `SELECT cc.definition FROM sys.check_constraints cc
                       JOIN sys.tables t  ON t.object_id = cc.parent_object_id
                       JOIN sys.schemas s ON s.schema_id = t.schema_id
                      WHERE s.name = '${ORDERS_SCHEMA}' AND t.name = 'OrderHeader'
                        AND cc.definition LIKE '%[[]Status]%'`,
                );
                Assert(
                    /Confirmed/.test(statusRule?.definition ?? ''),
                    'CD24: could not read the OrderHeader Status rule, so the host check below would pass '
                        + `vacuously — got ${JSON.stringify(statusRule)}`,
                );
                /**
                 * The literals the constraint actually permits, compared against what orders' code knows.
                 * Extracted rather than pattern-matched for specific words so a status nobody predicted is
                 * caught too — the previous version only looked for Posted and Fulfilled by name.
                 */
                const permitted = [...statusRule.definition.matchAll(/'([^']+)'/g)].map((m) => m[1]);
                const unknown = permitted.filter((s) => !(ORDER_STATUSES as readonly string[]).includes(s));
                Assert(
                    unknown.length === 0,
                    `this host's CK_OrderHeader_Status permits ${JSON.stringify(unknown)}, which orders' code `
                        + `does not list in ORDER_STATUSES (${JSON.stringify(ORDER_STATUSES)}). The DATABASE is `
                        + 'behind orders\' migrations — apply them — rather than orders having re-expanded the '
                        + 'lifecycle. Do NOT restore the "advance past Confirmed" assertion for this.',
                );
            }),
    },
    {
        Id: 'close-deal.CD25',
        Name: 'CD25: a PREVIEW does not report a failure for a route nothing has attempted',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE FIRST THING A TESTER SAW WAS A FAILURE THAT HAD NOT HAPPENED ──────────
                 *
                 * `execute()` does not run until AFTER the preview returns, so in preview `Executed` is
                 * false on every route BY CONSTRUCTION. The issue builder filtered on
                 * `Planned && !Executed`, so every B2B preview reported
                 * "Contract was planned but not created: no reason given" — a failure message for
                 * something nobody had attempted, on the first click of manual testing.
                 *
                 * The fix is not to go quiet in preview. A preview must still say what it plans, and it
                 * does: `Routing` carries the plan and is asserted here alongside the absence of the
                 * false failure. `Issues` is the channel for what is WRONG, and its severity union is
                 * `'error' | 'warning'` with no informational level, so a plan does not belong in it.
                 *
                 * BOTH HALVES MATTER. Asserting only "no issues" would pass a version that had simply
                 * stopped reporting routes at all, which is the other way to be wrong here.
                 */
                const f = await ResolveSalesFixture(ctx);
                const dealID = await openDeal(
                    ctx, f, f.ContractPolicyPipelineID, f.ContractPolicyStageID, 'CD25 preview no false failure',
                    twoInstalments(),
                );

                const out = await close(ctx, {
                    DealID: dealID,
                    DealStatusTypeID: f.WonStatusID,
                    PreviewOnly: true,
                });

                Assert(out.Success, `the preview failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.WasPreview, 'and says it was a preview');

                // THE PLAN IS STILL REPORTED  — this is what stops the fix being "suppress everything".
                const contractRoute = out.Routing.find((r) => r.Target === 'Contract');
                Assert(
                    !!contractRoute && contractRoute.Planned === true,
                    `a contract-creating policy must still PLAN a Contract route in preview — ${JSON.stringify(out.Routing)}`,
                );
                Assert(
                    contractRoute!.Executed !== true,
                    'and must not claim it executed, because a preview executes nothing',
                );

                // AND NO FAILURE IS CLAIMED for it.
                const falseFailures = out.Issues.filter(
                    (i) => i.Message.includes('was planned but not created'),
                );
                AssertEqual(
                    falseFailures.length,
                    0,
                    'a preview must not report a route as FAILED when nothing has been attempted yet — '
                        + `saw ${JSON.stringify(falseFailures.map((i) => i.Message))}`,
                );

                // Belt and braces: nothing at all should mention the contract as not created.
                Assert(
                    !out.Issues.some((i) => i.Message.includes('no reason given')),
                    `"no reason given" is the tell of a route reported before it was tried — ${JSON.stringify(out.Issues)}`,
                );
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
