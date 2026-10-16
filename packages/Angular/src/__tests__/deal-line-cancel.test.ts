import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * CANCEL LEAVES THE ORDER AS IT WAS.
 *
 * The dialog edits the live line in the order's collection, not a copy, and MJ rolls a dirty embedded
 * line up into the deal's `Dirty`. Cancel used to withdraw only a NEW line, so an edited existing line
 * stayed changed in memory and the deal's next save wrote it to the order.
 */

interface FakeLine {
    ID: string;
    Quantity: number;
    readonly Dirty: boolean;
    Revert(): boolean;
}

/** A line with one saved field, enough to tell a reverted line from an edited one. */
function line(savedQuantity: number): FakeLine & { Reverts: number } {
    let reverts = 0;
    const l = {
        ID: 'line-1',
        Quantity: savedQuantity,
        get Dirty() { return l.Quantity !== savedQuantity; },
        Revert() { reverts++; l.Quantity = savedQuantity; return true; },
        get Reverts() { return reverts; },
    };
    return l;
}

function editor(opts: { working: FakeLine; isNew?: boolean; orderSaveOk?: boolean }) {
    const removed: unknown[] = [];
    const emitted: string[] = [];
    const working = opts.working;
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        Removed: unknown[]; Emitted: string[];
    };
    e.IsLocked = false;
    e.DiscountCategory = null;
    e.DiscountReason = '';
    e.DiscountRefusal = null;
    e.Notice = null;
    Object.defineProperty(e, 'IsNewLine', { value: opts.isNew ?? false, writable: true });
    Object.defineProperty(e, 'LineID', { value: opts.isNew ? null : 'line-1', writable: true });
    Object.defineProperty(e, 'Working', { value: working, writable: true, configurable: true });
    Object.defineProperty(e, 'Deal', {
        value: {
            get Dirty() { return working.Dirty; },
            OrderID_Object: {
                Lines: { Remove: (l: unknown) => { removed.push(l); } },
                Save: async () => opts.orderSaveOk !== false,
                LatestResult: { Message: 'orders said no' },
            },
        },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    Object.defineProperty(e, 'Saved', { value: { emit: () => emitted.push('saved') }, writable: true });
    Object.defineProperty(e, 'Closed', { value: { emit: () => emitted.push('closed') }, writable: true });
    Object.defineProperty(e, 'Removed', { get: () => removed });
    Object.defineProperty(e, 'Emitted', { get: () => emitted });
    return e;
}

describe('cancelling the line dialog', () => {
    it('reverts an edited existing line, so the deal is not left dirty', () => {
        const working = line(3);
        const e = editor({ working });
        working.Quantity = 7;
        expect(e.Deal?.Dirty, 'the edit dirties the deal through its embedded line').toBe(true);

        e.Cancel();

        expect(working.Reverts).toBe(1);
        expect(working.Quantity).toBe(3);
        expect(working.Dirty).toBe(false);
        expect(e.Deal?.Dirty).toBe(false);
        expect(e.Emitted).toEqual(['closed']);
    });

    it('reverts after a refused order save too', async () => {
        const working = line(3);
        const e = editor({ working, orderSaveOk: false });
        working.Quantity = 7;
        Object.defineProperty(e, 'CanSave', { get: () => true });

        await e.Save();
        expect(e.Error).toBe('orders said no');
        e.Cancel();

        expect(working.Quantity).toBe(3);
        expect(e.Deal?.Dirty).toBe(false);
    });

    it('still withdraws a new line from the collection instead of reverting it', () => {
        const working = line(1);
        const e = editor({ working, isNew: true });

        e.Cancel();

        expect(e.Removed).toEqual([working]);
        expect(working.Reverts).toBe(0);
        expect(e.Emitted).toEqual(['closed']);
    });

    it('clears the discount reason typed for the cancelled edit', () => {
        const e = editor({ working: line(1) });
        e.DiscountCategory = 'Competitive' as typeof e.DiscountCategory;
        e.DiscountReason = 'matched a quote';
        e.DiscountRefusal = 'too many decimals';

        e.Cancel();

        expect(e.DiscountCategory).toBeNull();
        expect(e.DiscountReason).toBe('');
        expect(e.DiscountRefusal).toBeNull();
    });
});
