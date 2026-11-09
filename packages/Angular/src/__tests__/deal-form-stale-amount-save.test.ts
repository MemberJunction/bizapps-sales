import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SAVING A CLEAN DEAL WHOSE AMOUNT IS STALE STILL REACHES THE SERVER (#399).
 *
 * The header says "Save the deal to update it" when the cached amount no longer matches the order. If
 * the order changed somewhere else, the deal's own fields are unchanged, the record is clean, and
 * `BaseEntity.Save()` sends nothing. The form now forces that one save with `IgnoreDirtyState`, and
 * leaves every other save to the base path.
 */
const state = vi.hoisted(() => ({ stale: true, freshnessReads: 0 }));

vi.mock('@mj-biz-apps/sales-entities', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mj-biz-apps/sales-entities')>();
    return {
        ...actual,
        ResolveDealAmountFreshness: async () => {
            state.freshnessReads += 1;
            return state.stale ? { IsStale: true, Notice: 'stale' } : { IsStale: false, Notice: null };
        },
    };
});

const { DealFormComponentExtended } = await import('../lib/custom/deal-form.component');

type SaveOptions = { IgnoreDirtyState?: boolean } | undefined;

function form(opts: { dirty?: boolean; saved?: boolean; pending?: number } = {}) {
    const saves: SaveOptions[] = [];
    let baseSaves = 0;
    const instance = Object.create(DealFormComponentExtended.prototype) as {
        InternalSaveRecord(): Promise<boolean>;
    };
    Object.defineProperty(instance, 'record', {
        value: {
            Dirty: opts.dirty ?? false,
            IsSaved: opts.saved ?? true,
            Get: (name: string) => ({ AmountIsComputed: true, Amount: 100, OrderID: 'order-1' })[name],
            Save: async (o?: SaveOptions) => { saves.push(o); return true; },
        },
    });
    Object.defineProperty(instance, 'IsLocked', { value: false, writable: true });
    Object.defineProperty(instance, 'PendingRecords', { get: () => new Array(opts.pending ?? 0).fill({}) });
    // The base save, shadowed two links up so the test counts which path ran.
    const base = Object.getPrototypeOf(Object.getPrototypeOf(instance));
    Object.defineProperty(base, 'InternalSaveRecord', {
        value: async () => { baseSaves += 1; return true; },
        writable: true,
        configurable: true,
    });
    return { instance, saves, baseSaves: () => baseSaves };
}

beforeEach(() => {
    state.stale = true;
    state.freshnessReads = 0;
});

describe('saving a deal whose amount no longer matches its order', () => {
    it('forces the save of a clean deal past the dirty check', async () => {
        const f = form();
        expect(await f.instance.InternalSaveRecord()).toBe(true);
        expect(f.saves).toHaveLength(1);
        expect(f.saves[0]?.IgnoreDirtyState, 'without this the clean save never leaves the browser').toBe(true);
        expect(f.baseSaves()).toBe(0);
    });

    it('leaves a clean deal with a current amount to the ordinary save', async () => {
        state.stale = false;
        const f = form();
        await f.instance.InternalSaveRecord();
        expect(f.saves).toHaveLength(0);
        expect(f.baseSaves()).toBe(1);
    });

    it('does not ask about freshness when the deal is dirty: that save reaches the server anyway', async () => {
        const f = form({ dirty: true });
        await f.instance.InternalSaveRecord();
        expect(state.freshnessReads).toBe(0);
        expect(f.baseSaves()).toBe(1);
    });

    it('leaves a save with pending records to the base path, which saves them in one transaction', async () => {
        const f = form({ pending: 1 });
        await f.instance.InternalSaveRecord();
        expect(state.freshnessReads).toBe(0);
        expect(f.baseSaves()).toBe(1);
    });

    it('never forces the first save of a new deal', async () => {
        const f = form({ saved: false });
        await f.instance.InternalSaveRecord();
        expect(f.saves).toHaveLength(0);
        expect(f.baseSaves()).toBe(1);
    });
});
