/**
 * @fileoverview The reference data every sales check reads, plus the transaction discipline that makes
 * the suite re-runnable.
 *
 * ── ISOLATION MODEL ─────────────────────────────────────────────────────────────────────────────
 *
 * Every mutating check runs inside its own provider transaction and **ROLLS BACK**, so deals, lines,
 * instalments and team members never reach disk. Teardown is therefore nothing at all, and a mid-run
 * crash leaves the database exactly as it was. Copied from bizapps-orders, which validated the model —
 * including that the nesting works: `DealEntityServer.Save` opens one for the deal number inside the
 * check's, and the save graph opens one inside that, so a check is up to three savepoints deep.
 *
 * ── IT DISCOVERS ITS FIXTURE RATHER THAN CREATING ONE ───────────────────────────────────────────
 *
 * Orders builds a catalog because it needs products with prices in exact shapes. Sales needs a pipeline
 * with stages, the vocabulary rows and one employee — all of which `scripts/seed-dev-data.sh` and
 * `scripts/seed-demo-data.sh` already create, and which are the same rows a developer clicks through in
 * Explorer. Discovering them has the safest possible teardown (there is none) and means a check failure
 * is about the save path rather than about fixture construction.
 *
 * The cost is a real precondition: the seeds must have been run. {@link ResolveSalesFixture} therefore
 * fails with an instruction rather than a null-reference twelve frames deep.
 *
 * ── THE ONE RULE ────────────────────────────────────────────────────────────────────────────────
 *
 * **Every query goes through the PROVIDER, never `ctx.Pool`.** Two independent reasons, either
 * sufficient — both learned by orders the hard way:
 *   1. The pool is a DIFFERENT connection. Under READ COMMITTED it BLOCKS on the open check
 *      transaction's write locks until the request times out.
 *   2. `ctx.Pool` is only populated when the driver owned the bootstrap. Under `mj test` the CLI
 *      installs its instrumented cache first, so it arrives `undefined`.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { DatabaseProviderBase, RunView, type IMetadataProvider } from '@memberjunction/core';
import { Assert, type IntegrationCheckContext } from '@memberjunction/testing-integration';

export const SALES_SCHEMA = '__mj_BizAppsSales';

export const E_DEAL = 'MJ_BizApps_Sales: Deals';
export const E_SCHEDULE = 'MJ_BizApps_Sales: Deal Payment Schedules';
export const E_TEAM = 'MJ_BizApps_Sales: Deal Team Members';
export const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
export const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
export const E_DEAL_TYPE = 'MJ_BizApps_Sales: Deal Types';
export const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';
export const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
export const E_EMPLOYEE = 'MJ: Employees';
export const E_STAGE_EVENT = 'MJ_BizApps_Sales: Deal Stage Events';
export const E_LOSS_REASON = 'MJ_BizApps_Sales: Loss Reasons';

/** The rows the checks build payloads from. All discovered, none created. */
export interface SalesFixture {
    PipelineID: string;
    PipelineCompanyID: string;
    StageID: string;
    DealTypeID: string;
    OpenStatusID: string;
    /*
     * RecurringLineTypeID / OneTimeLineTypeID WERE HERE, and their removal is the point rather than
     * tidying. `DealLineType` is retired (docs/DECISIONS.md D-DL1), so `one()` could not find a row --
     * and `one()` THROWS. Because every bundle resolves this ONE SHARED FIXTURE, two lookups nothing
     * needed any more took the whole suite down: all 14 close-deal checks failed on a host where
     * close-deal itself was perfectly fine.
     *
     * Worth remembering when adding a field here. A fixture that throws is not a failing check; it is
     * every check failing for a reason none of them are about.
     */
    AccountID: string;
    EmployeeID: string;

    /* ── The close flow (§7) ─────────────────────────────────────────────────────────────────────
     *
     * Every one of these is resolved by a FLAG or by the pipeline's POLICY, never by a name. That is
     * the vocabulary rule applied to test code: a check that looked up `Name = 'Won'` would keep
     * passing after somebody renamed the row while quietly testing nothing, and a check that looked up
     * `Name = 'B2B'` would be asserting the very coupling the close flow exists to avoid.
     */

    /** The winning status, by `IsWon`. It also locks — that is what makes CD3 possible. */
    WonStatusID: string;
    /** The losing status, by `IsLost`. */
    LostStatusID: string;
    /** A NON-locking, non-open status (`On Hold` as seeded) — used to prove the lock is flag-driven. */
    UnlockedNonOpenStatusID: string | null;

    /** The pipeline whose `CloseWonPolicy` says `CreateContract: true`. B2B, as seeded. */
    ContractPolicyPipelineID: string;
    ContractPolicyStageID: string;
    /** The contract pipeline's OWN company — products are per-company, as above. */
    ContractPolicyCompanyID: string;
    /** The pipeline whose policy does NOT create a contract. D2C, as seeded. */
    OrderOnlyPolicyPipelineID: string;
    OrderOnlyPolicyStageID: string;
    /**
     * The order-only pipeline's OWN company — which is NOT the same company as the contract pipeline's.
     *
     * It has to be carried separately because products are per-company: a deal seeded on the order-only
     * pipeline must pick products from THAT company's catalogue, or the picker's own filter returns
     * nothing and the seed fails for a reason that has nothing to do with the path under test.
     */
    OrderOnlyPolicyCompanyID: string;

    /** A loss reason that does NOT require notes, by `RequiresNotes = 0`. */
    LossReasonPlainID: string;
    /** A loss reason that DOES require notes, by `RequiresNotes = 1`. */
    LossReasonNeedsNotesID: string;
}

let cached: SalesFixture | null = null;

/** Reads one row via the provider, or throws with a message that says what to do about it. */
async function one<T extends Record<string, unknown>>(
    ctx: IntegrationCheckContext,
    entity: string,
    filter: string,
    fields: string[],
    what: string,
    /**
     * Optional, and every caller that takes "the first" of several rows should pass it. Without an
     * ORDER BY, `Results[0]` is whatever the server returned — see `firstStageOf`, where that decided
     * whether a whole assertion was reachable. Callers filtering to exactly one row do not need it.
     */
    orderBy?: string,
): Promise<T> {
    const rv = new RunView();
    const result = await rv.RunView<T>(
        { EntityName: entity, ExtraFilter: filter, ResultType: 'simple', Fields: fields, OrderBy: orderBy },
        ctx.User,
    );
    Assert(result.Success, `fixture: reading ${entity} failed — ${result.ErrorMessage}`);
    const row = (result.Results ?? [])[0];
    Assert(
        !!row,
        `fixture: no ${what} found (${entity} where ${filter}). Run scripts/seed-dev-data.sh and ` +
            `scripts/seed-demo-data.sh first — this suite discovers its fixture rather than creating one.`,
    );
    return row as T;
}

/**
 * Resolves the fixture once per process.
 *
 * NOTE the two line-type lookups filter on `IsRecurring`, not on a code or a name. That is the
 * vocabulary rule applied to test code as well as product code: a suite that looked up
 * `Code = 'RECURRING'` would keep passing after somebody renamed the row and stop testing what it
 * claims to.
 */
export async function ResolveSalesFixture(ctx: IntegrationCheckContext): Promise<SalesFixture> {
    if (cached) {
        return cached;
    }

    const pipeline = await one<{ ID: string; CompanyID: string }>(
        // ORDERED, per this helper's own rule: "every caller that takes the first of several rows
        // should pass it". It mattered less when checks only needed A pipeline. #32's TS5 and TS6 both
        // need the fixture's company to own a product with a SubscriptionTypeID, and on the seeded host
        // exactly one of the two active pipelines' companies does — so unordered, they pass or fail by
        // luck of plan choice.
        ctx, E_PIPELINE, 'IsActive = 1', ['ID', 'CompanyID'], 'active pipeline', 'Name ASC',
    );
    const stage = await one<{ ID: string }>(
        ctx, E_STAGE, `PipelineID = '${pipeline.ID}' AND IsActive = 1`, ['ID'], 'stage on that pipeline',
    );
    const dealType = await one<{ ID: string }>(ctx, E_DEAL_TYPE, 'IsActive = 1', ['ID'], 'deal type');
    const openStatus = await one<{ ID: string }>(
        ctx, E_STATUS_TYPE, 'IsOpen = 1 AND IsActive = 1', ['ID'], 'OPEN deal status (by IsOpen flag)',
    );
    const account = await one<{ ID: string }>(ctx, E_ACCOUNT, 'IsActive = 1', ['ID'], 'sales account');
    const employee = await one<{ ID: string }>(ctx, E_EMPLOYEE, 'Active = 1', ['ID'], 'active employee');

    const wonStatus = await one<{ ID: string }>(
        ctx, E_STATUS_TYPE, 'IsWon = 1 AND IsActive = 1', ['ID'], 'WON deal status (by IsWon flag)',
    );
    const lostStatus = await one<{ ID: string }>(
        ctx, E_STATUS_TYPE, 'IsLost = 1 AND IsActive = 1', ['ID'], 'LOST deal status (by IsLost flag)',
    );
    const lossPlain = await one<{ ID: string }>(
        ctx, E_LOSS_REASON, 'RequiresNotes = 0 AND IsActive = 1', ['ID'], 'loss reason not requiring notes',
    );
    const lossNeedsNotes = await one<{ ID: string }>(
        ctx, E_LOSS_REASON, 'RequiresNotes = 1 AND IsActive = 1', ['ID'], 'loss reason REQUIRING notes',
    );

    const { withContract, withoutContract } = await resolvePipelinesByPolicy(ctx);

    cached = {
        PipelineID: pipeline.ID,
        PipelineCompanyID: pipeline.CompanyID,
        StageID: stage.ID,
        DealTypeID: dealType.ID,
        OpenStatusID: openStatus.ID,
        AccountID: account.ID,
        EmployeeID: employee.ID,

        WonStatusID: wonStatus.ID,
        LostStatusID: lostStatus.ID,
        UnlockedNonOpenStatusID: await optionalStatusID(ctx, 'IsOpen = 0 AND LocksDeal = 0 AND IsActive = 1'),

        ContractPolicyPipelineID: withContract.ID,
        ContractPolicyStageID: withContract.StageID,
        ContractPolicyCompanyID: withContract.CompanyID,
        OrderOnlyPolicyPipelineID: withoutContract.ID,
        OrderOnlyPolicyStageID: withoutContract.StageID,
        OrderOnlyPolicyCompanyID: withoutContract.CompanyID,

        LossReasonPlainID: lossPlain.ID,
        LossReasonNeedsNotesID: lossNeedsNotes.ID,
    };
    return cached;
}

/** A status that may legitimately not be seeded. Returns null rather than failing the whole fixture. */
async function optionalStatusID(ctx: IntegrationCheckContext, filter: string): Promise<string | null> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string }>(
        { EntityName: E_STATUS_TYPE, ExtraFilter: filter, ResultType: 'simple', Fields: ['ID'] },
        ctx.User,
    );
    return r.Success ? ((r.Results ?? [])[0]?.ID ?? null) : null;
}

/**
 * The two pipelines the routing checks need, chosen by what their POLICY SAYS.
 *
 * This is the part of the fixture most worth reading. The seeded pipelines happen to be called "B2B" and
 * "D2C", and picking them by those names would be the easiest thing to write — and would make the whole
 * routing bundle a lie, because the property under test is precisely that routing follows
 * `CloseWonPolicy` and not the pipeline's name. So the fixture parses the policy and picks the pipeline
 * that CREATES A CONTRACT versus the one that does not. Rename both pipelines to "Left" and "Right" and
 * every routing check still passes, which is the whole point.
 */
async function resolvePipelinesByPolicy(
    ctx: IntegrationCheckContext,
): Promise<{ withContract: PolicyPipeline; withoutContract: PolicyPipeline }> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string; CompanyID: string; CloseWonPolicy: string | null }>(
        {
            EntityName: E_PIPELINE,
            ExtraFilter: 'IsActive = 1',
            ResultType: 'simple',
            Fields: ['ID', 'CompanyID', 'CloseWonPolicy'],
        },
        ctx.User,
    );
    Assert(r.Success, `fixture: reading pipelines failed — ${r.ErrorMessage}`);

    let withContract: PolicyPipeline | null = null;
    let withoutContract: PolicyPipeline | null = null;

    for (const row of r.Results ?? []) {
        const creates = policyCreatesContract(row.CloseWonPolicy);
        if (creates && !withContract) {
            withContract = { ID: row.ID, CompanyID: row.CompanyID, StageID: await firstStageOf(ctx, row.ID) };
        } else if (!creates && !withoutContract) {
            withoutContract = { ID: row.ID, CompanyID: row.CompanyID, StageID: await firstStageOf(ctx, row.ID) };
        }
    }

    Assert(
        !!withContract && !!withoutContract,
        'fixture: the close-flow checks need TWO active pipelines — one whose CloseWonPolicy sets ' +
            '"CreateContract": true and one that does not. Run scripts/seed-dev-data.sh, which seeds both.',
    );
    return { withContract: withContract as PolicyPipeline, withoutContract: withoutContract as PolicyPipeline };
}

interface PolicyPipeline {
    ID: string;
    CompanyID: string;
    StageID: string;
}

/** A pipeline with no policy, or an unparseable one, routes nothing — so it counts as "no contract". */
function policyCreatesContract(raw: string | null): boolean {
    if (!raw) {
        return false;
    }
    try {
        return (JSON.parse(raw) as { CreateContract?: boolean }).CreateContract === true;
    } catch {
        return false;
    }
}

/**
 * The FIRST stage of a pipeline — and "first" now means something.
 *
 * ── IT SELECTED WITH NO ORDER BY AND TOOK Results[0] ───────────────────────────────────────────
 *
 * Which row that is, is whatever the server felt like returning. Every check that starts a deal from
 * `ContractPolicyStageID` or `OrderOnlyPolicyStageID` therefore began somewhere non-deterministic, and
 * a check whose outcome depends on WHICH stage it started in could pass and fail on the same code.
 *
 * That is not hypothetical here: `PipelineStage.OrderStatusOnEntry` is NULL on the low-numbered stages
 * of both seeded pipelines and set on later ones, so an unordered pick decides whether the
 * order-follows-stage behaviour is even reachable. `close-deal.CD18` guards that assertion with
 * `if (restored.OrderStatusOnEntry)` and has consequently never executed it — the same hole the
 * browser twin `80-board-drag` had at its own `if (target.OrderStatusOnEntry)`.
 *
 * ORDERING IS THE FIX HERE; THE GUARD IS NOT MINE TO CHANGE. This makes "first" reproducible so a
 * check that depends on the starting stage behaves the same on every run. Turning CD18's silent skip
 * into an assertion is a change to `close-deal.checks.ts`, which another session holds this round —
 * flagged on the board rather than edited underneath them.
 *
 * `DisplayOrder` is the pipeline's own ordering column, and `ID` breaks a tie so the result is total
 * rather than merely better.
 */
async function firstStageOf(ctx: IntegrationCheckContext, pipelineID: string): Promise<string> {
    const stage = await one<{ ID: string }>(
        ctx,
        E_STAGE,
        `PipelineID = '${pipelineID}' AND IsActive = 1`,
        ['ID'],
        `stage on pipeline ${pipelineID}`,
        'DisplayOrder ASC, ID ASC',
    );
    return stage.ID;
}

/**
 * Runs `body` inside a provider transaction that is ALWAYS rolled back.
 *
 * The rollback is in a `finally`, so it happens on a passing check as well as a failing one — a check
 * that only cleaned up on success would leave rows behind exactly when someone is debugging.
 */
export async function InRolledBackTransaction<T>(
    ctx: IntegrationCheckContext,
    body: () => Promise<T>,
): Promise<T> {
    const db = ctx.Provider as unknown as DatabaseProviderBase;
    await db.BeginTransaction();
    try {
        return await body();
    } finally {
        try {
            await db.RollbackTransaction();
        } catch {
            // A body that already rolled back (or whose own transaction failed) can leave nothing to
            // roll back. Swallowed on purpose: re-throwing here would replace the check's real failure
            // with a cleanup error and hide what actually went wrong.
        }
    }
}

/** One row of raw SQL, through the provider so it sees the open transaction. See the module header. */
export async function TxOne<T extends Record<string, unknown>>(
    ctx: IntegrationCheckContext,
    sql: string,
): Promise<T> {
    const provider = ctx.Provider as unknown as {
        ExecuteSQL: (
            sql: string,
            params: Record<string, unknown>,
            options: { isMutation: boolean; description: string },
            user: unknown,
        ) => Promise<Record<string, unknown>[]>;
    };
    const rows = await provider.ExecuteSQL(sql, {}, { isMutation: false, description: 'sales check read' }, ctx.User);
    Assert(!!rows?.length, `TxOne returned no rows for: ${sql}`);
    return rows[0] as T;
}

/** The provider, typed for the operation call. */
export function ProviderOf(ctx: IntegrationCheckContext): IMetadataProvider {
    return ctx.Provider;
}
