/**
 * The period a snapshot belongs to is a BUSINESS calendar month (bc-aidp-next-golive#168).
 *
 * `CurrentMonthPeriod` read the month out of `now` with `getUTCMonth()`, which is right about one
 * thing and wrong about another, and the two are easy to confuse:
 *
 *  - RIGHT: the BOUNDARIES it produces are UTC midnight. `PeriodStart`/`PeriodEnd` are `DATE` columns
 *    — calendar days with no zone — and UTC midnight is the shape such a column round-trips as. That
 *    has not changed and the last test here pins it, because a zone conversion applied to a boundary
 *    would move every period back a day for anyone west of Greenwich. (That is precisely what the
 *    implementation plan's `isoDate` snippet would have done: `CalendarDayIn(2026-09-01T00:00Z,
 *    'America/Chicago')` is `2026-08-31`.)
 *
 *  - WRONG: WHICH month `now` falls in. That is a "today" question, and the business zone is what
 *    answers it. The nightly job runs in the evening, so on the last day of every month the UTC month
 *    had already rolled over while the business was still in the old one — and the snapshot for the
 *    month just ending was never taken, because by the time the job fired it was measuring the next.
 *
 * THE PINNED INSTANT IS WEST OF GREENWICH, per the spec's §7 rule: `2026-09-01T02:00:00Z` is 21:00 on
 * 31 August in America/Chicago. An instant where the zones agree would leave this file green through
 * the defect it exists for.
 */
import { describe, expect, it } from 'vitest';

import { CurrentMonthPeriod } from '../forecast/ForecastSnapshotJob.js';

/** West of Greenwich, so the business month and the UTC month genuinely differ at the instant below. */
const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. When a nightly job actually runs. */
const EVENING_ON_MONTH_END = new Date('2026-09-01T02:00:00.000Z');

/** The day part of a boundary, read the way a `DATE` column is: from UTC parts. */
function day(when: Date): string {
    return when.toISOString().slice(0, 10);
}

describe('CurrentMonthPeriod picks the month in the zone it is given', () => {
    it('is still AUGUST at 9 PM on 31 August Central, though UTC has already rolled to September', () => {
        const period = CurrentMonthPeriod(EVENING_ON_MONTH_END, BUSINESS_ZONE);
        expect(day(period.PeriodStart)).toBe('2026-08-01');
        expect(day(period.PeriodEnd)).toBe('2026-08-31');
    });

    /**
     * The premise, asserted rather than assumed — CLAUDE.md rule 8. If the default ever stopped being
     * UTC the test above would still pass while proving nothing about the zone argument.
     */
    it('is SEPTEMBER at the same instant when nobody names a zone, which is the old behaviour', () => {
        const period = CurrentMonthPeriod(EVENING_ON_MONTH_END);
        expect(day(period.PeriodStart)).toBe('2026-09-01');
        expect(day(period.PeriodEnd)).toBe('2026-09-30');
    });

    it('the other direction: early on the 1st in UTC is still last month for a zone behind Greenwich', () => {
        const period = CurrentMonthPeriod(new Date('2026-04-01T00:30:00.000Z'), BUSINESS_ZONE);
        expect(day(period.PeriodStart)).toBe('2026-03-01');
        expect(day(period.PeriodEnd)).toBe('2026-03-31');
    });

    it('a leap February ends on the 29th and a common one on the 28th', () => {
        expect(day(CurrentMonthPeriod(new Date('2028-02-10T12:00:00.000Z'), BUSINESS_ZONE).PeriodEnd)).toBe('2028-02-29');
        expect(day(CurrentMonthPeriod(new Date('2026-02-10T12:00:00.000Z'), BUSINESS_ZONE).PeriodEnd)).toBe('2026-02-28');
    });

    /**
     * THE BOUNDARIES STAY UTC MIDNIGHT, whatever zone chose the month.
     *
     * This is the half a zone conversion would break. `PeriodStart` is a calendar day on its way to a
     * `DATE` column, not an instant — so 1 August is `2026-08-01T00:00:00.000Z` and NOT the instant
     * August began in Chicago (`2026-08-01T05:00:00.000Z`), which would read back as 31 July from the
     * UTC parts every reader of a `DATE` column uses.
     */
    it('produces UTC-midnight boundaries, not the instant the month began in the business zone', () => {
        const period = CurrentMonthPeriod(EVENING_ON_MONTH_END, BUSINESS_ZONE);
        expect(period.PeriodStart.toISOString()).toBe('2026-08-01T00:00:00.000Z');
        expect(period.PeriodEnd.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    });
});
