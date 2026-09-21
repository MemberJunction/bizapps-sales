/**
 * The availability filter takes a calendar DAY, not an instant (bc-aidp-next-golive#168).
 *
 * An instant had to be turned into a day inside the function, and it chose the UTC day — so from 7 PM
 * Central onwards a product whose `AvailableFrom` is tomorrow was already on offer, and one whose
 * `AvailableTo` was today had already vanished. Neither is visible on the screen that does it: the
 * picker just lists a different set of products in the evening.
 *
 * The caller now says which day, and `BusinessTimeZoneEngine.Instance.Today()` is what the picker
 * passes. This file proves the two halves of that separately, because they fail differently:
 *
 *  - the filter interpolates the day it was GIVEN, and refuses anything that is not one; and
 *  - the day the business zone names at an instant is not the day UTC names at the same instant,
 *    so passing one rather than the other is a real choice rather than a rename.
 *
 * THE INSTANT IS PINNED AND IT IS WEST OF GREENWICH, per the spec's §7 rule. `2026-09-01T02:00:00Z`
 * is 31 August, 21:00 in America/Chicago. An instant where the two zones agree would leave this file
 * green through the exact defect it exists for.
 */
import { describe, expect, it } from 'vitest';
import { CalendarDayIn, TodayIn, UTC_ZONE } from '@mj-biz-apps/common-entities';

import { ProductFilterFor, ProductWindowCovers } from '../product-filter.js';

/** West of Greenwich, so the business day and the UTC day genuinely differ at the instant below. */
const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. The evening the defect lived in. */
const EVENING_IN_CHICAGO = new Date('2026-09-01T02:00:00.000Z');

describe('ProductFilterFor', () => {
    it('interpolates the given day into both availability bounds', () => {
        const sql = ProductFilterFor('2026-08-27');
        expect(sql).toContain("AvailableFrom <= '2026-08-27'");
        expect(sql).toContain("AvailableTo >= '2026-08-27'");
        expect(sql).toContain("Status = 'Active'");
    });

    it('leaves an open-ended window alone — a NULL bound means always available', () => {
        const sql = ProductFilterFor('2026-08-27');
        expect(sql).toContain('AvailableFrom IS NULL');
        expect(sql).toContain('AvailableTo IS NULL');
    });

    it('refuses anything that is not a zero-padded YYYY-MM-DD, because it is interpolated into SQL', () => {
        expect(() => ProductFilterFor('2026-8-27')).toThrow(/calendar day/);
        expect(() => ProductFilterFor("2026-08-27' OR 1=1 --")).toThrow(/calendar day/);
        expect(() => ProductFilterFor('2026-02-30')).toThrow(/calendar day/);
        expect(() => ProductFilterFor('')).toThrow(/calendar day/);
    });
});

describe('the day the picker passes is the BUSINESS day, and that is not the UTC day', () => {
    /**
     * The premise. If this ever stops holding the two tests below are asserting nothing, so it is
     * asserted rather than assumed — the failure mode named in CLAUDE.md rule 8.
     */
    it('the two zones name different days at the pinned instant', () => {
        expect(CalendarDayIn(EVENING_IN_CHICAGO, BUSINESS_ZONE)).toBe('2026-08-31');
        expect(CalendarDayIn(EVENING_IN_CHICAGO, UTC_ZONE)).toBe('2026-09-01');
    });

    it('builds an August filter at 9 PM on 31 August Central, where the UTC day is already September', () => {
        const sql = ProductFilterFor(TodayIn(BUSINESS_ZONE, EVENING_IN_CHICAGO));
        expect(sql).toContain("AvailableFrom <= '2026-08-31'");
        expect(sql).toContain("AvailableTo >= '2026-08-31'");
        expect(sql).not.toContain('2026-09-01');
    });
});

/**
 * ── THE EXPECTATION SIDE OF THE SAME RULE ───────────────────────────────────────────────────────
 *
 * `ProductWindowCovers` is what `product-picker.PP2` uses to work out, from the catalogue's own
 * columns, which products the picker ought to have offered. It exists because PP2 open-coded that
 * comparison and the comparison did not work:
 *
 *     String(new Date('2026-08-13T00:00:00Z')).slice(0, 10)  ===  'Thu Aug 13'
 *
 * — so `'Thu Aug 13' <= '2026-08-15'` was FALSE and `'Thu Aug 13' >= '2026-08-15'` was TRUE. Every
 * row with a window was excluded from the expectation and `AvailableTo` never bound anything, which
 * left PP2 asserting only about products whose window columns are both NULL. The check could not
 * fail, and it said in its own comment that vacuity was the thing it had been rewritten to avoid.
 *
 * PP2 needs a live database and cannot run here. This can, so the derivation it depends on is proved
 * here instead — with a `Date` on the bound, because that is the shape the driver actually hands back
 * for a `DATE` column and the shape the defect was about.
 */
describe('ProductWindowCovers reads a DATE bound from its UTC parts', () => {
    /**
     * THE DEFECT, DIRECTLY. `2026-08-13` opened two days before the day being judged, so the window
     * covers it. Under `String(...).slice(0, 10)` this answers 'Outside'.
     */
    it('a window that OPENED two days ago covers today, even when the bound arrives as a Date', () => {
        expect(ProductWindowCovers(new Date('2026-08-13T00:00:00.000Z'), null, '2026-08-15')).toBe('Covers');
    });

    it('and the closing bound actually binds — which it never did while the day was unreadable', () => {
        expect(ProductWindowCovers(null, new Date('2026-08-13T00:00:00.000Z'), '2026-08-15')).toBe('Outside');
        expect(ProductWindowCovers(null, new Date('2026-08-20T00:00:00.000Z'), '2026-08-15')).toBe('Covers');
    });

    it('is INCLUSIVE at both ends, matching the SQL: the first and last day are both sellable', () => {
        expect(ProductWindowCovers(new Date('2026-08-15T00:00:00.000Z'), null, '2026-08-15')).toBe('Covers');
        expect(ProductWindowCovers(null, new Date('2026-08-15T00:00:00.000Z'), '2026-08-15')).toBe('Covers');
    });

    it('a window entirely in the future or entirely in the past is Outside', () => {
        expect(ProductWindowCovers('2027-01-01', '2027-12-31', '2026-08-15')).toBe('Outside');
        expect(ProductWindowCovers('2025-01-01', '2025-12-31', '2026-08-15')).toBe('Outside');
    });

    it('NULL at either end means that end is open, and both NULL means always available', () => {
        expect(ProductWindowCovers(null, null, '2026-08-15')).toBe('Covers');
        expect(ProductWindowCovers(undefined, undefined, '2026-08-15')).toBe('Covers');
    });

    /**
     * A STRING BOUND IS TAKEN AS WRITTEN, never re-based. `2026-08-15T23:00:00-05:00` is the 15th as
     * stored; parsing it and formatting in UTC would render the 16th and move the window a day.
     */
    it('a string bound is the day it begins with, not the day it re-parses to', () => {
        expect(ProductWindowCovers('2026-08-15T23:00:00-05:00', null, '2026-08-15')).toBe('Covers');
        expect(ProductWindowCovers(null, '2026-08-15T23:00:00-05:00', '2026-08-15')).toBe('Covers');
    });

    /**
     * PRESENT BUT UNREADABLE IS ITS OWN ANSWER. Reading it as an open end is precisely how the old
     * comparison hid: a bound nobody could parse behaved like a bound nobody had set.
     */
    it('reports Unreadable for a bound that is present and is not a day', () => {
        expect(ProductWindowCovers('Thu Aug 13', null, '2026-08-15')).toBe('Unreadable');
        expect(ProductWindowCovers(new Date('nonsense'), null, '2026-08-15')).toBe('Unreadable');
        expect(ProductWindowCovers('2026-02-30', null, '2026-08-15')).toBe('Unreadable');
    });

    it('refuses a day that is not a zero-padded YYYY-MM-DD, as the filter builder does', () => {
        expect(() => ProductWindowCovers(null, null, '2026-8-15')).toThrow(/calendar day/);
        expect(() => ProductWindowCovers(null, null, '')).toThrow(/calendar day/);
    });
});
