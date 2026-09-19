import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DealWorkspaceComponent } from '../lib/workspace/deal-workspace.component';

/**
 * EDITING A LINE ON A CLOSED DEAL, FROM THE WORKSPACE (golive#206 item 1, the half sales#84 missed).
 *
 * #84 stopped this pane OFFERING Add on a closed deal. Its review then pointed out that the same pane
 * still let a rep edit product, quantity, discount and term start on one — and item 1 covers edits:
 * *"Adding, EDITING or deleting a line on a locked deal should be refused at the server, whichever
 * screen or API path it comes from."*
 *
 * Built with `Object.create` rather than TestBed, the way `workspace-add-line-locked` is: this is one
 * getter over one field, and standing up the component's providers would test the harness.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, '..', 'lib', 'workspace', 'deal-workspace.component.html'), 'utf8');

function workspace(opts: { saved: boolean; locked: boolean }) {
    const c = Object.create(DealWorkspaceComponent.prototype) as {
        CanEditLines: boolean;
        LineEditBlockedReason: string | null;
        OpenLineDetail(line: { ID: string; IsSaved: boolean }): Promise<void>;
    };
    Object.defineProperty(c, 'Deal', { value: { IsSaved: opts.saved }, writable: true });
    Object.defineProperty(c, 'Lock', {
        value: { IsLocked: opts.locked, StatusName: opts.locked ? 'Won' : null, IsLost: false, Notice: null },
        writable: true,
    });
    return c;
}

describe('the workspace line fields on a closed deal', () => {
    it('cannot be edited', () => {
        expect(workspace({ saved: true, locked: true }).CanEditLines).toBe(false);
    });

    it('says why, in the words the rest of the lock copy uses', () => {
        expect(workspace({ saved: true, locked: true }).LineEditBlockedReason).toBe(
            'This deal is closed. Set the status back to Open before changing what was sold.',
        );
    });

    it('stays editable on an open deal', () => {
        // The control. Without it the gate could be "always refuse" and every assertion above passes.
        const open = workspace({ saved: true, locked: false });
        expect(open.CanEditLines).toBe(true);
        expect(open.LineEditBlockedReason).toBeNull();
    });

    it('is NOT gated on IsSaved, unlike adding a line', () => {
        // Deliberately different from `CanAddLine`, which needs a saved deal because the order is
        // minted on first save. An UNSAVED deal is exactly where a rep composes lines, and nothing is
        // frozen until a status locks it — so gating this on IsSaved would break normal composition.
        const fresh = workspace({ saved: false, locked: false });
        expect(fresh.CanEditLines).toBe(true);
        expect(fresh.LineEditBlockedReason).toBeNull();
    });
});

describe('the getters actually reach the fields', () => {
    /**
     * THE POINT OF THIS BLOCK. Unlike #84 — where the button already bound `[disabled]` and only the
     * getter had to change — these bindings are NEW. A correct getter that nothing consumes is the
     * defect this repo keeps finding: it passes every test above while a rep edits a frozen line.
     */
    // The whole template, deliberately: each marker below is unique in it, and slicing from the first
    // one leaves that element with no opening tag to search back to.
    const lines = TEMPLATE;

    it.each([
        ['the product select', 'dw-cell-product'],
        ['quantity', '[(ngModel)]="line.Quantity"'],
        ['the discount percent', '(ngModelChange)="SetDiscountPercent(line, $event)"'],
        ['the term start', '(ngModelChange)="SetTermStart(line, $event)"'],
        // The RESET beside the term start, not the input. Disabling the input alone left the button
        // that clears the same two fields live — and `ResetTermStart` nulls ServicePeriodStart AND
        // ServicePeriodEnd, so the one control this block missed was the one that wrote most.
        ['the term-start reset', '(click)="ResetTermStart(line, termStartInput)"'],
    ])('%s is disabled when the lines cannot be edited', (_label, marker) => {
        const at = lines.indexOf(marker);
        expect(at, 'the field must still be findable').toBeGreaterThan(-1);
        expect(lines.indexOf(marker, at + 1), 'and be unambiguous').toBe(-1);
        // the binding sits within the same element as the marker: look to the end of that tag
        const tagEnd = lines.indexOf('>', at);
        const openTag = lines.lastIndexOf('<', at);
        expect(lines.slice(openTag, tagEnd)).toContain('[disabled]="!CanEditLines"');
    });

    it('offers the reason on hover wherever it does not displace something more useful', () => {
        // Quantity, discount and term start carry it outright. The product select keeps ProductLabel
        // when editable — the product name is what a rep wants there — and falls back to the refusal
        // only while locked, so nothing is lost in either state.
        expect(lines).toContain('[title]="LineEditBlockedReason || ProductLabel(line)"');
        // The reset button keeps its own hint while editable, for the same reason the product select
        // keeps the product name: "Reset to the order date" is what a rep needs there when it works.
        expect(lines).toContain(`[title]="LineEditBlockedReason || 'Reset to the order date'"`);
        expect((lines.match(/\[title\]="LineEditBlockedReason"/g) ?? []).length).toBe(3);
    });
});

/**
 * THE SLIDE-IN IS THE OTHER WAY INTO THE SAME FIELDS, and it was opened in edit mode unconditionally.
 *
 * Asserted on BEHAVIOUR rather than on the source text, because the defect here is not a missing binding
 * — it is a value handed to a service. A version that read `CanEditLines` and passed `true` anyway would
 * survive any grep of this file.
 */
describe('the full line detail', () => {
    function openDetail(locked: boolean) {
        const opened: Array<{ EditMode: boolean }> = [];
        const c = workspace({ saved: true, locked });
        Object.defineProperty(c, 'forms', {
            value: {
                Open: (o: { EditMode: boolean }) => {
                    opened.push(o);
                    return { AfterSaved: async () => null };   // cancelled: stops before the reload
                },
            },
        });
        return { c, opened };
    }

    it('opens read-only on a closed deal', async () => {
        const { c, opened } = openDetail(true);
        await c.OpenLineDetail({ ID: 'line-1', IsSaved: true });
        expect(opened, 'the button must still open — a closed deal is what people inspect').toHaveLength(1);
        expect(opened[0].EditMode).toBe(false);
    });

    it('opens editable on an open deal', async () => {
        const { c, opened } = openDetail(false);
        await c.OpenLineDetail({ ID: 'line-1', IsSaved: true });
        expect(opened).toHaveLength(1);
        expect(opened[0].EditMode).toBe(true);
    });
});

describe('one condition, one message', () => {
    it('shares its opening sentence with the rest of the close-lock copy', () => {
        // golive#207 row 17's voice, used verbatim by the deal form's field refusal and by this pane's
        // Add hint. A rep meets one sentence across every surface that refuses on the same lock.
        const opening = 'This deal is closed. Set the status back to Open before ';
        expect(workspace({ saved: true, locked: true }).LineEditBlockedReason).toContain(opening);

        const component = readFileSync(join(HERE, '..', 'lib', 'workspace', 'deal-workspace.component.ts'), 'utf8');
        expect(component).toContain(opening + 'adding a product.');
        expect(component).toContain(opening + 'changing what was sold.');
    });
});
