/**
 * @fileoverview Omitted deals and the forecast stack's Remainder.
 *
 * A deal in a forecast category left out of the pipeline (`IncludeInPipeline` false, Omitted) is
 * still open, but the pipeline money figures leave it out, as the forecast queries and the snapshot
 * do. The Remainder segment and its drill-down share one predicate, so they list the same deals.
 */
import { describe, expect, it } from 'vitest';

import { FilterInspect, ForecastSlices, WeightedOpen } from '../lib/pages/dashboard-inspect';
import { RosterRow } from './helpers/roster-row';

const commit = RosterRow({ ID: 'commit', IsOpen: true, Amount: 50, IncludeInCommit: true, IncludeInBestCase: true, WeightedAmount: 5 });
const best = RosterRow({ ID: 'best', IsOpen: true, Amount: 20, IncludeInBestCase: true, WeightedAmount: 2 });
const remainder = RosterRow({ ID: 'remainder', IsOpen: true, Amount: 10, WeightedAmount: 1 });
const omitted = RosterRow({ ID: 'omitted', IsOpen: true, Amount: 400, IncludeInPipeline: false, WeightedAmount: 40 });
const won = RosterRow({ ID: 'won', IsWon: true, IsClosed: true, Amount: 900 });
const ROSTER = [commit, best, remainder, omitted, won];

const ids = (rows: { ID: string }[]) => rows.map((d) => d.ID);
const total = (rows: { Amount: number | null }[]) => rows.reduce((n, d) => n + Number(d.Amount), 0);

describe('Omitted deals', () => {
    it('are left out of every stack segment', () => {
        const s = ForecastSlices(ROSTER);
        expect(s.Commit).toBe(50);
        expect(s.BestOnly).toBe(20);
        expect(s.PipeOnly).toBe(10);
    });

    it("are left out of the 'pipe' list and Weighted open", () => {
        expect(ids(FilterInspect(ROSTER, 'pipe'))).toEqual(['commit', 'best', 'remainder']);
        expect(WeightedOpen(ROSTER)).toBe(8);
    });

    it("stay open, so Needs attention still finds them, while 'weighted' lists the pipe deals", () => {
        expect(ids(FilterInspect(ROSTER, 'nodate'))).toEqual(['commit', 'best', 'remainder', 'omitted']);
        expect(ids(FilterInspect(ROSTER, 'weighted'))).toEqual(ids(FilterInspect(ROSTER, 'pipe')));
    });
});

describe("the 'remainder' drill-down", () => {
    it('lists exactly the deals the Remainder segment totals', () => {
        const rows = FilterInspect(ROSTER, 'remainder');
        expect(ids(rows)).toEqual(['remainder']);
        expect(total(rows)).toBe(ForecastSlices(ROSTER).PipeOnly);
    });
});
