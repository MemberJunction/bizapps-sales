import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * THE NOTE UNDER UNIT PRICE FOLLOWS THE LINE.
 *
 * It read the same whatever the rep did: with a custom amount typed in or a discount applied it
 * still said the price was calculated and offered the two things already done.
 */
function editor(state: { overridden: boolean; discountPercent: number; picker: boolean }): MJSDealLineEditorComponent {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    Object.defineProperty(e, 'ProductLockedByPrice', { get: () => state.overridden });
    Object.defineProperty(e, 'DiscountPercent', { get: () => state.discountPercent });
    Object.defineProperty(e, 'ShowPricePicker', { get: () => state.picker });
    return e;
}

describe('deal line price source note', () => {
    it('says the price is calculated, and how to change it, on an untouched line', () => {
        expect(editor({ overridden: false, discountPercent: 0, picker: true }).PriceSourceNote).toBe(
            'Calculated from the product\'s pricing. To change it, select another price above or apply a discount.',
        );
        expect(editor({ overridden: false, discountPercent: 0, picker: false }).PriceSourceNote).toBe(
            'Calculated from the product\'s pricing. To change it, apply a discount.',
        );
    });

    it('says the price was overridden once it is off the default, and how to put it back', () => {
        expect(editor({ overridden: true, discountPercent: 0, picker: true }).PriceSourceNote).toBe(
            'Price overridden. To restore the calculated price, select the default price above.',
        );
    });

    it('does not offer a remedy to a rep who has no price picker', () => {
        expect(editor({ overridden: true, discountPercent: 0, picker: false }).PriceSourceNote).toBe('Price overridden.');
    });

    it('mentions a discount once one is applied', () => {
        expect(editor({ overridden: false, discountPercent: 10, picker: true }).PriceSourceNote).toBe(
            'Calculated from the product\'s pricing, less the discount.',
        );
        expect(editor({ overridden: true, discountPercent: 10, picker: true }).PriceSourceNote).toBe(
            'Price overridden, less the discount. To restore the calculated price, select the default price above.',
        );
    });

    it('never names the app that prices the line', () => {
        for (const overridden of [true, false]) {
            for (const picker of [true, false]) {
                expect(editor({ overridden, discountPercent: 5, picker }).PriceSourceNote).not.toMatch(/Orders/);
            }
        }
    });
});
