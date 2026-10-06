import { describe, it, expect } from 'vitest';
import { ReadDealScheduleTie, ExplainDealScheduleTie, type DealScheduleRow } from '../deal-schedule-tie';

/**
 * A DEAL'S PAYMENT SCHEDULE MUST TIE TO THE DEAL'S AMOUNT (bc-aidp-next-golive#290).
 *
 * The reported case: a $24,000 deal with four rows totalling $23,999.99 saved with no total, no
 * remainder and no warning. A penny is the whole point — anything that only catches a wildly wrong
 * schedule would have passed that one.
 *
 * ── WHY CENTS ──────────────────────────────────────────────────────────────────────────────────
 *
 * Both columns are `DECIMAL(18,2)`. Added as floats, 6000 + 6000 + 6000 + 5999.99 does not land on
 * 23999.99 exactly, so a naive `=== dealAmount` comparison is wrong in BOTH directions: it rejects
 * schedules that tie and, with a sloppy epsilon, accepts ones that do not. The tests below pin the
 * boundary at half a penny rather than trusting a tolerance nobody measured.
 */

const row = (Amount: number | null, PaymentDate: string | null = '2026-10-01'): DealScheduleRow => ({ Amount, PaymentDate });

describe('a schedule that ties', () => {
    it('ties when the rows add to the deal amount', () => {
        const tie = ReadDealScheduleTie([row(6000), row(6000), row(6000), row(6000)], 24000);
        expect(tie.Ties).toBe(true);
        expect(tie.Scheduled).toBe(24000);
        expect(tie.Remainder).toBe(0);
    });

    /** The float trap, with the reporter's own figures. */
    it('ties on amounts that do not add exactly as floats', () => {
        const tie = ReadDealScheduleTie([row(1000.1), row(1000.2)], 2000.3);
        expect(tie.Ties, '1000.1 + 1000.2 is 2000.3000000000002 in float').toBe(true);
        expect(tie.Remainder).toBe(0);
    });

    /**
     * NO ROWS IS NOT A BROKEN SCHEDULE. It is the implicit single instalment, which is how every deal
     * behaves today; refusing it would refuse every deal that never opened the panel.
     */
    it('ties when there are no rows at all', () => {
        const tie = ReadDealScheduleTie([], 24000);
        expect(tie.Ties).toBe(true);
        expect(tie.RowCount).toBe(0);
    });

    /** A schedule entered before the order prices the deal is premature, not wrong. */
    it('ties when the deal has no amount to tie to', () => {
        expect(ReadDealScheduleTie([row(6000)], null).Ties).toBe(true);
    });
});

describe('a schedule that does not tie', () => {
    /** The reported defect, to the penny. */
    it('catches a schedule one cent short', () => {
        const tie = ReadDealScheduleTie([row(6000), row(6000), row(6000), row(5999.99)], 24000);
        expect(tie.Ties).toBe(false);
        expect(tie.Remainder).toBeCloseTo(0.01, 10);
        expect(ExplainDealScheduleTie(tie)).toContain('0.01 unscheduled');
    });

    it('catches a schedule that overshoots', () => {
        const tie = ReadDealScheduleTie([row(12000), row(12000.5)], 24000);
        expect(tie.Ties).toBe(false);
        expect(ExplainDealScheduleTie(tie)).toContain('0.50 over-scheduled');
    });

    it('names both figures, so the rep does not have to work out which is which', () => {
        const message = ExplainDealScheduleTie(ReadDealScheduleTie([row(1)], 24000)) ?? '';
        expect(message).toContain('1.00 scheduled');
        expect(message).toContain('24000.00 on the deal');
    });
});

/**
 * A ROW MISSING A DATE OR AN AMOUNT CANNOT BECOME AN ORDER ROW.
 *
 * `OrderHeaderPaymentSchedule.DueDate` and `.Amount` are both NOT NULL while the deal's are nullable,
 * so the copy at Close Won would have to drop the row or invent a value. Refusing while the rep is
 * still looking at the panel is better than either.
 */
describe('a schedule with incomplete rows', () => {
    it('refuses a row with no amount, even when the rest tie', () => {
        const tie = ReadDealScheduleTie([row(24000), row(null)], 24000);
        expect(tie.Ties).toBe(false);
        expect(tie.Incomplete).toBe(1);
        expect(ExplainDealScheduleTie(tie)).toContain('missing a date or an amount');
    });

    it('refuses a row with no date', () => {
        const tie = ReadDealScheduleTie([row(24000, null)], 24000);
        expect(tie.Ties).toBe(false);
        expect(tie.Incomplete).toBe(1);
    });

    it('reports incompleteness ahead of the arithmetic, which the rep cannot act on yet', () => {
        // Both wrong: a blank row AND a shortfall. The blank row is the one to fix first, because an
        // amount typed into it changes the shortfall.
        const message = ExplainDealScheduleTie(ReadDealScheduleTie([row(100), row(null)], 24000)) ?? '';
        expect(message).toContain('missing a date or an amount');
        expect(message).not.toContain('unscheduled');
    });

    it('counts every incomplete row, not just the first', () => {
        expect(ReadDealScheduleTie([row(null), row(null, null)], 24000).Incomplete).toBe(2);
    });
});

describe('the explanation', () => {
    it('is absent when the schedule ties — there is nothing to say', () => {
        expect(ExplainDealScheduleTie(ReadDealScheduleTie([row(24000)], 24000))).toBeNull();
    });

    /**
     * Shaped after orders' `ExplainShortfalls` so the same problem reads the same way at Close Won and
     * at confirm. That alignment is by hand — orders' version lives in a package sales does not depend
     * on — so this holds the shape that makes the two recognisable as one rule.
     */
    it('reads like the order-side refusal it mirrors', () => {
        const message = ExplainDealScheduleTie(ReadDealScheduleTie([row(1)], 24000)) ?? '';
        expect(message).toContain('does not tie');
        expect(message).toContain('scheduled against');
        expect(message).toContain('Fix the schedule, or remove it');
    });
});
