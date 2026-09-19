import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MJSDealLinesPanel } from '../lib/form-panels/deal-form.panels';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * EDITING A LINE ON A CLOSED DEAL, FROM THE DEAL FORM (golive#206 item 1, the half sales#110 missed).
 *
 * sales#110 closed this on the deal WORKSPACE — a component no template has mounted since 9d6ef9e. The
 * deal form, which is what testers actually reach, still offered it: the lines grid renders outside the
 * panel's `@if (!IsLocked)` block (deliberately — a locked deal must still SHOW what was sold), so
 * hiding the Add button did not take the row double-click with it. All four fields were typeable on a
 * Won deal and the refusal arrived from the server veto after Save.
 *
 * Two layers are asserted here, because gating only the entry point is how this reopens: the panel
 * declines to open the editor, and the editor refuses on its own account whoever opened it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = (f: string) => readFileSync(join(HERE, '..', 'lib', 'form-panels', f), 'utf8');

/** The panel, with only what `EditLine` and `IsLocked` read. */
function panel(locked: boolean) {
    const p = Object.create(MJSDealLinesPanel.prototype) as MJSDealLinesPanel & {
        EditorOpen: boolean;
        EditingLineID: string | null;
    };
    Object.defineProperty(p, 'FormComponent', { value: { IsLocked: locked }, configurable: true });
    p.EditorOpen = false;
    p.EditingLineID = null;
    return p;
}

/** The editor, with only what `CanSave` and `BlockedReason` read. */
function editor(over: { locked: boolean; productID?: string | null; hasOrder?: boolean }) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    e.IsLocked = over.locked;
    Object.defineProperty(e, 'Working', {
        value: { ProductID: over.productID === undefined ? 'prod-1' : over.productID },
        configurable: true, writable: true,
    });
    Object.defineProperty(e, 'Deal', {
        value: { OrderID_Object: over.hasOrder === false ? null : {} },
        configurable: true, writable: true,
    });
    Object.defineProperty(e, 'DiscountRefusal', { value: null, configurable: true, writable: true });
    return e;
}

describe('the deal form declines to open the editor on a closed deal', () => {
    it('does not open on a locked deal', () => {
        const p = panel(true);
        p.EditLine({ row: { ID: 'line-1' } } as Parameters<MJSDealLinesPanel['EditLine']>[0]);
        expect(p.EditorOpen).toBe(false);
        expect(p.EditingLineID).toBeNull();
    });

    it('still opens on an open deal, which is the whole point of the control', () => {
        const p = panel(false);
        p.EditLine({ row: { ID: 'line-1' } } as Parameters<MJSDealLinesPanel['EditLine']>[0]);
        expect(p.EditorOpen).toBe(true);
        expect(p.EditingLineID).toBe('line-1');
    });

    /**
     * The grid must STAY rendered while locked — a closed deal still has to show what was sold. If it
     * were moved inside `@if (!IsLocked)` the defect would look fixed while the panel went blank.
     */
    it('keeps the grid outside the not-locked block', () => {
        const t = TEMPLATE('deal-form.panels.ts');
        const gate = t.indexOf('@if (!IsLocked) {');
        const grid = t.indexOf('<mj-explorer-entity-data-grid');
        const elseArm = t.indexOf('} @else {', gate);
        expect(gate).toBeGreaterThan(-1);
        expect(grid, 'the grid must come after the locked/unlocked arms, not inside them')
            .toBeGreaterThan(elseArm);
    });

    it('says why, where the Add button used to be', () => {
        expect(TEMPLATE('deal-form.panels.ts')).toContain('{{ LineEditBlockedReason }}');
    });
});

describe('the restricted editor refuses on its own account', () => {
    it('cannot be saved on a locked deal, even with everything else valid', () => {
        expect(editor({ locked: true }).CanSave).toBe(false);
    });

    it('can be saved on an open deal', () => {
        expect(editor({ locked: false }).CanSave).toBe(true);
    });

    /**
     * The lock outranks the other reasons. Telling a rep to choose a product on a closed deal invites
     * work the save would refuse anyway.
     */
    it('gives the lock as the reason, ahead of a missing product', () => {
        const e = editor({ locked: true, productID: null });
        expect(e.BlockedReason).toBe(
            'This deal is closed. Set the status back to Open before changing what was sold.',
        );
    });

    it('still gives the ordinary reasons on an open deal', () => {
        expect(editor({ locked: false, productID: null }).BlockedReason).toBe('Choose a product.');
        expect(editor({ locked: false, hasOrder: false }).BlockedReason)
            .toBe('Save the deal first — a product line needs its order.');
    });

    /**
     * RESOLVED BY THE COMPONENT, NOT PASSED IN. An `@Input` has to be remembered by every caller, and a
     * caller that did not is exactly the defect being closed here. Asserted on the source because the
     * point is the absence of an input, which no behavioural test can see.
     */
    it('resolves the lock itself rather than trusting a caller', () => {
        const src = TEMPLATE('deal-line-editor.component.ts');
        expect(src, 'must resolve from the shared rule').toContain('ResolveDealLockState');
        expect(src, 'IsLocked must not be an @Input').not.toMatch(/@Input\(\)\s*IsLocked/);
    });

    /** The persisted status, matching the server: a deal being closed right now still reads open. */
    it('reads the persisted status, not the in-memory one', () => {
        expect(TEMPLATE('deal-line-editor.component.ts')).toContain("GetFieldByName('DealStatusTypeID')?.OldValue");
    });

    it.each([
        ['the product select', '(ngModelChange)="OnProductChange($event)"'],
        // One-way plus a handler since quantity became a PRICED input: a change has to reach Orders.
        ['quantity', '(ngModelChange)="SetQuantity($event)"'],
        ['the discount percent', '(ngModelChange)="SetDiscountPercent($event)"'],
        ['the term start', '(ngModelChange)="SetTermStart($event)"'],
    ])('%s is disabled while locked', (_label, marker) => {
        const t = TEMPLATE('deal-line-editor.component.ts');
        const at = t.indexOf(marker);
        expect(at, 'the field must still be findable').toBeGreaterThan(-1);
        expect(t.indexOf(marker, at + 1), 'and be unambiguous').toBe(-1);
        const openTag = t.lastIndexOf('<', at);
        const tagEnd = t.indexOf('>', at);
        expect(t.slice(openTag, tagEnd)).toContain('[disabled]="IsLocked"');
    });
});
