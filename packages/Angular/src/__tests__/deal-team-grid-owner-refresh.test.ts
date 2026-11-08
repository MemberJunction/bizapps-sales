import '@angular/compiler';
import { describe, it, expect, afterEach } from 'vitest';
import { RunView } from '@memberjunction/core';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealTeamGridPanel } from '../lib/form-panels/deal-form.panels';

/**
 * THE PAGE MUST CATCH UP WHEN THE GRID MOVES THE OWNER (sales#147's review, point 1).
 *
 * Saving an Owner / AE row re-derives `Deal.OwnerEmployeeID` on the server. The open page knew
 * nothing about it, so the hero kept saying "No owner assigned." while the database disagreed.
 *
 * These pin the three guards, and the second is the one that matters most: `AfterDataLoad` fires on
 * every grid load, and a `Load()` that re-renders the panel can load the grid again. Reloading only
 * on a REAL difference is what makes that terminate instead of spinning.
 *
 * `RunView.prototype` is patched rather than the module mocked, which is how the server-side suites
 * already shadow a base-class method, and it keeps the panel's own wiring real.
 */

type Panel = { OnDataLoad(e: { totalRowCount: number }): void; refreshOwnerIfTheRosterMovedIt(): Promise<void> };

const original = RunView.prototype.RunView;
afterEach(() => { RunView.prototype.RunView = original; });

/** @param stored what the DATABASE says the owner is, which the panel goes and reads. */
function panel(opts: { shown: string | null; stored: string | null; dirty?: boolean; isSaved?: boolean }) {
    const loads: string[] = [];
    let reads = 0;

    RunView.prototype.RunView = (async () => {
        reads += 1;
        return { Success: true, Results: [{ OwnerEmployeeID: opts.stored }] };
    }) as unknown as typeof RunView.prototype.RunView;

    const record = {
        ID: 'deal-1',
        IsSaved: opts.isSaved ?? true,
        Dirty: opts.dirty ?? false,
        OwnerEmployeeID: opts.shown,
        Load: async (id: string) => { loads.push(id); return true; },
    } as unknown as DealEntity;

    const p = Object.create(MJSDealTeamGridPanel.prototype) as Panel;
    Object.defineProperty(p, 'Record', { get: () => record });
    Object.defineProperty(p, 'FormComponent', {
        value: { SetSectionRowCount: () => undefined },
        writable: true,
    });
    return { p, loads, reads: () => reads };
}

describe('the deal page after the Internal team grid changes the roster', () => {
    it('reloads the deal when the stored owner no longer matches the page', async () => {
        const { p, loads } = panel({ shown: null, stored: 'employee-2' });
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads, 'the page must catch up with the database').toEqual(['deal-1']);
    });

    it('does NOT reload when they already agree — which is what makes this terminate', async () => {
        // AfterDataLoad fires on every grid load, and a reload can load the grid again.
        const { p, loads } = panel({ shown: 'employee-2', stored: 'employee-2' });
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads, 'no difference, no reload, no loop').toEqual([]);
    });

    it('compares ids case-insensitively, as every other id comparison here does', async () => {
        const { p, loads } = panel({ shown: 'EMPLOYEE-2', stored: 'employee-2' });
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads, 'SQL Server returns uppercase GUIDs; the client makes lowercase ones').toEqual([]);
    });

    it('never reloads over a DIRTY record, however stale it is', async () => {
        const { p, loads, reads } = panel({ shown: null, stored: 'employee-2', dirty: true });
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads, 'Load() discards unsaved edits — the user keeps their typing').toEqual([]);
        expect(reads(), 'and it does not even read: the answer could not be acted on').toBe(0);
    });

    it('does nothing for a deal that has never been saved', async () => {
        const { p, loads, reads } = panel({ shown: null, stored: null, isSaved: false });
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads).toEqual([]);
        expect(reads()).toBe(0);
    });

    it('leaves the page alone when the read fails', async () => {
        const { p, loads } = panel({ shown: null, stored: 'employee-2' });
        RunView.prototype.RunView = (async () => ({ Success: false, ErrorMessage: 'nope' })) as never;
        await p.refreshOwnerIfTheRosterMovedIt();
        expect(loads, 'a failed read is not evidence the owner moved').toEqual([]);
    });
});
