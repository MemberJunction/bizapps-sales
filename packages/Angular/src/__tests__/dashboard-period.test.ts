/**
 * @fileoverview The fiscal period windows, asserted at their BOUNDARIES.
 *
 * Every defect this module can carry is an off-by-one at an edge, and an off-by-one at an edge is
 * invisible on screen: a quarter that starts a day late still renders a plausible number. So each
 * case asserts the first day IN, the last day IN, and the day either side OUT — the three facts a
 * window actually makes — rather than spot-checking a date in the middle, which passes for any
 * window wide enough to contain it.
 *
 * The off-calendar starts are not decoration. A 1 January fixture proves nothing about the code paths
 * that exist BECAUSE the start is configurable: month normalisation past December, day clamping on a
 * short month, and a quarter index that cannot be derived by dividing a month difference by three.
 */
import { describe, expect, it } from 'vitest';

import {
    CALENDAR_YEAR_START,
    DescribeFiscalBasis,
    FiscalQuarterOf,
    FiscalYearOf,
    FormatWindow,
    PERIOD_OPTIONS,
    ResolveFiscalYearStart,
    ResolvePeriod,
    WithinWindow,
    type FiscalYearStart,
} from '../lib/pages/dashboard-period';

const JANUARY: FiscalYearStart = { Month: 1, Day: 1 };
const JULY: FiscalYearStart = { Month: 7, Day: 1 };
/** The UK tax year. A non-first day, which is where month arithmetic stops being enough. */
const APRIL_6: FiscalYearStart = { Month: 4, Day: 6 };
/** Starts on a 31st, so two of its four quarter boundaries land on months that have no 31st. */
const JANUARY_31: FiscalYearStart = { Month: 1, Day: 31 };

describe('ResolveFiscalYearStart', () => {
    it('reports a calendar fallback and its CAUSE, so the three failure modes stay distinguishable', () => {
        // null means the entity is not in metadata; [] means it is, and nobody has configured one.
        // Both fall back, and the fix for each is different, so the basis must not collapse to a boolean.
        expect(ResolveFiscalYearStart(null)).toEqual({ Start: CALENDAR_YEAR_START, Basis: 'no-accounting' });
        expect(ResolveFiscalYearStart([])).toEqual({ Start: CALENDAR_YEAR_START, Basis: 'no-profiles' });
    });

    it('agreement is about the VALUE, not the row count — five January companies are not a conflict', () => {
        const rows = [JANUARY, { Month: 1, Day: 1 }, { Month: 1, Day: 1 }];
        expect(ResolveFiscalYearStart(rows)).toEqual({ Start: { Month: 1, Day: 1 }, Basis: 'profile' });
    });

    it('takes the configured start when every active profile agrees', () => {
        expect(ResolveFiscalYearStart([JULY, { Month: 7, Day: 1 }])).toEqual({
            Start: { Month: 7, Day: 1 },
            Basis: 'profile',
        });
    });

    it('REFUSES to pick when companies disagree, and falls back to the calendar', () => {
        // The dashboard is not company-scoped, so a windowed figure spanning both companies would be
        // right for one and wrong for the other with nothing on screen saying which.
        const resolution = ResolveFiscalYearStart([JULY, APRIL_6]);
        expect(resolution.Basis).toBe('mixed');
        expect(resolution.Start).toEqual(CALENDAR_YEAR_START);
    });

    it('a disagreement only on the DAY is still a disagreement', () => {
        expect(ResolveFiscalYearStart([{ Month: 4, Day: 1 }, { Month: 4, Day: 6 }]).Basis).toBe('mixed');
    });

    it('every basis describes itself without naming an internal state', () => {
        for (const rows of [null, [], [JULY], [JULY, APRIL_6]]) {
            const text = DescribeFiscalBasis(ResolveFiscalYearStart(rows));
            expect(text.length).toBeGreaterThan(0);
            expect(text).not.toMatch(/no-accounting|no-profiles|undefined/);
        }
    });

    it('PENDING is describable and does not claim accounting is absent', () => {
        // The selector renders before the read resolves, so the pre-load basis is on screen. It used
        // to be seeded with 'no-accounting', which told every reader on an accounting host that the
        // app was not installed. Whatever the wording, it must not assert absence.
        const text = DescribeFiscalBasis({ Start: CALENDAR_YEAR_START, Basis: 'pending' });
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/not installed|no company profile|disagree/i);
    });

    it('is never itself the PENDING basis — that state belongs to the caller, not to the resolver', () => {
        for (const rows of [null, [], [JULY], [JULY, APRIL_6]]) {
            expect(ResolveFiscalYearStart(rows).Basis).not.toBe('pending');
        }
    });
});

describe('FiscalYearOf — labelled by the year it STARTS in, matching accounting', () => {
    it('is the calendar year when the year starts in January', () => {
        expect(FiscalYearOf('2026-01-01', JANUARY)).toBe(2026);
        expect(FiscalYearOf('2026-12-31', JANUARY)).toBe(2026);
    });

    it('a July-start year spanning two calendar years takes the EARLIER label', () => {
        // bizapps-accounting's deriveFiscalYear() documents this convention; a dashboard that called
        // the same span FY2027 would be reporting against a year the ledger does not use.
        expect(FiscalYearOf('2026-06-30', JULY)).toBe(2025);
        expect(FiscalYearOf('2026-07-01', JULY)).toBe(2026);
        expect(FiscalYearOf('2027-06-30', JULY)).toBe(2026);
    });

    it('rolls over on the START DAY, not on the first of the start month', () => {
        expect(FiscalYearOf('2026-04-05', APRIL_6)).toBe(2025);
        expect(FiscalYearOf('2026-04-06', APRIL_6)).toBe(2026);
    });

    /**
     * PINS THE ONE CASE WHERE THIS DIVERGES FROM ACCOUNTING, so the divergence is a decision on
     * record rather than something a later reader discovers in production.
     *
     * `CK_AccountingCompanyProfile_FiscalDay` allows day 1-31 against any month, so a profile can
     * name a start that does not exist in its own month. `deriveFiscalYear()` compares the raw day
     * (28 < 29 → still last year); this module compares the CLAMPED anchor, because every quarter
     * boundary is derived from the same anchors and a rollover using the raw day would produce a
     * window that does not contain the date that selected it. Containment is asserted here too, so
     * the trade-off cannot be undone by accident.
     */
    it('clamps an impossible start day, which is the one place it does NOT match deriveFiscalYear', () => {
        const FEB_29: FiscalYearStart = { Month: 2, Day: 29 };
        // Accounting reads 28 Feb 2027 as still FY2026; the clamp puts it on the FY2027 boundary.
        expect(FiscalYearOf('2027-02-28', FEB_29)).toBe(2027);
        expect(FiscalYearOf('2027-02-27', FEB_29)).toBe(2026);
        // The reason the clamp wins: the selected window must contain the date that selected it.
        const w = ResolvePeriod('quarter', FEB_29, '2027-02-28');
        expect(w.Start!.localeCompare('2027-02-28')).toBeLessThanOrEqual(0);
        expect(w.End!.localeCompare('2027-02-28')).toBeGreaterThanOrEqual(0);
    });
});

describe('ResolvePeriod — a January start reproduces plain calendar quarters', () => {
    it('Q1 runs 1 Jan to 31 Mar', () => {
        const w = ResolvePeriod('quarter', JANUARY, '2026-02-14');
        expect(w.Start).toBe('2026-01-01');
        expect(w.End).toBe('2026-03-31');
    });

    it('Q4 runs 1 Oct to 31 Dec, and does not bleed into January', () => {
        const w = ResolvePeriod('quarter', JANUARY, '2026-12-31');
        expect(w.Start).toBe('2026-10-01');
        expect(w.End).toBe('2026-12-31');
    });

    it('the fiscal year is the whole calendar year', () => {
        const w = ResolvePeriod('year', JANUARY, '2026-08-09');
        expect(w.Start).toBe('2026-01-01');
        expect(w.End).toBe('2026-12-31');
    });
});

describe('ResolvePeriod — an off-calendar (July) start', () => {
    it('Q1 begins on the fiscal start, not in January', () => {
        const w = ResolvePeriod('quarter', JULY, '2026-08-15');
        expect(w.Start).toBe('2026-07-01');
        expect(w.End).toBe('2026-09-30');
    });

    it('Q3 crosses the calendar new year without a special case', () => {
        const w = ResolvePeriod('quarter', JULY, '2027-02-10');
        expect(w.Start).toBe('2027-01-01');
        expect(w.End).toBe('2027-03-31');
    });

    it('the fiscal YEAR spans two calendar years', () => {
        const w = ResolvePeriod('year', JULY, '2027-02-10');
        expect(w.Start).toBe('2026-07-01');
        expect(w.End).toBe('2027-06-30');
    });

    it('the last day of the fiscal year and the first day of the next are adjacent, never overlapping', () => {
        const ending = ResolvePeriod('year', JULY, '2027-06-30');
        const starting = ResolvePeriod('year', JULY, '2027-07-01');
        expect(ending.End).toBe('2027-06-30');
        expect(starting.Start).toBe('2027-07-01');
    });
});

describe('ResolvePeriod — a start day that is not the 1st (6 April)', () => {
    it('quarters run from the 6th to the 5th', () => {
        const w = ResolvePeriod('quarter', APRIL_6, '2026-05-01');
        expect(w.Start).toBe('2026-04-06');
        expect(w.End).toBe('2026-07-05');
    });

    it('3 July is still Q1 — the case a month-difference calculation gets wrong', () => {
        // Dividing (month - startMonth) by three puts July in Q2. Comparing against the real anchors
        // does not, which is why FiscalQuarterOf walks the anchors instead of doing arithmetic.
        expect(FiscalQuarterOf('2026-07-03', 2026, APRIL_6)).toBe(0);
        expect(FiscalQuarterOf('2026-07-06', 2026, APRIL_6)).toBe(1);
    });

    it('the last day of one quarter is the day before the next begins', () => {
        const q1 = ResolvePeriod('quarter', APRIL_6, '2026-07-05');
        const q2 = ResolvePeriod('quarter', APRIL_6, '2026-07-06');
        expect(q1.End).toBe('2026-07-05');
        expect(q2.Start).toBe('2026-07-06');
    });
});

describe('ResolvePeriod — a 31st start clamps rather than rolling into the next month', () => {
    it('Q2 of a 31 January year starts 30 April, not 1 May', () => {
        // Date.UTC(y, 3, 31) is 1 May. Left unclamped, every Q2 boundary would be a day late and no
        // fixture starting on a 1st could reveal it.
        const w = ResolvePeriod('quarter', JANUARY_31, '2026-05-15');
        expect(w.Start).toBe('2026-04-30');
        expect(w.End).toBe('2026-07-30');
    });

    it('the fiscal year still closes the day before the next one opens', () => {
        const w = ResolvePeriod('year', JANUARY_31, '2026-06-01');
        expect(w.Start).toBe('2026-01-31');
        expect(w.End).toBe('2027-01-30');
    });
});

describe('ResolvePeriod — last quarter', () => {
    it('is the immediately preceding quarter within the same fiscal year', () => {
        const w = ResolvePeriod('lastquarter', JANUARY, '2026-08-09');
        expect(w.Start).toBe('2026-04-01');
        expect(w.End).toBe('2026-06-30');
    });

    it('rolls back across the FISCAL year boundary from Q1, not across the calendar one', () => {
        const w = ResolvePeriod('lastquarter', JULY, '2026-08-15');
        expect(w.Start).toBe('2026-04-01');
        expect(w.End).toBe('2026-06-30');
    });

    it('from Q1 of a January year it is the previous calendar year Q4', () => {
        const w = ResolvePeriod('lastquarter', JANUARY, '2026-01-01');
        expect(w.Start).toBe('2025-10-01');
        expect(w.End).toBe('2025-12-31');
    });

    it('never overlaps the current quarter', () => {
        const last = ResolvePeriod('lastquarter', APRIL_6, '2026-08-20');
        const now = ResolvePeriod('quarter', APRIL_6, '2026-08-20');
        expect(last.End! < now.Start!).toBe(true);
    });
});

describe('ResolvePeriod — leap years', () => {
    it('a February quarter ends on the 29th in a leap year and the 28th otherwise', () => {
        const leap = ResolvePeriod('quarter', { Month: 12, Day: 1 }, '2028-01-15');
        expect(leap.Start).toBe('2027-12-01');
        expect(leap.End).toBe('2028-02-29');

        const common = ResolvePeriod('quarter', { Month: 12, Day: 1 }, '2027-01-15');
        expect(common.End).toBe('2027-02-28');
    });

    it('29 February resolves without throwing', () => {
        expect(ResolvePeriod('quarter', JANUARY, '2028-02-29').End).toBe('2028-03-31');
    });
});

describe('alltime', () => {
    it('is UNBOUNDED, not a very wide window', () => {
        // A wide pair of dates still excludes a row with no close date and still hides a badly-dated
        // one. Nulls omit the clause entirely, which is the question the tile is asking.
        expect(ResolvePeriod('alltime', JULY, '2026-08-15')).toMatchObject({ Start: null, End: null });
    });

    it('contains every date, including one with no bound to compare against', () => {
        const w = ResolvePeriod('alltime', JULY, '2026-08-15');
        expect(WithinWindow('1999-01-01', w)).toBe(true);
        expect(WithinWindow('2099-12-31', w)).toBe(true);
    });
});

describe('WithinWindow', () => {
    const w = ResolvePeriod('quarter', JULY, '2026-08-15');

    it('includes both endpoints — the windows are inclusive on both sides', () => {
        expect(WithinWindow('2026-07-01', w)).toBe(true);
        expect(WithinWindow('2026-09-30', w)).toBe(true);
    });

    it('excludes the day either side', () => {
        expect(WithinWindow('2026-06-30', w)).toBe(false);
        expect(WithinWindow('2026-10-01', w)).toBe(false);
    });
});

describe('presentation', () => {
    it('defaults to this quarter — the option the issue asked to land on', () => {
        expect(PERIOD_OPTIONS[0].Key).toBe('quarter');
        expect(PERIOD_OPTIONS.map((o) => o.Key)).toEqual(['quarter', 'lastquarter', 'year', 'alltime']);
    });

    it('states the bounds a reader would otherwise have to guess at', () => {
        expect(FormatWindow(ResolvePeriod('quarter', JULY, '2026-08-15'))).toBe('1 Jul 2026 – 30 Sep 2026');
        expect(FormatWindow(ResolvePeriod('alltime', JULY, '2026-08-15'))).toBe('all time');
    });
});
