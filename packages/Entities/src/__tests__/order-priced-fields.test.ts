import { describe, expect, it } from 'vitest';
import {
    DEAL_ORDER_PRICED_FIELDS,
    DealMoneyComesFromOrder,
    DealOrderPricedEditRefusal,
    IsDealOrderPricedField,
} from '../order-priced-fields';

/** golive #485: Amount, MRR and ARR are read-only on a deal with products, typed without. */
describe('the order-priced deal fields', () => {
    it('are Amount, MRR and ARR', () => {
        expect([...DEAL_ORDER_PRICED_FIELDS]).toEqual(['Amount', 'MRR', 'ARR']);
        expect(IsDealOrderPricedField('MRR')).toBe(true);
        expect(IsDealOrderPricedField('TermMonths')).toBe(false);
    });

    it('come from the order only when the saved row says so', () => {
        expect(DealMoneyComesFromOrder(true)).toBe(true);
        expect(DealMoneyComesFromOrder(false)).toBe(false);
        expect(DealMoneyComesFromOrder(null)).toBe(false);
        expect(DealMoneyComesFromOrder(undefined)).toBe(false);
    });

    it('refuse a typed figure on a deal with products and name it', () => {
        const message = DealOrderPricedEditRefusal(true, ['ARR', 'Description'], (n) => `<${n}>`);
        expect(message).toContain('<ARR>');
        expect(message).not.toContain('Description');
    });

    it('allow it without products, or when none of the three changed', () => {
        expect(DealOrderPricedEditRefusal(false, ['Amount', 'MRR'])).toBeNull();
        expect(DealOrderPricedEditRefusal(true, ['Description'])).toBeNull();
    });
});
