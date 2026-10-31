import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * A raised discount needs a reason before the line saves, because the reason becomes the concession
 * orders' confirm gate holds the order on (golive#305).
 */
function editor(saved: number | null, current: number | null) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    Object.assign(e, {
        IsLocked: false,
        DiscountRefusal: null,
        DiscountCategory: null,
        DiscountReason: '',
        EngineDefault: undefined,
        Deal: { OrderID_Object: {} },
        Working: { ProductID: 'p-1', Quantity: 1, DiscountPct: current, GetFieldByName: () => undefined },
    });
    Object.defineProperty(e, 'savedDiscountPct', { value: saved, writable: true });
    return e;
}

describe('a raised discount asks for a reason', () => {
    it('blocks the save until a category and a reason are given', () => {
        const e = editor(null, 0.1);
        expect(e.NeedsDiscountReason).toBe(true);
        expect(e.CanSave).toBe(false);
        expect(e.BlockedReason).toMatch(/reason for the discount/);

        e.DiscountCategory = 'Retention';
        e.DiscountReason = 'keep the account';
        expect(e.CanSave).toBe(true);
    });

    it('asks nothing when the discount was not raised', () => {
        const e = editor(0.1, 0.05);
        expect(e.NeedsDiscountReason).toBe(false);
        expect(e.CanSave).toBe(true);
    });
});

/**
 * golive#340: the reason is asked for when orders' priced discount is worth more than the line's Pending
 * or Approved concessions cover, not when the percent rose over the saved percent.
 */
function pricedEditor(opts: {
    saved: number | null;
    current: number | null;
    discount: number | null;
    covered: number | null;
    engine?: { UnitPrice: number; ProductPriceID: string | null; PriceName: string | null } | null;
    renews?: string | null;
}) {
    const e = editor(opts.saved, opts.current);
    Object.assign(e, { EngineDefault: opts.engine === undefined ? { UnitPrice: 100, ProductPriceID: null, PriceName: null } : opts.engine });
    if (e.Working) Object.assign(e.Working, { RenewsSubscriptionID: opts.renews ?? null });
    Object.defineProperty(e, 'pricedDiscount', { value: opts.discount, writable: true });
    Object.defineProperty(e, 'pricePending', { value: false, writable: true });
    Object.defineProperty(e, 'coveredValue', { value: opts.covered, writable: true });
    return e;
}

describe('the discount is measured in orders\' dollars against what the line\'s concessions cover', () => {
    it('asks again on reopen when the earlier concession was refused', () => {
        // Saved at 10%, nothing recorded: the percent did not move, the line is still uncovered.
        expect(pricedEditor({ saved: 0.1, current: 0.1, discount: 100, covered: 0 }).NeedsDiscountReason).toBe(true);
    });

    it('asks when the quantity rose at the same percent', () => {
        expect(pricedEditor({ saved: 0.1, current: 0.1, discount: 500, covered: 100 }).NeedsDiscountReason).toBe(true);
    });

    it('asks nothing when an approved or pending concession already covers the discount', () => {
        expect(pricedEditor({ saved: 0.1, current: 0.1, discount: 100, covered: 100 }).NeedsDiscountReason).toBe(false);
    });

    it('asks nothing for a product no rule prices, or a renewal line', () => {
        expect(pricedEditor({ saved: null, current: 0.1, discount: 100, covered: 0, engine: null }).NeedsDiscountReason).toBe(false);
        expect(pricedEditor({ saved: null, current: 0.1, discount: 100, covered: 0, renews: 'sub-1' }).NeedsDiscountReason).toBe(false);
    });

    it('records nothing, and so shows no notice, for a line orders does not value', async () => {
        const e = pricedEditor({ saved: null, current: 0.1, discount: 100, covered: 0, engine: null });
        e.DiscountCategory = 'Retention';
        e.DiscountReason = 'keep the account';
        const notice = await (e as unknown as { recordDiscountConcession(): Promise<string | null> }).recordDiscountConcession();
        expect(notice).toBeNull();
    });
});
