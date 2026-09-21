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
import { BusinessTimeZoneEngine, CalendarDayIn, ToCalendarDay, UTC_ZONE } from '@mj-biz-apps/common-entities';
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
 * The period a snapshot covers, when nobody says otherwise: the current calendar month.
 *
 * ── WHY THE CALENDAR MONTH, AND WHY THAT IS A CHOICE RATHER THAN A FACT ──
 *
 * Sales has no fiscal calendar — no `FiscalPeriod` table, nothing on `Company` naming a year end. So
 * "the current period" has no stored answer, and the calendar month is the only window that needs no
 * invented configuration. It is very likely right (most forecasting is monthly) and it is definitely
 * not derived from anything, which is why it is recorded as D-28 rather than presented as the model.
 *
 * ── TWO SEPARATE ZONE QUESTIONS, AND ONLY ONE OF THEM HAS A ZONE ANSWER (#168) ──
 *
 * WHICH MONTH `now` falls in is a "today" question, so `zone` decides it. This read `getUTCMonth()`,
 * and a nightly job runs in the evening: on the last day of every month UTC had already rolled over
 * while the business was still in the old one, so the snapshot for the month just ending was never
 * taken — the job was already measuring the next.
 *
 * WHERE THE BOUNDARIES SIT has no zone answer at all. `PeriodStart`/`PeriodEnd` land in `DATE`
 * columns, which are calendar days, and UTC midnight is the shape such a column round-trips as. So
 * they are built with `Date.UTC` regardless of `zone` — using the instant the month began in `zone`
 * would read back a day early from the UTC parts every reader of a `DATE` column uses.
 *
 * @param zone - IANA name; `BusinessTimeZoneEngine.Instance.Zone` at the call sites. UTC by default,
 *   which is what this function did before and what every caller that passes nothing still gets.
 */
export function CurrentMonthPeriod(now: Date, zone: string = UTC_ZONE): ForecastPeriod {
    const day = CalendarDayIn(now, zone);
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7)) - 1;
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
        /**
         * The zone is loaded before anything asks what day it is. One cached instance-configuration
         * row; a second call is a no-op, and a missing or unreadable row falls back to UTC with one
         * warning rather than throwing — a snapshot in the wrong zone beats no snapshot.
         */
        await BusinessTimeZoneEngine.Instance.Config(false, contextUser, provider);

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

        /**
         * A SOURCE THAT REPORTED A PROBLEM AND NO ROWS IS A FAILURE, not a quiet quarter.
         *
         * `Success = true` used to be set unconditionally at the end, which threw away the one
         * distinction the seam exists to preserve. `QueryForecastSource` refuses by NAME when its query
         * is missing — and that refusal became indistinguishable from a period with nothing in it, so
         * renaming or deleting the query left the daily job green forever, reporting "measured 0, wrote
         * 0". Exactly the silence the source was written to avoid, discarded one layer up.
         *
         * Zero rows and NO issues is still a success: that is a genuinely empty period.
         */
        if (batch.Rows.length === 0 && batch.Issues.length > 0) {
            result.Issues.push(
                'The source reported no rows AND raised issues, so this is a failed measurement rather '
                    + 'than an empty period. Nothing was captured.',
            );
            return result;
        }

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

        /**
         * A row that could not be saved fails the capture. Reporting success with a save error in
         * `Issues` would leave a partial snapshot looking like a complete one, and a forecast series
         * with a silently missing grain is worse than a visible gap.
         */
        result.Success = result.Issues.every((i) => !i.includes('could not be saved'));
        return result;
    }

    /**
     * The grains already captured for this period TODAY.
     *
     * Compared on the BUSINESS date of `CapturedAt`, read back in code rather than filtered in SQL: a
     * `CAST(CapturedAt AS DATE)` in an `ExtraFilter` would be both non-portable and non-sargable, and the
     * row count for one period is small.
     *
     * `CapturedAt` is an INSTANT, which is the one thing a zone legitimately converts (#168) — and it
     * has to be the same zone on both sides or the guard compares two different calendars. Under UTC a
     * capture taken at 8 PM Central and one taken at 9 AM the next morning are different days, so the
     * job would have written a second capture of the same period the morning after every evening run.
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

        const today = businessDay(new Date());
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
            if (businessDay(new Date(row.CapturedAt)) === today) {
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
    /**
     * The zone has to be loaded HERE as well as in `Capture`, because the period is chosen before
     * `Capture` is entered. `Config` is idempotent, so the second call costs nothing.
     */
    await BusinessTimeZoneEngine.Instance.Config(false, contextUser, provider);
    const fallback = CurrentMonthPeriod(now, BusinessTimeZoneEngine.Instance.Zone);
    return new ForecastSnapshotJob().Capture(period ?? fallback, source, provider, contextUser);
}

/** The snapshot grain, lower-cased so a casing difference cannot look like a second grain. */
function grainKey(companyID: string, pipelineID: string | null, ownerID: string | null): string {
    return [companyID, pipelineID ?? '-', ownerID ?? '-'].map((v) => String(v).toLowerCase()).join('|');
}

/**
 * `YYYY-MM-DD` for a stored calendar DAY — read from its UTC parts, with no zone anywhere near it.
 *
 * The period boundaries are `DATE` values: a calendar day carries no time and no zone, and the driver
 * hands one back as UTC midnight. Rendering that instant in a zone west of Greenwich yields the day
 * BEFORE, so every period would be labelled and filtered one day early. The business zone belongs to
 * "today" questions only (#168); see {@link businessDay}, which is the other half of that split.
 */
function isoDate(when: Date): string {
    const day = ToCalendarDay(when);
    if (day === null) {
        throw new RangeError(`ForecastSnapshotJob: not a readable date — ${String(when)}`);
    }
    return day;
}

/** `YYYY-MM-DD` for an INSTANT, in the business zone: which day a capture happened ON. */
function businessDay(instant: Date): string {
    return CalendarDayIn(instant, BusinessTimeZoneEngine.Instance.Zone);
}
