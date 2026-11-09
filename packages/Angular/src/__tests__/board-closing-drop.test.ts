import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ClosingColumnUnder, ClosingRefusal } from '../lib/board/deal-board.component';

/**
 * A card let go over a closing column says why it did not move (#305).
 *
 * `CanDropInto` keeps the card out, so CDK reports the drop on the card's own column (or one it crossed)
 * with the pointer outside it. The board reads the column under the pointer to tell that apart from an
 * ordinary drop back where the card started.
 */

const BOARD = readFileSync(new URL('../lib/board/deal-board.component.html', import.meta.url), 'utf8');

/** A document whose `elementFromPoint` returns an element inside a column carrying `closing`, or nothing. */
function docWith(closing: string | null | undefined): Pick<Document, 'elementFromPoint'> {
    if (closing === undefined) {
        return { elementFromPoint: () => null };
    }
    const column = { getAttribute: (name: string) => (name === 'data-closing' ? closing : null) };
    const card = { closest: (sel: string) => (sel === '[data-closing]' && closing !== null ? column : null) };
    return { elementFromPoint: () => card as unknown as Element };
}

const outside = { isPointerOverContainer: false, dropPoint: { x: 900, y: 200 } };

describe('a drag released over a closing column', () => {
    it('names the closing column under the pointer', () => {
        expect(ClosingColumnUnder(outside, docWith('Signed'))).toBe('Signed');
    });

    it('is not a refusal when released over empty space', () => {
        expect(ClosingColumnUnder(outside, docWith(undefined))).toBeNull();
    });

    it('is not a refusal when released over an open column', () => {
        expect(ClosingColumnUnder(outside, docWith(null))).toBeNull();
    });

    it('is not a refusal when released inside the column that reported the drop', () => {
        // Even if a closing column were somehow under the pointer, a drop inside its own list is ordinary.
        const inside = { ...outside, isPointerOverContainer: true };
        expect(ClosingColumnUnder(inside, docWith('Signed'))).toBeNull();
    });

    it('points at the deal form, not the retired workspace', () => {
        const message = ClosingRefusal('Signed');
        expect(message).toContain('"Signed"');
        expect(message).toMatch(/deal form/);
        expect(message).not.toMatch(/workspace/i);
    });

    it('marks closing columns so the pointer check can find them', () => {
        expect(BOARD).toContain('[attr.data-closing]="column.IsClosing ? column.Label : null"');
    });
});
