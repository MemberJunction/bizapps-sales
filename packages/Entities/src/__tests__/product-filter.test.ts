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

import { ProductFilterFor } from '../product-filter.js';

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
