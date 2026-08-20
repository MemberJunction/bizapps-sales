/**
 * @fileoverview The real forecast source — an MJ Query, run by name.
 *
 * Written now, against queries that do not exist yet, so that when they land the only change is which
 * source the factory returns. Like `MSGraphActivitySource`, it is complete and its one unproven part is
 * the mapping — `readRow` below — which a single run against a real query settles.
 *
 * ── IT REFUSES CLEARLY RATHER THAN RETURNING NOTHING ────────────────────────────────────────────
 *
 * A missing query and a query that returned no rows are the same shape at this level and completely
 * different facts: the first is a deployment that is not finished, the second is a quiet quarter. So a
 * failed run says which, by name, and the snapshot job records it rather than writing a row of nulls that
 * would look like a measured zero.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError, RunQuery, type UserInfo } from '@memberjunction/core';

import type {
    ForecastMeasureRow,
    ForecastPeriod,
    ForecastSourceBatch,
    IForecastSource,
} from './ForecastSource.js';

/**
 * The column names this expects back from the query.
 *
 * DECLARED HERE, not discovered, and that is the contract with whoever writes the query: these are the
 * names it must project. Discovering them by shape — "the first decimal column is Commit" — would make
 * the snapshot silently wrong the day somebody reorders a SELECT.
 */
export const FORECAST_QUERY_COLUMNS = {
    CompanyID: 'CompanyID',
    PipelineID: 'PipelineID',
    OwnerEmployeeID: 'OwnerEmployeeID',
    CommitAmount: 'CommitAmount',
    BestCaseAmount: 'BestCaseAmount',
    PipelineAmount: 'PipelineAmount',
    ClosedAmount: 'ClosedAmount',
} as const;

export class QueryForecastSource implements IForecastSource {
    public readonly IsLive = true;

    public constructor(
        /** The `MJ: Queries` row to run. */
        public readonly Name: string,
        private readonly contextUser: UserInfo,
        /** Optional category, for when a query name is ambiguous. `CategoryPath` on `RunQueryParams`. */
        private readonly categoryPath: string | null = null,
    ) {}

    public async Measure(period: ForecastPeriod): Promise<ForecastSourceBatch> {
        const issues: string[] = [];
        try {
            const result = await new RunQuery().RunQuery(
                {
                    QueryName: this.Name,
                    ...(this.categoryPath ? { CategoryPath: this.categoryPath } : {}),
                    /**
                     * The period is passed as PARAMETERS, so the query owns the measure definitions and
                     * this owns the window. Dates as ISO date-only strings: everything stored is UTC, and a
                     * full timestamp would invite a query to compare a date column against an instant.
                     */
                    Parameters: {
                        PeriodStart: isoDate(period.PeriodStart),
                        PeriodEnd: isoDate(period.PeriodEnd),
                    },
                },
                this.contextUser,
            );

            if (!result?.Success) {
                return {
                    Rows: [],
                    Issues: [
                        `The forecast query '${this.Name}' did not run. Either it does not exist in `
                            + `MJ: Queries yet, or it failed. Nothing was snapshotted, deliberately — a row of `
                            + `nulls would be indistinguishable from a measured zero.`,
                    ],
                };
            }

            const rows: ForecastMeasureRow[] = [];
            for (const raw of result.Results ?? []) {
                const row = this.readRow(raw as Record<string, unknown>, issues);
                if (row) {
                    rows.push(row);
                }
            }
            return { Rows: rows, Issues: issues };
        } catch (err) {
            LogError(`QueryForecastSource.Measure failed for '${this.Name}': ${err}`);
            return { Rows: [], Issues: [`The forecast query '${this.Name}' threw: ${String(err)}`] };
        }
    }

    /**
     * THE ONE UNPROVEN FUNCTION HERE, isolated like the Graph mappers for the same reason.
     *
     * A row with no `CompanyID` is REFUSED rather than defaulted: the column is NOT NULL, so a default
     * would either fail at the database naming a constraint or — worse, if somebody "helpfully" picked the
     * only company on the host — attribute another tenant's forecast to it.
     */
    private readRow(raw: Record<string, unknown>, issues: string[]): ForecastMeasureRow | null {
        const companyID = text(raw[FORECAST_QUERY_COLUMNS.CompanyID]);
        if (!companyID) {
            issues.push(
                `A forecast row from '${this.Name}' carried no ${FORECAST_QUERY_COLUMNS.CompanyID} and was `
                    + 'skipped. The query must project it — it is NOT NULL on ForecastSnapshot.',
            );
            return null;
        }
        return {
            CompanyID: companyID,
            PipelineID: text(raw[FORECAST_QUERY_COLUMNS.PipelineID]),
            OwnerEmployeeID: text(raw[FORECAST_QUERY_COLUMNS.OwnerEmployeeID]),
            CommitAmount: money(raw[FORECAST_QUERY_COLUMNS.CommitAmount]),
            BestCaseAmount: money(raw[FORECAST_QUERY_COLUMNS.BestCaseAmount]),
            PipelineAmount: money(raw[FORECAST_QUERY_COLUMNS.PipelineAmount]),
            ClosedAmount: money(raw[FORECAST_QUERY_COLUMNS.ClosedAmount]),
        };
    }
}

/** A string, or null for anything empty. */
function text(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    const s = String(value).trim();
    return s ? s : null;
}

/**
 * A number, or null — and null for anything that is not one.
 *
 * NO COERCION OF NONSENSE. `Number('')` is 0 and `Number(null)` is 0, either of which would turn a
 * missing measure into a measured zero — a forecast of nothing, stated confidently. A value that is not
 * a finite number is absent, which is what the nullable column is for.
 */
function money(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/** `YYYY-MM-DD` in UTC. Never a local-time getter — everything persisted is UTC. */
function isoDate(when: Date): string {
    return when.toISOString().slice(0, 10);
}
