import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { Metadata } from '@memberjunction/core';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * CHOOSING AMONG ORDERS' OWN PRICES ON A DEAL LINE (golive#270).
 *
 * The deal line hosts orders' shared `mjo-line-price-picker`, so a rep with an override grant can put
 * the line on one of the product's named prices. What sales adds around it is small, and these pin it:
 * the picker never offers a typed amount (D-DL2), a picked price reaches `Orders.PriceOrder` pinned,
 * a pick without a reason cannot be saved, and each product in the list names its catalog price.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, '..', 'lib', 'form-panels', 'deal-line-editor.component.ts'), 'utf8');

const COMPANY = 'cccccccc-0000-4000-8000-000000000001';
const PRODUCT = 'pppppppp-0000-4000-8000-000000000002';
const NAMED_PRICE = 'nnnnnnnn-0000-4000-8000-000000000003';

type Routed = { key: string; input: { Lines: Array<Record<string, unknown>> } };

/** A line whose price fields answer `GetFieldByName` the way an OrderLine entity does. */
function line(over: { overridden?: boolean; reason?: string | null; unitPrice?: number | null } = {}) {
    const fields: Record<string, { Value: unknown; OldValue: unknown; Dirty: boolean }> = {
        PriceOverridden: { Value: over.overridden ?? false, OldValue: false, Dirty: !!over.overridden },
        PriceOverrideReason: { Value: over.reason ?? null, OldValue: null, Dirty: over.reason != null },
        UnitPrice: { Value: over.unitPrice ?? null, OldValue: null, Dirty: over.unitPrice != null },
        ProductPriceID: { Value: over.overridden ? NAMED_PRICE : null, OldValue: null, Dirty: !!over.overridden },
    };
    return {
        ProductID: PRODUCT,
        Quantity: 1,
        DiscountPct: null,
        ServicePeriodStart: null,
        ServicePeriodEnd: null,
        UnitPrice: over.unitPrice ?? null,
        LineTotalNet: null,
        IsSaved: false,
        GetFieldByName: (name: string) => fields[name],
    };
}

function editor(opts: { working?: ReturnType<typeof line>; locked?: boolean; overrideKind?: 'none' | 'list' | 'any' } = {}) {
    const routed: Routed[] = [];
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        refreshPrice(): Promise<void>;
        productPriceLabels: Map<string, string>;
    };
    e.IsLocked = opts.locked ?? false;
    e.OverrideKind = opts.overrideKind ?? 'list';
    e.EngineDefault = undefined;
    Object.defineProperty(e, 'Working', { value: opts.working ?? line(), writable: true, configurable: true });
    Object.defineProperty(e, 'Deal', {
        value: { CompanyID: COMPANY, OrderID_Object: {} },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'DiscountRefusal', { value: null, writable: true, configurable: true });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    Object.defineProperty(e, 'productPriceLabels', { value: new Map<string, string>(), configurable: true });

    Metadata.Provider = {
        RouteOperation: async (key: string, input: Routed['input']) => {
            routed.push({ key, input });
            return {
                Success: true,
                Output: {
                    Success: true,
                    Lines: [{
                        ProductID: PRODUCT, UnitPrice: 80, LineTotalNet: 80,
                        Default: { UnitPrice: 100, ProductPriceID: 'default-rule', PriceName: 'List' },
                    }],
                },
            };
        },
    } as unknown as typeof Metadata.Provider;

    return { e, routed };
}

const REAL_PROVIDER = Metadata.Provider;
afterEach(() => { Metadata.Provider = REAL_PROVIDER; });

describe('the price picker on a deal line', () => {
    it('never offers a typed amount (D-DL2)', () => {
        const tag = SOURCE.slice(SOURCE.indexOf('<mjo-line-price-picker'), SOURCE.indexOf('</mjo-line-price-picker>'));
        expect(tag).toContain('[AllowCustomAmount]="false"');
    });

    it('is offered on an open deal to a rep holding an override grant', () => {
        expect(editor({ overrideKind: 'list' }).e.ShowPricePicker).toBe(true);
        expect(editor({ overrideKind: 'any' }).e.ShowPricePicker).toBe(true);
    });

    it('is hidden without a grant, and on a closed deal', () => {
        expect(editor({ overrideKind: 'none' }).e.ShowPricePicker).toBe(false);
        expect(editor({ locked: true }).e.ShowPricePicker).toBe(false);
    });
});

describe('what the picker sends to Orders', () => {
    it('leaves the price for Orders to resolve while the line is on its default', async () => {
        const { e, routed } = editor();
        await e['refreshPrice']();
        expect(routed[0].input.Lines[0].UnitPrice).toBeNull();
    });

    it('pins a picked price, as the order save will', async () => {
        const { e, routed } = editor({ working: line({ overridden: true, reason: 'Band 2', unitPrice: 80 }) });
        await e['refreshPrice']();
        expect(routed[0].input.Lines[0].UnitPrice).toBe(80);
    });

    it("keeps Orders' default, so the picker's Default row can name it", async () => {
        const { e } = editor();
        await e['refreshPrice']();
        expect(e.EngineDefault).toEqual({ UnitPrice: 100, ProductPriceID: 'default-rule', PriceName: 'List' });
        expect(e.DefaultUnit).toBe(100);
    });
});

describe('a picked price needs a reason', () => {
    it('cannot be saved without one, and says so', () => {
        const { e } = editor({ working: line({ overridden: true, reason: null, unitPrice: 80 }) });
        expect(e.CanSave).toBe(false);
        expect(e.BlockedReason).toBe('Enter a reason for the price override.');
    });

    it('can be saved once it has one', () => {
        const { e } = editor({ working: line({ overridden: true, reason: 'Band 2', unitPrice: 80 }) });
        expect(e.CanSave).toBe(true);
    });

    it('locks the product while the price is off its default', () => {
        expect(editor({ working: line({ overridden: true, reason: 'Band 2', unitPrice: 80 }) }).e.ProductLockedByPrice).toBe(true);
        expect(editor().e.ProductLockedByPrice).toBe(false);
    });
});

describe('the product list names each price', () => {
    it('shows the catalog price beside the product, ahead of its company', () => {
        const { e } = editor();
        e.productPriceLabels.set(PRODUCT, 'From $100.00');
        expect(e.ProductOptionLabel({ ID: PRODUCT, Name: 'Implementation Fee', SKU: 'IMP-1', Company: 'Acme' } as never))
            .toBe('Implementation Fee (IMP-1) · From $100.00 — Acme');
    });

    it('reads as before when the catalog had no price for it', () => {
        const { e } = editor();
        expect(e.ProductOptionLabel({ ID: PRODUCT, Name: 'Implementation Fee', SKU: null, Company: 'Acme' } as never))
            .toBe('Implementation Fee — Acme');
    });
});
