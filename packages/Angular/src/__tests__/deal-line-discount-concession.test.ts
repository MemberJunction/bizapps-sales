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
        Working: { ProductID: 'p-1', DiscountPct: current, GetFieldByName: () => undefined },
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
