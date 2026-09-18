import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * bc-aidp-next-golive#229 — the deal form's "What's being sold" panel opened the GENERIC Order Line
 * form, which renders Unit Price as a plain editable field. A rep could type any price, with no
 * discount recorded and no override reason, which `docs/DECISIONS.md` D-DL2 says must be impossible:
 * "S-US4 is explicit that no price field is enterable by the rep."
 *
 * ── WHY THIS SUITE READS SOURCE RATHER THAN RENDERING ───────────────────────────────────────────
 *
 * The defect is a TEMPLATE BINDING, and the two bindings that constitute the fix are exactly the kind
 * of thing that gets dropped by a later edit without any test noticing: rendering the panel proves the
 * component compiles, not that `ShowNewButton` is still false. The sibling suites in this directory
 * (`deal-locked-fields-readonly`, `deal-server-stamps-readonly`) read source for the same reason.
 *
 * THE QUESTION BEHIND EACH CHECK (CLAUDE.md rule 8): what would make this pass while a rep can still
 * type a price? Answering it is why BOTH bindings are pinned rather than one — either alone re-opens
 * the generic form — and why the editor is checked for the ABSENCE of a unit-price input as well as
 * the presence of a read-only display.
 */
const PANELS = readFileSync(
    join(__dirname, '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
    'utf8',
);
const EDITOR = readFileSync(
    join(__dirname, '..', 'lib', 'form-panels', 'deal-line-editor.component.ts'),
    'utf8',
);

/**
 * JUST THE RENDERED TEMPLATE.
 *
 * Scoped deliberately: the file's own header explains WHY it does not show "Reverses Order Line" or
 * bind `DiscountAmount`, so a whole-file scan reports the explanation as the offence. Caught by these
 * checks failing on their first run -- a check that reads more than it means is the same family of
 * error as one that reads less.
 */
function editorTemplate(): string {
    const at = EDITOR.indexOf('template: `');
    expect(at, 'the editor must have a template').toBeGreaterThan(-1);
    const end = EDITOR.indexOf('styles: [', at);
    expect(end, 'the template must be followed by styles').toBeGreaterThan(at);
    return EDITOR.slice(at, end);
}

/** The lines panel's block, so a binding elsewhere in this 2000-line file cannot satisfy these. */
function linesPanelBlock(): string {
    const at = PANELS.indexOf(`selector: 'mjs-deal-lines-panel'`);
    expect(at, 'the lines panel must still exist').toBeGreaterThan(-1);
    const end = PANELS.indexOf('export class MJSDealLinesPanel', at);
    expect(end, 'the lines panel class must follow its decorator').toBeGreaterThan(at);
    return PANELS.slice(at, end);
}

describe('the deal form never opens the generic Order Line form', () => {
    it('turns the grid New button off', () => {
        // Was `[ShowNewButton]="!IsLocked"` — on for every open deal, which is most of them.
        expect(linesPanelBlock()).toMatch(/\[ShowNewButton\]="false"/);
    });

    it('turns double-click navigation off', () => {
        // The other half. With this left on, a row double-click still routes to the generic form
        // even though New no longer does — the tester reached it both ways.
        expect(linesPanelBlock()).toMatch(/\[NavigateOnDoubleClick\]="false"/);
    });

    it('routes a row double-click into the restricted editor instead', () => {
        expect(linesPanelBlock()).toMatch(/\(AfterRowDoubleClick\)="EditLine\(\$event\)"/);
    });

    it('mounts the restricted editor, not a link to the entity form', () => {
        expect(linesPanelBlock()).toMatch(/<mjs-deal-line-editor/);
    });
});

describe('the restricted editor offers intent, never a price', () => {
    it('has no input bound to UnitPrice', () => {
        /**
         * THE CHECK THE WHOLE ISSUE COMES DOWN TO. Any binding that would let a rep type into the
         * price — `[(ngModel)]="Working.UnitPrice"`, or a one-way pair — fails here.
         */
        expect(EDITOR).not.toMatch(/ngModel\]?="[^"]*UnitPrice/);
        expect(EDITOR).not.toMatch(/ngModelChange\)="[^"]*UnitPrice/);
    });

    it('shows the unit price as a read-only display', () => {
        const readonly = EDITOR.slice(EDITOR.indexOf('mjs-le__readonly'));
        expect(readonly).toMatch(/Unit price/);
        expect(readonly).toMatch(/Money\(Working\.UnitPrice\)/);
    });

    it('has no input bound to LineTotalNet either — orders computes it', () => {
        expect(EDITOR).not.toMatch(/ngModel\]?="[^"]*LineTotalNet/);
    });

    it('offers a discount as a PERCENT and never as an amount (D-DL2)', () => {
        expect(editorTemplate()).toMatch(/Discount %/);
        // `OrderLine.DiscountAmount` reads 0 exactly when a percentage discount exists, so binding it
        // would show a rep "0" next to a real 10% discount.
        expect(editorTemplate()).not.toMatch(/DiscountAmount/);
    });

    it('offers exactly the four fields the deal workspace allowed', () => {
        for (const field of ['Product', 'Quantity', 'Discount %', 'Term start']) {
            expect(editorTemplate(), `the editor must offer ${field}`).toContain(field);
        }
    });

    it('shows none of the generic form\'s noise', () => {
        // Each of these was named in the tester's report as something the full form exposed.
        for (const noise of [
            'Reverses Order Line', 'Parent Order Line', 'Source Bundle Product', 'Journal Entry',
            'Price Overridden', 'Price Override Reason', 'Fulfillment Status', 'Renews Subscription',
        ]) {
            expect(editorTemplate(), `the editor must not surface ${noise}`).not.toContain(noise);
        }
    });

    it('never shows Order Header — it comes from the deal', () => {
        // Set from the deal's OrderID and never rendered, which is the tester's expectation 2.
        expect(EDITOR).toMatch(/OrderHeaderID = this\.OrderID/);
        expect(EDITOR).not.toMatch(/ngModel\]?="[^"]*OrderHeaderID/);
    });
});

describe('the editor reuses the shared rules rather than restating them', () => {
    it('takes the discount conversion, term-start and product rules from sales-entities', () => {
        /**
         * The rules are what the unmounted workspace enforced. Re-deriving any of them here would
         * recreate the very drift the issue is about — two surfaces disagreeing — so the import is
         * pinned, not just the behaviour.
         */
        for (const rule of [
            'DiscountPercentToFraction',
            'DiscountFractionToPercent',
            'ShouldOfferTermStart',
            'EffectiveTermStart',
        ]) {
            expect(EDITOR, `${rule} must come from the shared package`).toContain(rule);
        }
        expect(EDITOR).toMatch(/from '@mj-biz-apps\/sales-entities'/);
    });

    it('starts a new line at quantity 1, the smallest value orders permits', () => {
        // CK_OrderLine_Quantity forbids zero, so defaulting to 0 would offer the one illegal value.
        expect(EDITOR).toMatch(/line\.Quantity = 1/);
    });

    it('refuses to save without a product', () => {
        expect(EDITOR).toMatch(/get CanSave\(\)[\s\S]{0,200}Working\?\.ProductID/);
    });
});
