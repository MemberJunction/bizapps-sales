import '@angular/compiler';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Metadata } from '@memberjunction/core';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * THE ADD-PRODUCT DIALOG SHOWED NO PRICE.
 *
 * `UnitPrice` and `LineTotalNet` are resolved during the ORDER's save, so on a line being composed they
 * are null — while the caption underneath read "Priced by Orders", which a rep reasonably took to mean
 * the price should already be there. The values were not missing; they did not exist yet.
 *
 * Sales may not work them out: multiplying quantity by price here would be the second implementation of
 * pricing that CLAUDE.md's first rule exists to prevent. So it asks `Orders.PriceOrder`, which runs the
 * same `OrderPricingService` the real save runs and persists nothing.
 */

const COMPANY = 'cccccccc-0000-4000-8000-000000000001';
const PRODUCT = 'pppppppp-0000-4000-8000-000000000002';

type Routed = { key: string; input: { CompanyID: string; Lines: Array<Record<string, unknown>> } };

function editor(opts: {
    reply?: { Success: boolean; Output?: unknown; ErrorMessage?: string };
    companyID?: string | null;
    productID?: string | null;
    saved?: { UnitPrice: number | null; LineTotalNet: number | null };
}) {
    const routed: Routed[] = [];
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        refreshPrice(): Promise<void>;
        Routed: Routed[];
    };

    Object.defineProperty(e, 'Working', {
        value: {
            ProductID: opts.productID === undefined ? PRODUCT : opts.productID,
            Quantity: 3,
            DiscountPct: 0.1,
            ServicePeriodStart: null,
            ServicePeriodEnd: null,
            UnitPrice: opts.saved?.UnitPrice ?? null,
            LineTotalNet: opts.saved?.LineTotalNet ?? null,
        },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'Deal', {
        value: { CompanyID: opts.companyID === undefined ? COMPANY : opts.companyID },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    Object.defineProperty(e, 'Routed', { get: () => routed });

    Metadata.Provider = {
        RouteOperation: async (key: string, input: Routed['input']) => {
            routed.push({ key, input });
            if (!opts.reply) throw new Error('network');
            return opts.reply;
        },
    } as unknown as typeof Metadata.Provider;

    return e;
}

const ok = (UnitPrice: number, LineTotalNet: number) => ({
    Success: true,
    Output: { Success: true, Lines: [{ ProductID: PRODUCT, UnitPrice, LineTotalNet }] },
});

/**
 * `Metadata.Provider` is a SINGLETON, and `editor()` replaces it. Restoring it after each test keeps
 * that out of any file that shares a worker — this suite went red once on a test that never touches
 * pricing, then passed on the next two runs, which is what shared global state looks like before it
 * becomes a recurring mystery.
 */
const REAL_PROVIDER = Metadata.Provider;
beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { Metadata.Provider = REAL_PROVIDER; });

describe('what the line comes to', () => {
    it('asks Orders rather than working it out', async () => {
        const e = editor({ reply: ok(100, 270) });
        await e['refreshPrice']();
        expect(e.Routed.map((r) => r.key)).toEqual(['Orders.PriceOrder']);
    });

    it('sends the draft line — the one being composed, not a saved row', async () => {
        const e = editor({ reply: ok(100, 270) });
        await e['refreshPrice']();
        const line = e.Routed[0].input.Lines[0];
        expect(e.Routed[0].input.CompanyID).toBe(COMPANY);
        expect(line.ProductID).toBe(PRODUCT);
        expect(line.Quantity).toBe(3);
        expect(line.DiscountPct).toBe(0.1);
    });

    it('shows what Orders answered', async () => {
        const e = editor({ reply: ok(100, 270) });
        await e['refreshPrice']();
        expect(e.DisplayUnitPrice).toBe(100);
        expect(e.DisplayLineTotal).toBe(270);
    });

    /**
     * NOTHING IS WRITTEN TO THE LINE. These are display values; the order's own save resolves the real
     * ones. Writing them here would make this a second author of a priced figure, stale the moment the
     * rep changed anything.
     */
    it('writes nothing onto the line', async () => {
        const e = editor({ reply: ok(100, 270) });
        await e['refreshPrice']();
        expect(e.Working?.UnitPrice ?? null).toBeNull();
        expect(e.Working?.LineTotalNet ?? null).toBeNull();
    });

    /** An already-priced line still shows its stored figures when nothing has been re-asked. */
    it('falls back to the saved line until Orders answers', () => {
        const e = editor({ reply: ok(1, 1), saved: { UnitPrice: 50, LineTotalNet: 150 } });
        expect(e.DisplayUnitPrice).toBe(50);
        expect(e.DisplayLineTotal).toBe(150);
    });
});

describe('when Orders cannot answer', () => {
    /**
     * TWO LAYERS OF SUCCESS. The envelope says the operation RAN; `Output.Success` says pricing worked.
     * Checking only the outer one is a mistake this repo already made on the contracts seam, where it
     * reported a contract that was never written.
     */
    it('treats a ran-but-failed operation as no price, not as a price', async () => {
        /**
         * THE OUTPUT CARRIES A LINE, and that is the whole point of this case. Written first with
         * `Lines: []`, the assertion passed whether or not the inner `Success` was checked — the empty
         * array produced a null row on its own, so the test proved nothing and a mutation dropping the
         * check survived it. A refused pricing run that still returns a figure is the only shape that
         * tells the two apart.
         */
        const e = editor({
            reply: {
                Success: true,
                Output: { Success: false, Lines: [{ ProductID: PRODUCT, UnitPrice: 999, LineTotalNet: 999 }] },
            },
        });
        await e['refreshPrice']();
        expect(e.DisplayUnitPrice, 'a refused run must not be read as a price').toBeNull();
        expect(e.PricingNote).toMatch(/priced on save/i);
    });

    it('handles the operation not being reachable', async () => {
        const e = editor({ reply: { Success: false, ErrorMessage: 'nope' } });
        await e['refreshPrice']();
        expect(e.DisplayUnitPrice).toBeNull();
        expect(e.PricingNote).toMatch(/priced on save/i);
    });

    /** A pricing call that throws must never cost a rep the line they were recording. */
    it('survives a thrown call and clears the busy flag', async () => {
        const e = editor({});
        await expect(e['refreshPrice']()).resolves.toBeUndefined();
        expect(e.Pricing).toBe(false);
        expect(e.PricingNote).toMatch(/priced on save/i);
    });

    it('does not call out at all without a product or a company', async () => {
        for (const opts of [{ productID: null }, { companyID: null }]) {
            const e = editor({ reply: ok(1, 1), ...opts });
            await e['refreshPrice']();
            expect(e.Routed).toEqual([]);
        }
    });
});

describe('asking politely', () => {
    /**
     * A rep types: a quantity of 12 passes through 1 on its way there, and three round trips to price a
     * number nobody meant is three chances to show them a figure for it.
     */
    it('debounces rather than pricing every keystroke', async () => {
        vi.useFakeTimers();
        const e = editor({ reply: ok(100, 270) });
        e.SchedulePrice();
        e.SchedulePrice();
        e.SchedulePrice();
        expect(e.Routed, 'nothing before the pause').toEqual([]);
        await vi.advanceTimersByTimeAsync(400);
        expect(e.Routed.length, 'one call for a burst of edits').toBe(1);
        vi.useRealTimers();
    });
});

/**
 * A SAVED LINE MUST CHANGE THE DEAL, NOT JUST THE GRID.
 *
 * The dialog saves the ORDER. `Deal.Amount` is a cached copy of that order's `TotalGross` and is only
 * refreshed during a DEAL save, so adding a product left the deal reading no amount and no weighted
 * amount while its order carried a real total.
 */
describe('after a line is saved', () => {
    it('forces a deal save, because the deal itself is not dirty', async () => {
        const { MJSDealLinesPanel } = await import('../lib/form-panels/deal-form.panels');
        const saved: Array<{ IgnoreDirtyState?: boolean }> = [];
        const p = Object.create(MJSDealLinesPanel.prototype) as {
            OnLineSaved(): Promise<void>;
            EditorOpen: boolean;
            EditingLineID: string | null;
        };
        p.EditorOpen = true;
        p.EditingLineID = 'line-1';
        Object.defineProperty(p, 'Record', {
            value: { Save: async (o: { IgnoreDirtyState?: boolean }) => { saved.push(o); return true; } },
            configurable: true,
        });
        Object.defineProperty(p, 'linesGrid', { value: { Refresh: async () => {} }, configurable: true });

        await p.OnLineSaved();

        /**
         * THE FLAG IS THE WHOLE FIX. The line changed the ORDER, so the deal's own columns are clean and
         * `BaseEntity.Save()` skips the provider entirely when nothing is dirty — the earlier
         * `SaveRecord(false)` was a silent no-op that never reached the entity server, which is why
         * three rounds of fixing the amount guard changed nothing.
         */
        expect(saved, 'the deal must be saved exactly once').toHaveLength(1);
        expect(saved[0]?.IgnoreDirtyState, 'without this the save is dropped before it is sent').toBe(true);
        expect(p.EditorOpen, 'and the dialog closes').toBe(false);
    });
});
