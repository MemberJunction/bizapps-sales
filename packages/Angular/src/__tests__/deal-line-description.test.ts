import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * A DEAL LINE CAN SAY WHAT WAS SOLD IN ITS OWN WORDS.
 *
 * A generic product (a monthly services line, a staffing line) names nothing the customer would
 * recognise. The deal's lines are the order's lines, so the text typed here is the order line's
 * Description, which the invoice prints after the product name.
 */

type Line = { Description: string | null };

function editor(description: string | null, locked = false) {
    const line: Line = { Description: description };
    let writes = 0;
    const working = {
        get Description() {
            return line.Description;
        },
        set Description(next: string | null) {
            line.Description = next;
            writes += 1;
        },
    };
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    e.IsLocked = locked;
    Object.defineProperty(e, 'Working', { value: working, configurable: true });
    return { e, line, writes: () => writes };
}

describe('deal line description', () => {
    it('stores the trimmed text on the order line', () => {
        const { e, line } = editor(null);
        e.SetDescription('  Support, November 2026 ');
        expect(line.Description).toBe('Support, November 2026');
    });

    it('stores one line: a line break or a run of spaces becomes a single space', () => {
        const { e, line } = editor(null);
        e.SetDescription('Support,\n  November   2026');
        expect(line.Description).toBe('Support, November 2026');
    });

    it('stores a blank field as no description', () => {
        const { e, line } = editor('Support');
        e.SetDescription('   ');
        expect(line.Description).toBeNull();
    });

    it('does not write text the line already holds', () => {
        const { e, writes } = editor('Support');
        e.SetDescription('Support ');
        expect(writes()).toBe(0);
    });

    it('writes nothing on a locked deal', () => {
        const { e, line } = editor('Support', true);
        e.SetDescription('Changed');
        expect(line.Description).toBe('Support');
    });

    it('offers the field in the editor, capped at the column length, and shows it on the card', () => {
        const read = (name: string) => readFileSync(fileURLToPath(new URL(`../lib/form-panels/${name}`, import.meta.url)), 'utf8');
        const editorSource = read('deal-line-editor.component.ts');
        expect(editorSource).toContain('data-testid="line-description"');
        expect(editorSource).toContain('[attr.maxlength]="DescriptionMaxLength"');
        // 500 is the width of orders' OrderLine.Description column; the field is declared with that literal.
        expect(editorSource).toMatch(/public readonly DescriptionMaxLength = 500;/);
        const cards = read('deal-line-cards.component.ts');
        expect(cards).toContain("'Description',");
        expect(cards).toContain('data-testid="deal-line-description"');
    });
});
