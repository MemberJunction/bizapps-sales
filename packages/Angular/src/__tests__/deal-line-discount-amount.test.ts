import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * A rep can state a line's discount in dollars. The dollars are converted to a percent of the list
 * amount orders priced, stored on `DiscountPct`, and held to the percent's rules from there.
 */
type Editor = MJSDealLineEditorComponent & { pricedTotal: number | null; pricedDiscount: number | null };

function editor(opts: { saved?: number | null; current?: number | null; net?: number | null; discount?: number | null }) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as Editor;
    Object.assign(e, {
        IsLocked: false,
        DiscountRefusal: null,
        DiscountCategory: null,
        DiscountReason: '',
        DiscountUnit: 'Percent',
        DiscountAmountInput: null,
        EngineDefault: undefined,
        Deal: { OrderID_Object: {} },
        Working: { ProductID: 'p-1', DiscountPct: opts.current ?? null, GetFieldByName: () => undefined },
    });
    Object.defineProperty(e, 'savedDiscountPct', { value: opts.saved ?? null, writable: true });
    Object.defineProperty(e, 'pricedTotal', { value: opts.net ?? null, writable: true });
    Object.defineProperty(e, 'pricedDiscount', { value: opts.discount ?? null, writable: true });
    Object.defineProperty(e, 'pricePending', { value: false, writable: true });
    Object.defineProperty(e, 'priceTimer', { value: null, writable: true });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    return e;
}

describe('a discount typed in dollars', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stores the percent of orders\' list amount', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(60);
        expect(e.Working?.DiscountPct).toBe(0.25);
        expect(e.DiscountPercent).toBe(25);
        expect(e.DiscountRefusal).toBeNull();
    });

    it('reads the list amount back from net plus discount on an already discounted line', () => {
        // Priced at 10% off 240: net 216, discount 24. $60 is still 25% of the 240 list.
        const e = editor({ current: 0.1, net: 216, discount: 24 });
        e.SetDiscountUnit('Amount');
        expect(e.DiscountAmountInput).toBe(24);
        e.SetDiscountAmount(60);
        expect(e.Working?.DiscountPct).toBe(0.25);
    });

    it('asks for a concession reason when the dollars raise the discount', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(60);
        expect(e.NeedsDiscountReason).toBe(true);
        expect(e.CanSave).toBe(false);
    });

    it('refuses more than the list amount and blocks the save', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(300);
        expect(e.DiscountRefusal).toMatch(/more than the line's list amount/);
        expect(e.Working?.DiscountPct).toBeNull();
        expect(e.CanSave).toBe(false);
    });

    it('refuses until orders has priced the line', () => {
        const e = editor({});
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(10);
        expect(e.DiscountRefusal).toMatch(/no list amount/);
    });

    it('records a sub-one-percent result rather than refusing it as ambiguous', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(1);
        expect(e.DiscountRefusal).toBeNull();
        expect(e.Working?.DiscountPct).toBe(0.0042);
    });

    it('says so when the 0.01% precision moves orders\' discount off the typed amount', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(1);
        // Orders prices 0.42% of 240 as 1.01.
        e.pricedDiscount = 1.01;
        Object.defineProperty(e, 'pricePending', { value: false, writable: true });
        expect(e.DiscountAmountRounded).toBe(true);
    });

    it('switching back to percent keeps the stored percent', () => {
        const e = editor({ net: 240, discount: 0 });
        e.SetDiscountUnit('Amount');
        e.SetDiscountAmount(60);
        e.SetDiscountUnit('Percent');
        expect(e.DiscountPercent).toBe(25);
        expect(e.DiscountAmountInput).toBeNull();
    });
});
