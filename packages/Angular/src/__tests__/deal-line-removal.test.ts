import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * TAKING A PRODUCT OFF A DEAL — the third of golive#206 item 1's three verbs, and the one that was
 * impossible rather than merely ungated.
 *
 * Orders did not drain `Lines.Removed` at all, so a removal was silently dropped and later refused
 * outright, costing the rep every other edit staged beside it. Sales carried a blanket refusal for
 * that. The orders fix landed (golive#187, `OrderEntityServer` now reads `Lines.Removed`), so removal
 * became possible — and nothing in sales offered it.
 *
 * THROUGH THE COLLECTION, NOT A DIRECT DELETE: `Lines.Remove()` then `order.Save()` is what orders
 * drains, renumbering survivors and recomputing the header. Deleting the OrderLine straight from a
 * grid skips all of that, which is why the grid's delete button stays off.
 */

function editor(opts: { lineID?: string | null; locked?: boolean; saveOk?: boolean; hasOrder?: boolean }) {
    const removed: unknown[] = [];
    const saves: number[] = [];
    const reloads: boolean[] = [];
    const emitted: string[] = [];
    const working = { ID: 'line-1', ProductID: 'prod-1' };

    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        Removed: unknown[]; Saves: number[]; Reloads: boolean[]; Emitted: string[];
    };
    e.IsLocked = opts.locked ?? false;
    e.Confirming = true;
    Object.defineProperty(e, 'LineID', { value: opts.lineID === undefined ? 'line-1' : opts.lineID, writable: true });
    Object.defineProperty(e, 'Working', { value: working, writable: true, configurable: true });
    Object.defineProperty(e, 'Deal', {
        value: opts.hasOrder === false ? {} : {
            OrderID_Object: {
                Lines: {
                    Remove: (l: unknown) => { removed.push(l); },
                    Load: async (force: boolean) => { reloads.push(force); },
                },
                Save: async () => { saves.push(1); return opts.saveOk !== false; },
                LatestResult: { Message: 'orders said no' },
            },
        },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    Object.defineProperty(e, 'Saved', { value: { emit: () => emitted.push('saved') }, writable: true });
    Object.defineProperty(e, 'Removed', { get: () => removed });
    Object.defineProperty(e, 'Saves', { get: () => saves });
    Object.defineProperty(e, 'Reloads', { get: () => reloads });
    Object.defineProperty(e, 'Emitted', { get: () => emitted });
    return e;
}

describe('removing a product from a deal', () => {
    it('is offered for a line that exists on an open deal', () => {
        expect(editor({}).CanRemove).toBe(true);
    });

    /** A line being composed has nothing to remove — Cancel already discards it. */
    it('is not offered while composing a new line', () => {
        expect(editor({ lineID: null }).CanRemove).toBe(false);
    });

    /** golive#206 item 1 names deleting alongside adding and editing. */
    it('is refused on a closed deal', () => {
        expect(editor({ locked: true }).CanRemove).toBe(false);
    });

    it('goes through the order collection and saves the order', async () => {
        const e = editor({});
        await e.Remove();
        expect(e.Removed, 'the line must be removed from the collection').toHaveLength(1);
        expect(e.Saves, 'and the ORDER saved, which is what drains it').toEqual([1]);
    });

    it('tells the panel, so the grid and the deal amount follow', async () => {
        const e = editor({});
        await e.Remove();
        expect(e.Emitted).toEqual(['saved']);
    });

    /**
     * A REFUSED SAVE MUST NOT LEAVE THE COLLECTION CLAIMING A REMOVAL THAT DID NOT HAPPEN, or the next
     * save retries it against a rep who has moved on.
     */
    it('puts the line back when the order refuses', async () => {
        const e = editor({ saveOk: false });
        await e.Remove();
        expect(e.Reloads, 'the collection is re-read from the database').toEqual([true]);
        expect(e.Emitted, 'and nothing is reported as removed').toEqual([]);
        expect(e.Error).toMatch(/orders said no|could not be removed/i);
    });

    it('does nothing on a locked deal even if called directly', async () => {
        const e = editor({ locked: true });
        await e.Remove();
        expect(e.Removed).toEqual([]);
        expect(e.Saves).toEqual([]);
    });

    it('clears the confirmation afterwards', async () => {
        const e = editor({});
        await e.Remove();
        expect(e.Confirming).toBe(false);
    });
});
