/**
 * THE CALL SITES THAT PASS THE BUSINESS ZONE — not the arithmetic they pass it to.
 *
 * ── WHY THIS FILE EXISTS, WHICH IS THE WHOLE POINT OF IT ────────────────────────────────────────
 *
 * `ForecastBusinessMonth.test.ts` proves `CurrentMonthPeriod` honours a zone it is HANDED. It says
 * nothing about anybody handing it one. Measured on this branch: reverting `RunForecastSnapshot` to
 * `CurrentMonthPeriod(now)` and both `businessDay(...)` calls in `capturedToday` back to `isoDate`
 * left all 539 tests green. The defect #168 fixed lived in exactly those three lines, and the proof
 * covered the two pure functions on either side of them.
 *
 * That is CLAUDE.md rule 8 in its usual costume: the claim ("the job judges the month in the
 * business zone") was checked where it was MADE — inside a pure helper, by argument — and not where
 * it is USED. So every assertion below drives `RunForecastSnapshot`, the entry point the MJ Action
 * actually calls, and fails if the wiring is removed.
 *
 * ── THE ZONE IS PINNED BY SPY, AND WEST OF GREENWICH ────────────────────────────────────────────
 *
 * `BusinessTimeZoneEngine` resolves its zone from one `MJ: Instance Configurations` row, which needs
 * a database. The engine is not what is under test here — the question is whether these call sites
 * ASK it — so its two public readers are stubbed and the real `Intl` arithmetic behind
 * `CurrentMonthPeriod` and `CalendarDayIn` runs untouched.
 *
 * `America/Chicago` and `2026-09-01T02:00:00Z` (21:00 on 31 August, Central) are the spec's §7
 * discriminating pair: the business day and the UTC day genuinely disagree there, in both the month
 * and the day. An instant where they agree leaves this whole file green through the defect.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import type { ForecastPeriod, ForecastSourceBatch, IForecastSource } from '../forecast/ForecastSource.js';

/**
 * `RunView` is replaced at the module boundary, the way `DealLockOrderLineVeto.test.ts` does it:
 * `capturedToday` constructs its own, so there is nothing to inject. Only the database is stubbed —
 * the grain keying, the day comparison and the skip accounting are all the real code.
 *
 * `LogStatus` is silenced because the no-source path logs, and a green run should not print.
 */
const runView = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, LogStatus: () => undefined, RunView: class { public RunView = runView; } };
});

const { RunForecastSnapshot, SetForecastSourceFactory } = await import('../forecast/ForecastSnapshotJob.js');

const BUSINESS_ZONE = 'America/Chicago';
const E_FORECAST_SNAPSHOT = 'MJ_BizApps_Sales: Forecast Snapshots';
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. When a nightly job actually runs. */
const EVENING_ON_MONTH_END = new Date('2026-09-01T02:00:00.000Z');

/** Test doubles are asserted as `never`, the idiom this package's other suites already use. */
const USER = { ID: 'user-1' } as never;

/** The day part of a stored boundary, read the way a `DATE` column is: from UTC parts. */
function day(when: Date): string {
    return when.toISOString().slice(0, 10);
}

/** Stubs the engine's two public readers. The zone lookup is not what these checks are about. */
function pinBusinessZone(): void {
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
}

interface RecordingSource extends IForecastSource {
    /** Every period `Measure` was asked for — which is what the job CHOSE. */
    readonly Periods: ForecastPeriod[];
}

function recordingSource(batch: ForecastSourceBatch): RecordingSource {
    const periods: ForecastPeriod[] = [];
    return {
        Name: 'wiring-fixture',
        IsLive: false,
        Periods: periods,
        Measure: async (period: ForecastPeriod): Promise<ForecastSourceBatch> => {
            periods.push(period);
            return batch;
        },
    };
}

/**
 * A batch that STOPS the capture after `Measure`, for the checks that only care which period was
 * chosen. Zero rows plus an issue is the job's own "failed measurement" path, so it returns before
 * the re-run guard reads anything.
 */
const measuredNothing: ForecastSourceBatch = {
    Rows: [],
    Issues: ['the wiring is what this pins, so the measurement stops here'],
};

/** One measure row at the company grain — enough for the re-run guard to have something to skip. */
const oneRow: ForecastSourceBatch = {
    Rows: [{
        CompanyID: COMPANY,
        PipelineID: null,
        OwnerEmployeeID: null,
        CommitAmount: 100,
        BestCaseAmount: 200,
        PipelineAmount: 300,
        ClosedAmount: 400,
    }],
    Issues: [],
};

/** Only what `Capture` touches: the entity registry, and a row object it can write to. */
function provider(): never {
    return {
        Entities: [{ Name: E_FORECAST_SNAPSHOT }],
        GetEntityObject: async (): Promise<Record<string, unknown>> => ({
            NewRecord: () => true,
            Save: async () => true,
        }),
    } as never;
}

/** What the re-run guard's read returns: prior captures of this period, at the company grain. */
function alreadyCaptured(...capturedAt: string[]): void {
    runView.mockResolvedValue({
        Success: true,
        Results: capturedAt.map((when) => ({
            CompanyID: COMPANY,
            PipelineID: null,
            OwnerEmployeeID: null,
            CapturedAt: when,
        })),
    });
}

/** Runs the entry point with `source` registered, and always puts the factory back. */
async function run(
    source: IForecastSource,
    now: Date,
    period?: ForecastPeriod,
): Promise<Awaited<ReturnType<typeof RunForecastSnapshot>>> {
    const previous = SetForecastSourceFactory(() => source);
    try {
        return await RunForecastSnapshot(provider(), USER, now, period);
    } finally {
        SetForecastSourceFactory(previous);
    }
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    runView.mockReset();
});

describe('RunForecastSnapshot chooses the period in the BUSINESS zone', () => {
    /**
     * THE DEFECT, DRIVEN THROUGH THE ENTRY POINT.
     *
     * Removing the zone argument at the call site — `CurrentMonthPeriod(now)` — turns every
     * assertion here September, which is precisely the bug: the nightly job fired at 21:00 on the
     * last day of the month and measured the month that had not started yet, so the closing month
     * was never snapshotted at all.
     */
    it('snapshots AUGUST for a 9 PM run on 31 August Central, though UTC is already September', async () => {
        pinBusinessZone();
        const source = recordingSource(measuredNothing);

        const result = await run(source, EVENING_ON_MONTH_END);

        expect(source.Periods, 'the source must have been asked for exactly one period').toHaveLength(1);
        expect(day(source.Periods[0].PeriodStart)).toBe('2026-08-01');
        expect(day(source.Periods[0].PeriodEnd)).toBe('2026-08-31');
        // The reported period is what a caller and the `ForecastSnapshot` rows agree on, so it is
        // asserted separately rather than assumed to follow.
        expect(result.Period).toEqual({ PeriodStart: '2026-08-01', PeriodEnd: '2026-08-31' });
    });

    /**
     * THE PREMISE, ASSERTED — rule 8 again. If the engine ever answered UTC here, the check above
     * would be asserting August against a UTC August and proving nothing about the zone.
     */
    it('and the zone it used is the one the engine named, not the host default', async () => {
        pinBusinessZone();
        const zone = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get');
        zone.mockReturnValue(BUSINESS_ZONE);

        await run(recordingSource(measuredNothing), EVENING_ON_MONTH_END);

        expect(zone, 'the job never asked the engine what the business zone is').toHaveBeenCalled();
    });

    /**
     * FINDING 3 — THE `??` SHORT-CIRCUIT, WHICH IS A REAL GUARANTEE AND NOT TIDINESS.
     *
     * The fallback used to be computed into a `const` on the line above `period ?? fallback`, so an
     * explicit period still paid for the configuration read AND for `CurrentMonthPeriod(now)`. That
     * second one is not merely wasteful: `CalendarDayIn` goes through `Intl`, which throws a
     * `RangeError` on an unusable `Date` — so a run whose window was fully specified, and which
     * therefore has no use for `now` at all, died on an argument it was never going to read.
     *
     * An Action that knows its own quarter and has no clock to offer is a legitimate caller. This is
     * what says so.
     */
    it('does no period work at all when the caller named one — an unusable `now` never reaches Intl', async () => {
        pinBusinessZone();
        const source = recordingSource(measuredNothing);
        const explicit: ForecastPeriod = {
            PeriodStart: new Date('2026-04-01T00:00:00.000Z'),
            PeriodEnd: new Date('2026-06-30T00:00:00.000Z'),
        };

        const result = await run(source, new Date(Number.NaN), explicit);

        expect(source.Periods[0], 'the caller\'s own period object must be the one measured').toBe(explicit);
        expect(result.Period).toEqual({ PeriodStart: '2026-04-01', PeriodEnd: '2026-06-30' });
    });
});

/**
 * ── THE RE-RUN GUARD, AND WHY IT TAKES TWO CHECKS RATHER THAN ONE ───────────────────────────────
 *
 * `capturedToday` reads a business day twice: once for TODAY and once for each stored `CapturedAt`.
 * Either one alone reverting to UTC is a defect, and a single check cannot see both — reverting one
 * side moves the comparison, reverting the other moves it back.
 *
 * So the two below are a matched pair, chosen so that every one of the three possible reverts turns
 * at least one of them red:
 *
 * | revert                  | morning capture | evening capture |
 * |-------------------------|-----------------|-----------------|
 * | today side only         | FAILS           | FAILS           |
 * | stored-row side only    | passes          | FAILS           |
 * | both sides (the old UTC)| FAILS           | passes          |
 *
 * Neither is redundant, and neither is sufficient.
 */
describe('the re-run guard compares CapturedAt on the business day', () => {
    const PERIOD: ForecastPeriod = {
        PeriodStart: new Date('2026-08-01T00:00:00.000Z'),
        PeriodEnd: new Date('2026-08-31T00:00:00.000Z'),
    };

    /** The clock the guard reads for "today". Faked for `Date` only, so nothing else is held up. */
    function atEveningOnMonthEnd(): void {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(EVENING_ON_MONTH_END);
    }

    it('skips a capture taken this MORNING in Chicago, whose UTC day is the day before today\'s', async () => {
        pinBusinessZone();
        atEveningOnMonthEnd();
        // 08:00 on 31 August, Central. Business day 2026-08-31 — the same day it is now.
        alreadyCaptured('2026-08-31T13:00:00.000Z');

        const result = await run(recordingSource(oneRow), EVENING_ON_MONTH_END, PERIOD);

        expect(result.SkippedAsAlreadyCaptured).toBe(1);
        expect(result.Written, 'a second capture of a day already captured is noise, not history').toBe(0);
    });

    it('skips a capture taken THIS EVENING, after UTC rolled over but before the business day did', async () => {
        pinBusinessZone();
        atEveningOnMonthEnd();
        // 21:30 on 31 August, Central — thirty minutes ago. Its UTC day is already 1 September.
        alreadyCaptured('2026-09-01T02:30:00.000Z');

        const result = await run(recordingSource(oneRow), EVENING_ON_MONTH_END, PERIOD);

        expect(result.SkippedAsAlreadyCaptured).toBe(1);
        expect(result.Written).toBe(0);
    });

    /**
     * THE OTHER DIRECTION, so neither check above can be satisfied by a guard that skips
     * everything. Yesterday's capture is a different day on both calendars and must be written.
     */
    it('writes when the only prior capture was on a genuinely different business day', async () => {
        pinBusinessZone();
        atEveningOnMonthEnd();
        // 13:00 on 30 August, Central. Business day 2026-08-30, which is not today.
        alreadyCaptured('2026-08-30T18:00:00.000Z');

        const result = await run(recordingSource(oneRow), EVENING_ON_MONTH_END, PERIOD);

        expect(result.SkippedAsAlreadyCaptured).toBe(0);
        expect(result.Written).toBe(1);
        expect(result.Success).toBe(true);
    });
});
