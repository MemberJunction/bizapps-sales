/**
 * THE DASHBOARD'S "TODAY" IS THE BUSINESS DAY (bc-aidp-next-golive#168).
 *
 * ── WHAT WAS LEFT BEHIND ───────────────────────────────────────────────────────────────────────
 *
 * #168 moved the product picker and the forecast job onto the business day and left `TodayUtc()`
 * standing here. So from 19:00 Central the dashboard's fiscal window, its close buckets and its
 * inspect lists all rolled into tomorrow while the picker on the next screen had not — two
 * different answers to "what day is it", in one app, with nothing to say which was meant.
 *
 * ── WHY THE DEFAULTS ARE DRIVEN AND NOT JUST THE HELPER ────────────────────────────────────────
 *
 * `BusinessToday()` alone is one line; asserting only that would repeat the mistake finding 1 was
 * about — proving the helper and leaving the call sites unpinned. `ResolvePeriod`, `FilterInspect`
 * and `CloseBuckets` take `today` as a DEFAULT PARAMETER, and every existing test passes it
 * explicitly, so nothing in the suite exercised the default at all. These do.
 *
 * ── THE INSTANT AND THE FISCAL START ARE BOTH CHOSEN TO DISCRIMINATE ───────────────────────────
 *
 * `2026-09-01T02:00:00Z` is 21:00 on 31 August in America/Chicago — west of Greenwich, per the
 * spec's §7 rule, so the business day (`2026-08-31`) and the UTC day (`2026-09-01`) differ.
 *
 * A 1 September fiscal start then makes them differ by a whole fiscal YEAR as well: 31 August is the
 * last day of FY2025 Q4, and 1 September is the first of FY2026 Q1. Under a calendar start both days
 * sit inside the same quarter and this file would be green through the defect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { BusinessToday } from '../lib/pages/dashboard-dates';
import { CloseBuckets, FilterInspect } from '../lib/pages/dashboard-inspect';
import { ResolvePeriod, type FiscalYearStart } from '../lib/pages/dashboard-period';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. */
const EVENING_IN_CHICAGO = new Date('2026-09-01T02:00:00.000Z');

/** Makes the two zones disagree about the fiscal YEAR, not merely the day. */
const SEPTEMBER_START: FiscalYearStart = { Month: 9, Day: 1 };

/** An open deal expected to close on the business day itself — the boundary the buckets turn on. */
function closingOnTheBusinessDay(): DealRosterRow {
    return {
        ID: 'deal-1',
        Name: 'Closes on the last day of the business month',
        // A `Date` at UTC midnight, which is how the driver returns a `DATE` column.
        ExpectedCloseDate: new Date('2026-08-31T00:00:00.000Z'),
        Amount: 1000,
        IsOpen: true,
        IsWon: false,
        IsPastExpectedClose: false,
        OwnerEmployee: 'A Rep',
    } as unknown as DealRosterRow;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(EVENING_IN_CHICAGO);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('BusinessToday', () => {
    /** The premise, asserted — at an instant where the two agree everything below is vacuous. */
    it('is a DIFFERENT day from the UTC day at the pinned instant', () => {
        expect(BusinessToday()).toBe('2026-08-31');
        expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-01');
    });
});

describe('the dashboard defaults read the business day', () => {
    /**
     * THE FISCAL WINDOW. With a September year start the UTC day is in the NEXT fiscal year, so a
     * UTC "today" reports Q1 of FY2026 — every figure on the screen for a quarter that has not
     * started, on the evening of the last day of the one that has.
     */
    it('ResolvePeriod selects the quarter the BUSINESS day is in', () => {
        const window = ResolvePeriod('quarter', SEPTEMBER_START);

        expect(window.Start).toBe('2026-06-01');
        expect(window.End).toBe('2026-08-31');
    });

    it('and the prior quarter follows from the same day', () => {
        const window = ResolvePeriod('lastquarter', SEPTEMBER_START);

        expect(window.Start).toBe('2026-03-01');
        expect(window.End).toBe('2026-05-31');
    });

    /**
     * THE CLOSE BUCKETS. A deal expected to close TODAY belongs in "Next 7 days" — `c >= today`. On
     * the UTC day it is already in the past by that comparison and falls out of the week bucket
     * without landing in any other, so it vanishes from the tile row entirely.
     */
    it('CloseBuckets puts a deal closing on the business day in the next-7-days bucket', () => {
        const buckets = CloseBuckets([closingOnTheBusinessDay()]);
        const week = buckets.find((b) => b.Key === 'week');

        expect(week?.Count, 'a deal closing today is due within the next 7 days').toBe(1);
        // Named explicitly: under the UTC day this deal appears in NO bucket at all, which is the
        // shape of the defect — a row that is silently absent rather than visibly misplaced.
        expect(buckets.reduce((n, b) => n + b.Count, 0), 'the deal must appear in exactly one bucket').toBe(1);
    });

    it('FilterInspect\'s week list includes it for the same reason', () => {
        expect(FilterInspect([closingOnTheBusinessDay()], 'week')).toHaveLength(1);
    });
});
