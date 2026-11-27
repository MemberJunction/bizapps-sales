/**
 * The dashboard's default deal list follows the period (bc-aidp-next-golive#489).
 *
 * It was "closing in the next 30 days" whatever period was picked, so the list under a "Next quarter"
 * forecast showed this month's deals. It is now the open deals expected to close in the period, soonest
 * first; the Expected to close card's buckets cover the near term.
 */
import { describe, expect, it } from 'vitest';

import { ClosingInPeriod, FilterInspect, PERIOD_BOUND_KEYS } from '../lib/pages/dashboard-inspect';
import { ResolvePeriod } from '../lib/pages/dashboard-period';
import { DEFAULT_SALES_URL_STATE, ParseSalesUrlState } from '../lib/sections/sales-url-state';
import { RosterRow } from './helpers/roster-row';

const TODAY = '2026-08-15';
const Q3 = ResolvePeriod('quarter', { Month: 1, Day: 1 }, TODAY);
const NEXT_Q = ResolvePeriod('nextquarter', { Month: 1, Day: 1 }, TODAY);

const late = RosterRow({ ID: 'late', IsOpen: true, ExpectedCloseDate: '2026-09-28' });
const soon = RosterRow({ ID: 'soon', IsOpen: true, ExpectedCloseDate: '2026-08-20' });
const pastDue = RosterRow({ ID: 'past', IsOpen: true, ExpectedCloseDate: '2026-07-02' });
const nextQuarter = RosterRow({ ID: 'q4', IsOpen: true, ExpectedCloseDate: '2026-11-10' });
const undated = RosterRow({ ID: 'undated', IsOpen: true, ExpectedCloseDate: null });
const won = RosterRow({ ID: 'won', IsOpen: false, IsWon: true, IsClosed: true, ExpectedCloseDate: '2026-08-18' });
const DEALS = [late, soon, pastDue, nextQuarter, undated, won];

describe('the default list', () => {
    it('is the open deals expected to close in the period, soonest first', () => {
        expect(ClosingInPeriod(DEALS, Q3).map((d) => d.ID)).toEqual(['past', 'soon', 'late']);
        expect(ClosingInPeriod(DEALS, NEXT_Q).map((d) => d.ID)).toEqual(['q4']);
    });

    it('lists every open deal under All time, undated last', () => {
        expect(ClosingInPeriod(DEALS).map((d) => d.ID)).toEqual(['past', 'soon', 'late', 'q4', 'undated']);
    });

    it('is what the `closing` key lists, and the period bounds it', () => {
        expect(FilterInspect(DEALS, 'closing', TODAY, NEXT_Q).map((d) => d.ID)).toEqual(['q4']);
        expect(PERIOD_BOUND_KEYS).toContain('closing');
    });

    it('opens from an old `inspect=closing` link, which names the default', () => {
        expect(ParseSalesUrlState({ inspect: 'closing' }, ['dashboard'])).toEqual({ ...DEFAULT_SALES_URL_STATE, Inspect: 'closing' });
    });
});
