import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
        const clearAt = change.indexOf('clearServicePeriodLeavingLineSource(productID)');
        // Before ProductID moves, so the rule reads the product being left.
        expect(clearAt).toBeGreaterThan(-1);
        expect(clearAt).toBeLessThan(change.indexOf('this.Working.ProductID = productID'));
    });
});
