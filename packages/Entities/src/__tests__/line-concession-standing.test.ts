import { describe, expect, it } from 'vitest';
import {
    LargestStandingConcessionValue,
    LineDiscountNeedsConcession,
    ResolveLineConcessionState,
    type LineConcessionRow,
    type LineDiscountFacts,
} from '../discount-concession';

/**
 * golive#340: a line's discount is measured in orders' dollars against what its concessions already
 * cover, and a discounted line says where its concession stands.
 */
function facts(over: Partial<LineDiscountFacts>): LineDiscountFacts {
    return {
        SavedPct: 0.1,
        CurrentPct: 0.1,
        DiscountValue: 300,
        CoveredValue: 300,
        OrdersValuesLine: true,
        PriceOverridden: false,
        ...over,
    };
}

function row(over: Partial<LineConcessionRow>): LineConcessionRow {
    return {
        ID: 'c-1',
        OrderLineID: 'line-1',
        Status: 'Approved',
        ComputedValue: 300,
        DecidedByUserID: 'user-1',
        __mj_CreatedAt: '2026-10-20T10:00:00Z',
        ...over,
    };
}

describe('LineDiscountNeedsConcession', () => {
    it('asks again after a refused concession left the line uncovered at the same percent', () => {
        expect(LineDiscountNeedsConcession(facts({ CoveredValue: 0 }))).toBe(true);
    });

    it('asks when the quantity or price rose at the same percent', () => {
        // 10% of 5 units is worth more than the concession recorded for 1 unit.
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: 1500, CoveredValue: 300 }))).toBe(true);
    });

    it('asks nothing when the line is covered, even with a higher percent on a smaller line', () => {
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: 300, CoveredValue: 300 }))).toBe(false);
        expect(LineDiscountNeedsConcession(facts({ CurrentPct: 0.12, DiscountValue: 120, CoveredValue: 300 }))).toBe(false);
    });

    it('still asks on a raised percent when the price is also overridden', () => {
        // Orders' stored value then includes the price cut, which sales cannot separate out.
        expect(LineDiscountNeedsConcession(facts({ CurrentPct: 0.15, DiscountValue: 200, CoveredValue: 500, PriceOverridden: true }))).toBe(true);
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: 200, CoveredValue: 500, PriceOverridden: true }))).toBe(false);
    });

    it('asks nothing for a line orders does not value, or with no discount', () => {
        expect(LineDiscountNeedsConcession(facts({ CoveredValue: 0, OrdersValuesLine: false }))).toBe(false);
        expect(LineDiscountNeedsConcession(facts({ CurrentPct: 0, DiscountValue: 0, CoveredValue: 0 }))).toBe(false);
    });

    it('falls back to the percent rule when the concessions could not be read', () => {
        expect(LineDiscountNeedsConcession(facts({ CoveredValue: null }))).toBe(false);
        expect(LineDiscountNeedsConcession(facts({ CoveredValue: null, CurrentPct: 0.15 }))).toBe(true);
    });

    it('asks while unpriced when nothing covers the line, and otherwise uses the percent rule', () => {
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: null, CoveredValue: 0 }))).toBe(true);
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: null, CoveredValue: 300 }))).toBe(false);
        expect(LineDiscountNeedsConcession(facts({ DiscountValue: null, CoveredValue: 300, CurrentPct: 0.15 }))).toBe(true);
    });
});

describe('LargestStandingConcessionValue', () => {
    it('takes the largest Pending or Approved value and ignores a Rejected one', () => {
        expect(
            LargestStandingConcessionValue([
                row({ ComputedValue: 300 }),
                row({ ID: 'c-2', Status: 'Pending', DecidedByUserID: null, ComputedValue: 450 }),
                row({ ID: 'c-3', Status: 'Rejected', ComputedValue: 900 }),
            ]),
        ).toBe(450);
    });

    it('is 0 with nothing standing', () => {
        expect(LargestStandingConcessionValue([])).toBe(0);
        expect(LargestStandingConcessionValue([row({ Status: 'Rejected' })])).toBe(0);
    });
});

describe('ResolveLineConcessionState', () => {
    const discounted = { DiscountPct: 0.1, OrdersValuesLine: true };

    it('says nothing for a line without a discount', () => {
        expect(ResolveLineConcessionState({ ...discounted, DiscountPct: 0, Rows: [] })).toBe('NotNeeded');
    });

    it('reports a concession waiting for a decision', () => {
        expect(ResolveLineConcessionState({ ...discounted, Rows: [row({ Status: 'Pending', DecidedByUserID: null })] })).toBe('Pending');
    });

    it('reports the latest decision, so a rejected raise shows over an older approval', () => {
        const rows = [
            row({ ID: 'old', __mj_CreatedAt: '2026-10-01T00:00:00Z' }),
            row({ ID: 'new', Status: 'Rejected', __mj_CreatedAt: '2026-10-10T00:00:00Z' }),
        ];
        expect(ResolveLineConcessionState({ ...discounted, Rows: rows })).toBe('Rejected');
        expect(ResolveLineConcessionState({ ...discounted, Rows: [row({})] })).toBe('Approved');
    });

    it('reports a discount with no concession as not recorded, only when orders values the line', () => {
        expect(ResolveLineConcessionState({ ...discounted, Rows: [] })).toBe('NotRecorded');
        expect(ResolveLineConcessionState({ ...discounted, OrdersValuesLine: false, Rows: [] })).toBe('NotNeeded');
        expect(ResolveLineConcessionState({ ...discounted, OrdersValuesLine: null, Rows: [] })).toBe('Unknown');
    });
});
