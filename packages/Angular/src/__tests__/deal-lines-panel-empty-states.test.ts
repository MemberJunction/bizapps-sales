import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE "WHAT'S BEING SOLD" PANEL SHOWED A NEW DEAL NOTHING (bc-aidp-next-golive#216).
 *
 * The panel had two branches:
 *
 *     @if   (Record.IsSaved && Record.OrderID)  -> the lines grid
 *     @else if (Record.IsSaved)                 -> "Save the deal to add products."
 *
 * So a SAVED deal was told to save, and a brand-new one matched neither branch and rendered empty. A
 * tester filing #216 hit exactly that: *"It is empty, with no add button and no message"*, and could
 * not tell whether products were unavailable, broken, or somewhere else entirely.
 *
 * WHY THIS IS ASSERTED AGAINST THE TEMPLATE SOURCE. The branch is Angular control flow inside a
 * component template, decided at render time by two record fields. `deal-form-new-record.test.ts`
 * reads the source the same way for the hero's collapsed block, for the same reason: the alternative
 * is standing up TestBed and a rendering harness to prove which of three literals appears, which
 * tests Angular rather than the panel.
 *
 * The risk of reading source is asserting on prose that merely EXISTS somewhere in the file. These
 * checks are anchored on the branch conditions and their ORDER, so a message moved under the wrong
 * condition fails even though every string is still present.
 */

const PANEL = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
    'utf8',
);

/** The lines panel's template only, so a branch elsewhere in the file cannot satisfy these. */
function linesPanelTemplate(): string {
    const start = PANEL.indexOf(`SectionKey="lines"`);
    expect(start, 'the lines panel must still be findable').toBeGreaterThan(-1);
    const end = PANEL.indexOf('mjs-deal-empty { margin', start);
    expect(end, 'the panel template must still end where its styles begin').toBeGreaterThan(start);
    return PANEL.slice(start, end);
}

describe("the What's being sold panel always says something", () => {
    it('shows the grid only when there is a saved deal AND an order to hang lines on', () => {
        expect(linesPanelTemplate()).toContain('@if (Record.IsSaved && Record.OrderID) {');
    });

    it('tells an UNSAVED deal to save, which is the case the hint exists for', () => {
        const t = linesPanelTemplate();
        const branch = t.indexOf('@else if (!Record.IsSaved) {');
        expect(branch, 'the hint must be gated on NOT saved').toBeGreaterThan(-1);
        // and the instruction must sit inside that branch, not merely somewhere in the file
        const next = t.indexOf('@else', branch + 1);
        const body = t.slice(branch, next === -1 ? undefined : next);
        expect(body).toContain('Save the deal first');
    });

    it('does NOT tell a saved deal to save, which is what the defect did', () => {
        // The exact shape of the bug. If this ever passes again, #216 is back.
        expect(linesPanelTemplate()).not.toContain('@else if (Record.IsSaved) {');
    });

    it('has a third branch, so a saved deal with no order is not left blank either', () => {
        const t = linesPanelTemplate();
        const last = t.lastIndexOf('@else {');
        expect(last, 'a bare @else must close the chain').toBeGreaterThan(-1);
        expect(t.slice(last)).toContain('no order');
    });

    it('leaves no combination of the two fields without a message', () => {
        // saved+order -> grid, not-saved -> hint, saved+no-order -> the third branch. Three branches
        // cover all four combinations, because !IsSaved subsumes both order states.
        const t = linesPanelTemplate();
        const branches = [
            t.indexOf('@if (Record.IsSaved && Record.OrderID) {'),
            t.indexOf('@else if (!Record.IsSaved) {'),
            t.lastIndexOf('@else {'),
        ];
        expect(branches.every((i) => i > -1), 'all three branches present').toBe(true);
        expect(
            branches[0] < branches[1] && branches[1] < branches[2],
            'and in that order, because @else if is positional',
        ).toBe(true);
    });
});
