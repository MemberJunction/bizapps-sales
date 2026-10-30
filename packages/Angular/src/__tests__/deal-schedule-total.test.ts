import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import {
    ExplainDealScheduleGap,
    ReadDealScheduleTotal,
    type DealScheduleRowFigures,
} from '../lib/form-panels/deal-schedule-total';
import { MJSDealSchedulePanel } from '../lib/form-panels/deal-form.panels';

/**
 * The Payment schedule panel's running total (bc-aidp-next-golive#290).
 *
 * The reported case: four instalments adding up to 23,999.99 on a 24,000 deal saved with no total and
 * no warning. A cent is the whole point, so the boundary is pinned at the cent, in both directions.
 */

const row = (Amount: number | null, PaymentDate: string | null = '2026-10-01'): DealScheduleRowFigures => ({ Amount, PaymentDate });
const money = (n: number): string => `$${n.toFixed(2)}`;

describe('ReadDealScheduleTotal', () => {
    it('ties when the rows add up to the deal amount', () => {
        const total = ReadDealScheduleTotal([row(6000), row(6000), row(6000), row(6000)], 24000);
        expect(total).toMatchObject({ RowCount: 4, Scheduled: 24000, DealAmount: 24000, Remainder: 0, Ties: true });
    });

    it('catches a schedule one cent short', () => {
        const total = ReadDealScheduleTotal([row(6000), row(6000), row(6000), row(5999.99)], 24000);
        expect(total.Scheduled).toBe(23999.99);
        expect(total.Remainder).toBe(0.01);
        expect(total.Ties).toBe(false);
    });

    it('catches a schedule one cent over', () => {
        const total = ReadDealScheduleTotal([row(12000), row(12000.01)], 24000);
        expect(total.Remainder).toBe(-0.01);
        expect(total.Ties).toBe(false);
    });

    /** 1000.1 + 1000.2 is 2000.3000000000002 in floating point; in cents it is exact. */
    it('ties on amounts that do not add exactly as floats', () => {
        const total = ReadDealScheduleTotal([row(1000.1), row(1000.2)], 2000.3);
        expect(total.Scheduled).toBe(2000.3);
        expect(total.Remainder).toBe(0);
        expect(total.Ties).toBe(true);
    });

    it('shows the scheduled total but no remainder when the deal has no amount yet', () => {
        const total = ReadDealScheduleTotal([row(500)], null);
        expect(total).toMatchObject({ Scheduled: 500, DealAmount: null, Remainder: null, Ties: true });
    });

    /** No rows is no schedule: the order bills in one amount. The panel shows nothing. */
    it('treats no rows as no schedule rather than a gap', () => {
        expect(ReadDealScheduleTotal([], 24000)).toMatchObject({ RowCount: 0, Scheduled: 0, Ties: true });
        expect(ExplainDealScheduleGap(ReadDealScheduleTotal([], 24000), money)).toBeNull();
    });

    it('counts rows the order would refuse: no amount, no date, zero or negative', () => {
        const total = ReadDealScheduleTotal([row(24000), row(null), row(100, null), row(0), row(-5)], 24000);
        expect(total.Incomplete).toBe(4);
        expect(total.Ties).toBe(false);
    });

    it('does not tie with a zero row even when the sum matches', () => {
        const total = ReadDealScheduleTotal([row(24000), row(0)], 24000);
        expect(total.Remainder).toBe(0);
        expect(total.Ties).toBe(false);
    });
});

describe('ExplainDealScheduleGap', () => {
    it('says nothing when the schedule ties', () => {
        expect(ExplainDealScheduleGap(ReadDealScheduleTotal([row(24000)], 24000), money)).toBeNull();
    });

    it('names the unscheduled amount in one sentence', () => {
        const sentence = ExplainDealScheduleGap(ReadDealScheduleTotal([row(23999.99)], 24000), money) ?? '';
        expect(sentence).toContain('$0.01 of the deal amount is not scheduled');
        expect(sentence.match(/\./g)?.length, 'one sentence: the cents and the final stop').toBe(2);
    });

    it('names the excess when the rows come to more than the deal', () => {
        const sentence = ExplainDealScheduleGap(ReadDealScheduleTotal([row(24000.5)], 24000), money) ?? '';
        expect(sentence).toContain('$0.50 more than the deal amount');
    });

    it('names an incomplete row ahead of the arithmetic, since typing its amount moves the gap', () => {
        const sentence = ExplainDealScheduleGap(ReadDealScheduleTotal([row(100), row(null)], 24000), money) ?? '';
        expect(sentence).toContain('1 instalment has no date or no amount');
        expect(sentence).not.toContain('not scheduled');
    });
});

describe('MJSDealSchedulePanel total', () => {
    function panel(amount: number | null, rows: DealScheduleRowFigures[] | null): MJSDealSchedulePanel {
        const p = Object.create(MJSDealSchedulePanel.prototype) as MJSDealSchedulePanel;
        Object.defineProperty(p, 'Record', { value: { Amount: amount, CurrencyID: null } });
        p.Rows = rows;
        return p;
    }

    it('shows nothing before the rows are read', () => {
        expect(panel(24000, null).Total).toBeNull();
    });

    it('labels the remainder', () => {
        expect(panel(24000, [row(23999.99)]).RemainderLabel).toMatch(/^Remaining .*0\.01$/);
        expect(panel(24000, [row(24000)]).RemainderLabel).toBe('Nothing remaining');
        expect(panel(24000, [row(24000.5)]).RemainderLabel).toMatch(/^Over by .*0\.50$/);
    });

    it('reads the deal amount as it stands on the form', () => {
        const p = panel(24000, [row(12000)]);
        expect(p.Total?.Remainder).toBe(12000);
        expect(p.GapSentence).toContain('of the deal amount is not scheduled');
    });
});
