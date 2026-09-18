/**
 * @fileoverview The period window's effect on the forecast stack and the Inspect slices.
 *
 * ── THE TWO CLAIMS WORTH PROVING ────────────────────────────────────────────────────────────────
 *
 * 1. **The tile and its own drill-through agree.** The Won KPI is counted in SQL and the deals behind
 *    it are filtered in the browser. Those are two implementations of one rule, and the failure mode
 *    is not a crash — it is a tile reading 3 above a list showing 5, with nothing saying which is
 *    right. Both sides go through `WonInPeriod`, and the tests below pin that they cannot diverge.
 *
 * 2. **Narrowing the period moves NOTHING except Closed.** golive#232 requires the open-deal figures
 *    to stay as they are, and the quiet way to break that is a won deal falling out of `Closed` and
 *    landing in the pipeline remainder — a fall-through that would make the stack total look stable
 *    while silently reclassifying closed business as open. Asserted directly.
 */
import { describe, expect, it } from 'vitest';

import { FilterInspect, ForecastSlices, WonInPeriod } from '../lib/pages/dashboard-inspect';
import { ResolvePeriod, type PeriodWindow } from '../lib/pages/dashboard-period';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

/** A roster row with only the fields these projections read; the rest are inert defaults. */
function deal(overrides: Partial<DealRosterRow>): DealRosterRow {
    return {
        ID: 'deal',
        DealNumber: null,
        Name: 'Deal',
        AccountID: null,
        CustomerName: '—',
        Amount: 0,
        AmountIsComputed: false,
        Probability: null,
        ExpectedCloseDate: null,
        ActualCloseDate: null,
        Pipeline: null,
        PipelineStage: null,
        DealType: null,
        DealStatusType: null,
        OwnerEmployee: null,
        ForecastCategoryType: null,
        DealStatusTypeID: null,
        PipelineID: null,
        PipelineStageID: null,
        IsOpen: false,
        IsWon: false,
        IsLost: false,
        IsClosed: false,
        IsPastExpectedClose: false,
        IncludeInCommit: false,
        IncludeInBestCase: false,
        WeightedAmount: null,
        StageOrder: null,
        CurrencyID: null,
        ...overrides,
    };
}

/** Calendar Q3 2026, so the fixtures below read as dates rather than as arithmetic. */
const Q3: PeriodWindow = ResolvePeriod('quarter', { Month: 1, Day: 1 }, '2026-08-15');
const ALL_TIME: PeriodWindow = ResolvePeriod('alltime', { Month: 1, Day: 1 }, '2026-08-15');

const wonInside = deal({ ID: 'in', IsWon: true, IsClosed: true, Amount: 100, ActualCloseDate: '2026-07-14' });
const wonOutside = deal({ ID: 'out', IsWon: true, IsClosed: true, Amount: 400, ActualCloseDate: '2026-04-30' });
const wonUndated = deal({ ID: 'undated', IsWon: true, IsClosed: true, Amount: 700, ActualCloseDate: null });
const openCommit = deal({ ID: 'commit', IsOpen: true, Amount: 50, IncludeInCommit: true, IncludeInBestCase: true });
const openBest = deal({ ID: 'best', IsOpen: true, Amount: 20, IncludeInBestCase: true });
const openPipe = deal({ ID: 'pipe', IsOpen: true, Amount: 10 });

/**
 * A win whose status ALSO carries IsOpen.
 *
 * Not a contrived fixture: `IsOpen` and `IsWon` are independent BIT columns on `DealStatusType`, and
 * that table is vocabulary — seeded from `metadata/deal-status-types/` and editable per deployment.
 * Nothing in the schema forbids a status setting both, so no code here may assume they are exclusive.
 *
 * It exists because without it the `else if (d.IsOpen)` branch below is unreachable for a won deal,
 * and a test asserting that an excluded win does not land in the pipeline remainder would pass
 * whether the guard were present or not. Measured, not assumed: introducing exactly that fall-through
 * left the earlier version of this suite fully green.
 */
const wonAndOpen = deal({
    ID: 'both',
    IsWon: true,
    IsOpen: true,
    IncludeInCommit: true,
    Amount: 900,
    ActualCloseDate: '2026-04-30',
});

const ROSTER = [wonInside, wonOutside, wonUndated, openCommit, openBest, openPipe, wonAndOpen];

describe('WonInPeriod', () => {
    it('is false for anything that is not won, whatever its dates', () => {
        expect(WonInPeriod(openCommit, Q3)).toBe(false);
        expect(WonInPeriod(deal({ IsLost: true, IsClosed: true, ActualCloseDate: '2026-07-14' }), Q3)).toBe(false);
    });

    it('includes every win when there is no window — that is what All time means', () => {
        for (const d of [wonInside, wonOutside, wonUndated]) {
            expect(WonInPeriod(d, ALL_TIME)).toBe(true);
            expect(WonInPeriod(d, undefined)).toBe(true);
        }
    });

    it('includes both endpoints of a bounded window', () => {
        expect(WonInPeriod(deal({ IsWon: true, ActualCloseDate: Q3.Start! }), Q3)).toBe(true);
        expect(WonInPeriod(deal({ IsWon: true, ActualCloseDate: Q3.End! }), Q3)).toBe(true);
    });

    it('excludes a win dated outside the window', () => {
        expect(WonInPeriod(wonOutside, Q3)).toBe(false);
    });

    it('EXCLUDES an undated win from a bounded window but keeps it under All time', () => {
        // The tile asks "won in this period"; a deal that never recorded when it closed cannot answer
        // it. Being visible under All time is what stops such a deal vanishing from every view at once.
        expect(WonInPeriod(wonUndated, Q3)).toBe(false);
        expect(WonInPeriod(wonUndated, ALL_TIME)).toBe(true);
    });

    it('reads a Date as readily as an ISO string — RunQuery hands back either', () => {
        const asDate = deal({ IsWon: true, ActualCloseDate: new Date(Date.UTC(2026, 6, 14)) });
        expect(WonInPeriod(asDate, Q3)).toBe(true);
    });
});

describe('ForecastSlices under a period', () => {
    it('counts every win when unbounded', () => {
        const s = ForecastSlices(ROSTER, ALL_TIME);
        expect(s.Closed).toBe(100 + 400 + 700 + 900);
    });

    it('narrows Closed to wins that landed in the window', () => {
        expect(ForecastSlices(ROSTER, Q3).Closed).toBe(100);
    });

    it('omitting the window behaves exactly as before the period selector existed', () => {
        // The pre-golive#232 behaviour has to remain reachable, or "All time reproduces what you had"
        // is an intention rather than a fact.
        expect(ForecastSlices(ROSTER)).toEqual(ForecastSlices(ROSTER, ALL_TIME));
    });

    it('does NOT move an excluded win into the open segments', () => {
        // THE FALL-THROUGH BUG, and the reason `wonAndOpen` exists. A won deal that fails the window
        // check and drops into the `IsOpen` branch reclassifies closed business as pipeline: the open
        // segments grow as the period narrows, which is requirement 3 broken in the least visible way
        // available. Narrowing must SHRINK the stack, never redistribute it.
        const wide = ForecastSlices(ROSTER, ALL_TIME);
        const narrow = ForecastSlices(ROSTER, Q3);
        expect(narrow.Commit).toBe(wide.Commit);
        expect(narrow.BestOnly).toBe(wide.BestOnly);
        expect(narrow.PipeOnly).toBe(wide.PipeOnly);
        expect(narrow.Closed).toBeLessThan(wide.Closed);
    });

    it('leaves the open segments exactly as the issue requires', () => {
        const s = ForecastSlices(ROSTER, Q3);
        expect(s.Commit).toBe(50);
        // Best Case is INCREMENTAL — the commit deal carries both flags and must not be counted twice.
        expect(s.BestOnly).toBe(20);
        expect(s.PipeOnly).toBe(10);
    });
});

describe('FilterInspect', () => {
    it("the 'won' slice lists exactly the deals the windowed tile counted", () => {
        // This is the agreement that matters: the drill-through and the figure share one predicate,
        // so a tile reading 1 above a list of 3 is not a state this code can reach.
        const rows = FilterInspect(ROSTER, 'won', '2026-08-15', Q3);
        expect(rows.map((d) => d.ID)).toEqual(['in']);
        expect(rows.reduce((n, d) => n + Number(d.Amount), 0)).toBe(ForecastSlices(ROSTER, Q3).Closed);
    });

    it("the 'won' slice is every win under All time", () => {
        expect(FilterInspect(ROSTER, 'won', '2026-08-15', ALL_TIME).map((d) => d.ID))
            .toEqual(['in', 'out', 'undated', 'both']);
    });

    it('every OTHER slice ignores the window — they describe the open book', () => {
        // Requirement 3, at the slice level. If a period ever reached these, the stage mix and the
        // close buckets built on them would start disagreeing with the tiles above them.
        for (const key of ['pipe', 'commit', 'best', 'noowner'] as const) {
            expect(FilterInspect(ROSTER, key, '2026-08-15', Q3).map((d) => d.ID)).toEqual(
                FilterInspect(ROSTER, key, '2026-08-15', ALL_TIME).map((d) => d.ID),
            );
        }
    });
});
