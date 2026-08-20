/**
 * @fileoverview The forecast snapshot job — writes `ForecastSnapshot` rows from whatever source is set.
 *
 * Same three-part shape as the activity sync, deliberately: a seam (`IForecastSource`), a process-wide
 * factory whose default reads nothing, and an entry point an MJ Action calls on a cron. Sales has no
 * other precedent for a scheduled job, so the second one matching the first is worth more than any
 * variation would be.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogStatus, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsSalesForecastSnapshotEntity } from '@mj-biz-apps/sales-entities';

import type { ForecastPeriod, IForecastSource } from './ForecastSource.js';

const E_FORECAST_SNAPSHOT = 'MJ_BizApps_Sales: Forecast Snapshots';

export interface ForecastSnapshotResult {
    Success: boolean;
    /** Measure rows the source returned. */
    Measured: number;
    Written: number;
    /** Already captured for this period today, so not written again. See `alreadyCapturedToday`. */
    SkippedAsAlreadyCaptured: number;
    Period: { PeriodStart: string; PeriodEnd: string } | null;
    Issues: string[];
}

export type ForecastSourceFactory = (contextUser: UserInfo) => IForecastSource | null;

/**
 * THE PROCESS-WIDE FACTORY, and the single line a landed query changes.
 *
 * Default is NULL — no source — which makes a scheduled run a no-op that says so. That is the same
 * inversion the activity sync uses and for the same reason: the job must be real and Active for the chain
 * to be provably firing, and a default that measured anything would either invent numbers or fail hourly.
 *
 * A forecast row is the case where invented numbers matter most. An activity nobody sent is obviously
 * wrong when a human reads it; a plausible commit figure is not, and it would be indistinguishable from a
 * real one the moment it is in the table.
 */
let forecastSourceFactory: ForecastSourceFactory = () => null;

/** Replace the factory. Returns the previous one, so a check can restore it. */
export function SetForecastSourceFactory(factory: ForecastSourceFactory): ForecastSourceFactory {
    const previous = forecastSourceFactory;
    forecastSourceFactory = factory;
    return previous;
}

export function CurrentForecastSourceFactory(): ForecastSourceFactory {
    return forecastSourceFactory;
}

/**
 * The period a snapshot covers, when nobody says otherwise: the current calendar month, in UTC.
 *
 * ── WHY THE CALENDAR MONTH, AND WHY THAT IS A CHOICE RATHER THAN A FACT ──
 *
 * Sales has no fiscal calendar — no `FiscalPeriod` table, nothing on `Company` naming a year end. So
 * "the current period" has no stored answer, and the calendar month is the only window that needs no
 * invented configuration. It is very likely right (most forecasting is monthly) and it is definitely
 * not derived from anything, which is why it is recorded as D-28 rather than presented as the model.
 *
 * Computed with `getUTC*` throughout. A local-time month boundary would put the whole first and last day
 * of every month in the wrong period for anyone west of Greenwich.
 */
export function CurrentMonthPeriod(now: Date): ForecastPeriod {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
        PeriodStart: new Date(Date.UTC(year, month, 1)),
        // Day 0 of the NEXT month is the last day of this one, without a leap-year table.
        PeriodEnd: new Date(Date.UTC(year, month + 1, 0)),
    };
}

export class ForecastSnapshotJob {
    /**
     * Captures one snapshot per measure row for a period.
     *
     * ── THE RE-RUN GUARD, AND WHY IT SKIPS RATHER THAN UPDATES ──
     *
     * `ForecastSnapshot` has no unique index, and that is correct: the point of the table is a SERIES —
     * many captures of the same period over time, so "what did we think on the 1st" stays answerable.
     * `CapturedAt` is what distinguishes them.
     *
     * But a job that runs twice in an hour would add two captures a few minutes apart, which is noise
     * rather than history. So a row whose (company, pipeline, owner, period) was already captured TODAY is
     * skipped and counted. Skipped rather than updated, because overwriting a capture would edit
     * provenance — the one thing rule 3 forbids — and a second measurement of the same day is not more
     * true than the first.
     */
    public async Capture(
        period: ForecastPeriod,
        source: IForecastSource,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<ForecastSnapshotResult> {
        const result: ForecastSnapshotResult = {
            Success: false,
            Measured: 0,
            Written: 0,
            SkippedAsAlreadyCaptured: 0,
            Period: { PeriodStart: isoDate(period.PeriodStart), PeriodEnd: isoDate(period.PeriodEnd) },
            Issues: [],
        };

        if (period.PeriodEnd < period.PeriodStart) {
            result.Issues.push(
                'The period ends before it starts. CK_ForecastSnapshot_PeriodOrder would refuse it, and the '
                    + 'constraint name would not say which caller was wrong.',
            );
            return result;
        }
        if (!provider.Entities.some((e) => e.Name === E_FORECAST_SNAPSHOT)) {
            result.Issues.push(`The entity '${E_FORECAST_SNAPSHOT}' is not registered on this host.`);
            return result;
        }

        const batch = await source.Measure(period);
        result.Measured = batch.Rows.length;
        result.Issues.push(...batch.Issues);

        const existing = await this.capturedToday(period, contextUser);
        const capturedAt = new Date();

        for (const row of batch.Rows) {
            const key = grainKey(row.CompanyID, row.PipelineID, row.OwnerEmployeeID);
            if (existing.has(key)) {
                result.SkippedAsAlreadyCaptured++;
                continue;
            }

            const snapshot = await provider.GetEntityObject<mjBizAppsSalesForecastSnapshotEntity>(
                E_FORECAST_SNAPSHOT,
                contextUser,
            );
            snapshot.NewRecord();
            snapshot.CompanyID = row.CompanyID;
            snapshot.PipelineID = row.PipelineID;
            snapshot.OwnerEmployeeID = row.OwnerEmployeeID;
            snapshot.PeriodStart = period.PeriodStart;
            snapshot.PeriodEnd = period.PeriodEnd;
            snapshot.CapturedAt = capturedAt;
            snapshot.CommitAmount = row.CommitAmount;
            snapshot.BestCaseAmount = row.BestCaseAmount;
            snapshot.PipelineAmount = row.PipelineAmount;
            snapshot.ClosedAmount = row.ClosedAmount;
            /**
             * PROVENANCE, and it is the reason this column is populated at all.
             *
             * Four amounts in a table look identical whether a real query produced them or a fixture did.
             * `SnapshotJSON` says which, by name, and whether the source was live — so a snapshot taken
             * during a dry run can never be mistaken later for a measurement.
             */
            snapshot.SnapshotJSON = JSON.stringify({
                Source: source.Name,
                SourceIsLive: source.IsLive,
                CapturedAt: capturedAt.toISOString(),
            });

            if (await snapshot.Save()) {
                result.Written++;
                existing.add(key);
            } else {
                result.Issues.push(
                    `A snapshot for company ${row.CompanyID} could not be saved: `
                        + `${snapshot.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }
        }

        result.Success = true;
        return result;
    }

    /**
     * The grains already captured for this period TODAY.
     *
     * Compared on the UTC date of `CapturedAt`, read back in code rather than filtered in SQL: a
     * `CAST(CapturedAt AS DATE)` in an `ExtraFilter` would be both non-portable and non-sargable, and the
     * row count for one period is small.
     */
    private async capturedToday(period: ForecastPeriod, contextUser: UserInfo): Promise<Set<string>> {
        const r = await new RunView().RunView<{
            CompanyID: string;
            PipelineID: string | null;
            OwnerEmployeeID: string | null;
            CapturedAt: string | Date;
        }>(
            {
                EntityName: E_FORECAST_SNAPSHOT,
                ExtraFilter: `PeriodStart = '${isoDate(period.PeriodStart)}' `
                    + `AND PeriodEnd = '${isoDate(period.PeriodEnd)}'`,
                ResultType: 'simple',
                Fields: ['CompanyID', 'PipelineID', 'OwnerEmployeeID', 'CapturedAt'],
            },
            contextUser,
        );

        const today = isoDate(new Date());
        const seen = new Set<string>();
        if (!r.Success) {
            /**
             * FAIL OPEN HERE, unlike the relevance filter — and the asymmetry is deliberate. A failed read
             * means the guard cannot say what exists, and the two outcomes are: write a possible duplicate
             * capture, or write nothing. A duplicate capture is visible noise in a series; a silently
             * missing snapshot is a hole in a history that nobody can reconstruct later.
             */
            return seen;
        }
        for (const row of r.Results ?? []) {
            if (isoDate(new Date(row.CapturedAt)) === today) {
                seen.add(grainKey(row.CompanyID, row.PipelineID, row.OwnerEmployeeID));
            }
        }
        return seen;
    }
}

/**
 * Runs one capture with whatever source is registered. What the Action calls.
 *
 * Returns an honest no-op when no source is set, rather than an error: that is the ordinary state until
 * the forecast queries land, and an hourly-or-daily job reporting failure for it would be red from the
 * day it shipped.
 */
export async function RunForecastSnapshot(
    provider: IMetadataProvider,
    contextUser: UserInfo,
    now: Date,
    period?: ForecastPeriod,
): Promise<ForecastSnapshotResult> {
    const source = CurrentForecastSourceFactory()(contextUser);
    if (!source) {
        LogStatus('ForecastSnapshotJob: no forecast source is registered, so nothing was captured.');
        return {
            Success: true,
            Measured: 0,
            Written: 0,
            SkippedAsAlreadyCaptured: 0,
            Period: null,
            Issues: [
                'No forecast source is registered. The chain is wired; the MJ Queries it reads from do not '
                    + 'exist yet, so there is nothing to measure.',
            ],
        };
    }
    return new ForecastSnapshotJob().Capture(period ?? CurrentMonthPeriod(now), source, provider, contextUser);
}

/** The snapshot grain, lower-cased so a casing difference cannot look like a second grain. */
function grainKey(companyID: string, pipelineID: string | null, ownerID: string | null): string {
    return [companyID, pipelineID ?? '-', ownerID ?? '-'].map((v) => String(v).toLowerCase()).join('|');
}

/** `YYYY-MM-DD` in UTC. */
function isoDate(when: Date): string {
    return when.toISOString().slice(0, 10);
}
