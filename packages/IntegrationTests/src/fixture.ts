/**
 * @fileoverview The reference data every sales check reads, plus the transaction discipline that makes
 * the suite re-runnable.
 *
 * ── ISOLATION MODEL ─────────────────────────────────────────────────────────────────────────────
 *
 * Every mutating check runs inside its own provider transaction and **ROLLS BACK**, so deals, lines,
 * instalments and team members never reach disk. Teardown is therefore nothing at all, and a mid-run
 * crash leaves the database exactly as it was. Copied from bizapps-orders, which validated the model —
 * including that the nesting works: `Sales.SaveDeal` opens its own transaction inside the check's, and
 * `DealEntityServer.Save` opens one inside that, so a check is up to three savepoints deep.
 *
 * ── IT DISCOVERS ITS FIXTURE RATHER THAN CREATING ONE ───────────────────────────────────────────
 *
 * Orders builds a catalog because it needs products with prices in exact shapes. Sales needs a pipeline
 * with stages, the vocabulary rows and one employee — all of which `scripts/seed-dev-data.sh` and
 * `scripts/seed-demo-data.sh` already create, and which are the same rows a developer clicks through in
 * Explorer. Discovering them has the safest possible teardown (there is none) and means a check failure
 * is about `Sales.SaveDeal` rather than about fixture construction.
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
export const E_DEAL_LINE = 'MJ_BizApps_Sales: Deal Lines';
export const E_SCHEDULE = 'MJ_BizApps_Sales: Deal Payment Schedules';
export const E_TEAM = 'MJ_BizApps_Sales: Deal Team Members';
export const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
export const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
export const E_DEAL_TYPE = 'MJ_BizApps_Sales: Deal Types';
export const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';
export const E_LINE_TYPE = 'MJ_BizApps_Sales: Deal Line Types';
export const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
export const E_EMPLOYEE = 'MJ: Employees';

/** The rows the checks build payloads from. All discovered, none created. */
export interface SalesFixture {
    PipelineID: string;
    PipelineCompanyID: string;
    StageID: string;
    DealTypeID: string;
    OpenStatusID: string;
    /** The RECURRING line type, resolved by its `IsRecurring` FLAG — never by name. */
    RecurringLineTypeID: string;
    /** The ONE-TIME line type, resolved as the one whose `IsRecurring` is false. */
    OneTimeLineTypeID: string;
    AccountID: string;
    EmployeeID: string;
}

let cached: SalesFixture | null = null;

/** Reads one row via the provider, or throws with a message that says what to do about it. */
async function one<T extends Record<string, unknown>>(
    ctx: IntegrationCheckContext,
    entity: string,
    filter: string,
    fields: string[],
    what: string,
): Promise<T> {
    const rv = new RunView();
    const result = await rv.RunView<T>(
        { EntityName: entity, ExtraFilter: filter, ResultType: 'simple', Fields: fields },
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
        ctx, E_PIPELINE, 'IsActive = 1', ['ID', 'CompanyID'], 'active pipeline',
    );
    const stage = await one<{ ID: string }>(
        ctx, E_STAGE, `PipelineID = '${pipeline.ID}' AND IsActive = 1`, ['ID'], 'stage on that pipeline',
    );
    const dealType = await one<{ ID: string }>(ctx, E_DEAL_TYPE, 'IsActive = 1', ['ID'], 'deal type');
    const openStatus = await one<{ ID: string }>(
        ctx, E_STATUS_TYPE, 'IsOpen = 1 AND IsActive = 1', ['ID'], 'OPEN deal status (by IsOpen flag)',
    );
    const recurring = await one<{ ID: string }>(
        ctx, E_LINE_TYPE, 'IsRecurring = 1 AND IsActive = 1', ['ID'], 'recurring line type (by IsRecurring flag)',
    );
    const oneTime = await one<{ ID: string }>(
        ctx, E_LINE_TYPE, 'IsRecurring = 0 AND IsActive = 1', ['ID'], 'one-time line type (by IsRecurring flag)',
    );
    const account = await one<{ ID: string }>(ctx, E_ACCOUNT, 'IsActive = 1', ['ID'], 'sales account');
    const employee = await one<{ ID: string }>(ctx, E_EMPLOYEE, 'Active = 1', ['ID'], 'active employee');

    cached = {
        PipelineID: pipeline.ID,
        PipelineCompanyID: pipeline.CompanyID,
        StageID: stage.ID,
        DealTypeID: dealType.ID,
        OpenStatusID: openStatus.ID,
        RecurringLineTypeID: recurring.ID,
        OneTimeLineTypeID: oneTime.ID,
        AccountID: account.ID,
        EmployeeID: employee.ID,
    };
    return cached;
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
