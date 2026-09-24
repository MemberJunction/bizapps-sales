/**
 * @fileoverview `InForecast` — which roster rows the dashboard's current-book figures read.
 *
 * A pipeline flagged out of the forecast (`Pipeline.IncludeInForecast = 0`) holds historical deals.
 * Its OPEN deals must not reach the forecast stack, the funnel or the open counts, or they are counted
 * beside the live ones. Its CLOSED deals must stay: a win there is still a win.
 */
import { describe, expect, it } from 'vitest';

import { ForecastSlices, InForecast, WeightedOpen } from '../lib/pages/dashboard-inspect';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

/** Only the fields these projections read. */
function row(over: Partial<DealRosterRow>): DealRosterRow {
    return {
        ID: 'deal',
        Amount: 0,
        WeightedAmount: 0,
        IsOpen: false,
        IsWon: false,
        IncludeInCommit: false,
        IncludeInBestCase: false,
        ActualCloseDate: null,
        PipelineIncludeInForecast: true,
        ...over,
    } as DealRosterRow;
}

const liveOpen = row({ ID: 'live-open', IsOpen: true, Amount: 100, WeightedAmount: 50, IncludeInCommit: true });
const historicalOpen = row({
    ID: 'historical-open',
    IsOpen: true,
    Amount: 900,
    WeightedAmount: 450,
    IncludeInCommit: true,
    PipelineIncludeInForecast: false,
});
const historicalWon = row({ ID: 'historical-won', IsWon: true, Amount: 300, PipelineIncludeInForecast: false });
const historicalLost = row({ ID: 'historical-lost', Amount: 70, PipelineIncludeInForecast: false });

const ROSTER = [liveOpen, historicalOpen, historicalWon, historicalLost];

describe('InForecast', () => {
    it('drops open deals in a pipeline flagged out of the forecast', () => {
        expect(InForecast(ROSTER).map((d) => d.ID)).not.toContain('historical-open');
    });

    it('keeps closed deals in that pipeline, won and lost alike', () => {
        const ids = InForecast(ROSTER).map((d) => d.ID);
        expect(ids).toContain('historical-won');
        expect(ids).toContain('historical-lost');
    });

    it('keeps open deals in a pipeline that counts toward the forecast', () => {
        expect(InForecast(ROSTER).map((d) => d.ID)).toContain('live-open');
    });

    it('does not reorder or mutate the roster it was given', () => {
        const before = ROSTER.map((d) => d.ID);
        InForecast(ROSTER);
        expect(ROSTER.map((d) => d.ID)).toEqual(before);
    });
});

describe('the forecast stack over InForecast', () => {
    it('counts the live commit and not the historical one', () => {
        const s = ForecastSlices(InForecast(ROSTER));
        expect(s.Commit).toBe(100);
        expect(s.Closed).toBe(300);
    });

    it('weights only live open deals', () => {
        expect(WeightedOpen(InForecast(ROSTER))).toBe(50);
    });
});
