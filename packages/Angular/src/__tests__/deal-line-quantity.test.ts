import '@angular/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import { Metadata } from '@memberjunction/core';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * A QUANTITY THE REP DID NOT ENTER IS NOT PRICED AND NOT SAVED.
 *
 * A cleared Quantity reached the line as 0, and the price request quietly sent 1 in its place, so the
 * dialog showed a one-unit price and kept Save enabled; orders then refused the line with a message
 * that did not fit the dialog. Orders stores `DECIMAL(18,4)` and forbids only zero, so a fraction is a
 * legal quantity and stays one here.
 */

const COMPANY = 'cccccccc-0000-4000-8000-000000000001';
const PRODUCT = 'pppppppp-0000-4000-8000-000000000002';

type Routed = { key: string; input: { Lines: Array<{ Quantity: number }> } };

function editor(quantity: number | null) {
    const routed: Routed[] = [];
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        refreshPrice(): Promise<void>;
        Routed: Routed[];
    };
    e.IsLocked = false;
    e.DiscountRefusal = null;
    e.DiscountReason = '';
    e.DiscountCategory = null;
    Object.defineProperty(e, 'Working', {
        value: {
            ProductID: PRODUCT,
            Quantity: quantity,
            DiscountPct: null,
            ServicePeriodStart: null,
            ServicePeriodEnd: null,
            // A saved line's figures, which must not stand in for a quantity nobody entered.
            UnitPrice: 100,
            LineTotalNet: 300,
            GetFieldByName: () => undefined,
        },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'Deal', {
        value: { CompanyID: COMPANY, OrderID_Object: {} },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'savedDiscountPct', { value: null, writable: true });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    Object.defineProperty(e, 'Routed', { get: () => routed });
    Metadata.Provider = {
        RouteOperation: async (key: string, input: Routed['input']) => {
            routed.push({ key, input });
            return {
                Success: true,
                Output: { Success: true, Lines: [{ ProductID: PRODUCT, UnitPrice: 100, LineTotalNet: 50 }] },
            };
        },
    } as unknown as typeof Metadata.Provider;
    return e;
}

const REAL_PROVIDER = Metadata.Provider;
afterEach(() => { Metadata.Provider = REAL_PROVIDER; });

describe('the line dialog refuses a quantity the rep did not enter', () => {
    /** A cleared field arrives through SetQuantity as Number(null), which is 0. */
    it.each([
        ['blank', null],
        ['zero', 0],
        ['negative', -2],
        ['not a number', Number.NaN],
    ])('blocks Save on a %s quantity and says why', (_label, quantity) => {
        const e = editor(quantity);
        expect(e.QuantityInvalid).toBe(true);
        expect(e.CanSave).toBe(false);
        expect(e.BlockedReason).toBe('Enter a quantity greater than 0.');
    });

    it.each([['blank', null], ['zero', 0], ['negative', -2]])(
        'does not ask orders to price a %s quantity, and shows no figures',
        async (_label, quantity) => {
            const e = editor(quantity);
            await e.refreshPrice();
            expect(e.Routed, 'no one-unit price in place of the missing quantity').toHaveLength(0);
            expect(e.DisplayUnitPrice).toBeNull();
            expect(e.DisplayLineTotal).toBeNull();
            expect(e.PricingNote).toBe('Enter a quantity greater than 0.');
        },
    );

    it.each([['whole', 3], ['fractional', 0.5]])('prices and saves a %s quantity as entered', async (_label, quantity) => {
        const e = editor(quantity);
        expect(e.QuantityInvalid).toBe(false);
        expect(e.CanSave).toBe(true);
        await e.refreshPrice();
        expect(e.Routed[0].input.Lines[0].Quantity).toBe(quantity);
        expect(e.DisplayLineTotal).toBe(50);
    });
});
