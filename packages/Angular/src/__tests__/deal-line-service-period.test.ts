import '@angular/compiler';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OrdersEngine, type ServicePeriodSource } from '@mj-biz-apps/orders-entities';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * A deal line whose product earns over a window (`RequiresServicePeriod`) and that orders cannot date
 * from an event or a subscription term needs a service start and end, or orders' Confirm refuses the
 * order. The deal's line editor offered a term start only, so a rep had no way to set them.
 *
 * Reads source, like the sibling editor suites: the defect was a missing binding, and what would make
 * this pass while the rep still cannot set the dates is a field bound to the wrong column or gated on
 * a rule other than orders' own.
 */
const EDITOR = readFileSync(
    join(__dirname, '..', 'lib', 'form-panels', 'deal-line-editor.component.ts'),
    'utf8',
);

function editorTemplate(): string {
    const at = EDITOR.indexOf('template: `');
    const end = EDITOR.indexOf('styles: [', at);
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    return EDITOR.slice(at, end);
}

describe('the deal line editor asks for a service period orders cannot supply', () => {
    it('renders a start and an end input bound to both columns', () => {
        const t = editorTemplate();
        expect(t).toMatch(/@if \(ShowServicePeriod\)/);
        expect(t).toMatch(/data-testid="line-service-start"[^>]*\(ngModelChange\)="SetServicePeriod\('Start', \$event\)"/s);
        expect(t).toMatch(/data-testid="line-service-end"[^>]*\(ngModelChange\)="SetServicePeriod\('End', \$event\)"/s);
        expect(EDITOR).toMatch(/this\.Working\.ServicePeriodStart = date/);
        expect(EDITOR).toMatch(/this\.Working\.ServicePeriodEnd = date/);
    });

    it("decides with orders' ServicePeriodSource, offering it only for 'Line'", () => {
        expect(EDITOR).toMatch(/OrdersEngine\.Instance\.ServicePeriodSource\(productID\)/);
        expect(EDITOR).toMatch(/ServicePeriodSourceFor\(this\.Working\.ProductID\) === 'Line'/);
    });

    it('refuses to save a window that ends before it starts', () => {
        const canSave = EDITOR.slice(EDITOR.indexOf('public get CanSave()'), EDITOR.indexOf('public get NeedsDiscountReason'));
        expect(canSave).toMatch(/!this\.ServicePeriodBackwards/);
    });

    it('clears the window when the product changes to one that is dated elsewhere', () => {
        const change = EDITOR.slice(EDITOR.indexOf('public OnProductChange('), EDITOR.indexOf('public get ShowPricePicker'));
        const clearAt = change.indexOf('clearServicePeriodForProductChange(productID)');
        // Before ProductID moves, so the rule reads the product being left.
        expect(clearAt).toBeGreaterThan(-1);
        expect(clearAt).toBeLessThan(change.indexOf('this.Working.ProductID = productID'));
    });
});

/**
 * #374: a subscription line re-picked as a one-time or event product kept its term start. The old rule
 * cleared only when leaving a `Line`-source product, and a subscription reports `Subscription`, so an
 * event line reached confirm with a start and no end and orders skipped stamping the event's dates.
 * Driven through the real method with orders' answer stubbed per product.
 */
describe('changing the product clears dates the new product cannot use', () => {
    const SUBSCRIPTION = 'sub-product';
    const EVENT = 'event-product';
    const DATED = 'dated-product';
    const DATED_2 = 'dated-product-2';
    const UNLISTED = 'withdrawn-product';
    const SOURCES: Record<string, ServicePeriodSource> = {
        [SUBSCRIPTION]: 'Subscription', [EVENT]: 'Event', [DATED]: 'Line', [DATED_2]: 'Line',
    };

    afterEach(() => vi.restoreAllMocks());

    function change(from: string, to: string | null) {
        vi.spyOn(OrdersEngine.Instance, 'ServicePeriodSource').mockImplementation(
            (id: string) => SOURCES[id] ?? 'NotRequired',
        );
        const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
            clearServicePeriodForProductChange(next: string | null): void;
        };
        const working = {
            ProductID: from,
            ServicePeriodStart: new Date('2026-01-01T00:00:00Z') as Date | null,
            ServicePeriodEnd: new Date('2026-12-31T00:00:00Z') as Date | null,
        };
        Object.defineProperty(e, 'Working', { value: working, writable: true, configurable: true });
        e.Products = [
            { ID: SUBSCRIPTION, SubscriptionTypeID: 'type-1' },
            { ID: EVENT, SubscriptionTypeID: null },
            { ID: DATED, SubscriptionTypeID: null },
            { ID: DATED_2, SubscriptionTypeID: null },
        ] as unknown as MJSDealLineEditorComponent['Products'];
        e.clearServicePeriodForProductChange(to);
        return working;
    }

    it('clears both dates moving from a subscription to an event product', () => {
        const w = change(SUBSCRIPTION, EVENT);
        expect(w.ServicePeriodStart).toBeNull();
        expect(w.ServicePeriodEnd).toBeNull();
    });

    it('clears them moving from a subscription to a product the rep dates', () => {
        expect(change(SUBSCRIPTION, DATED).ServicePeriodStart).toBeNull();
    });

    it('keeps the term start moving between two subscription products', () => {
        expect(change(SUBSCRIPTION, SUBSCRIPTION).ServicePeriodStart).not.toBeNull();
    });

    it('keeps a window moving between two products the rep dates', () => {
        const w = change(DATED, DATED_2);
        expect(w.ServicePeriodStart).not.toBeNull();
        expect(w.ServicePeriodEnd).not.toBeNull();
    });

    it('still clears a window moving from a dated product to a subscription', () => {
        expect(change(DATED, SUBSCRIPTION).ServicePeriodStart).toBeNull();
    });

    it('leaves the dates alone for a product the catalogue does not list', () => {
        expect(change(SUBSCRIPTION, UNLISTED).ServicePeriodStart).not.toBeNull();
    });
});
