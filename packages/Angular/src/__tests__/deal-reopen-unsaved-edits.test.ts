import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * REOPENING MUST NOT EAT WHAT THE USER TYPED (the #73 review's non-blocking item).
 *
 * "Reopening from the Pipeline status control ends edit mode and reloads, so an unsaved edit to a
 * still-editable field like Description is silently dropped."
 *
 * A locked deal is not a read-only deal. `DealFieldsEditableWhileLocked` keeps six fields open, seven
 * on a lost one, and the panels render them — so a rep can legitimately be mid-sentence in Description
 * when they decide to reopen. `RefreshRecord()` re-reads the row over the top of that, which is not a
 * refusal the user can see and answer; it is the work disappearing.
 *
 * ── WHY SAVING FIRST IS THE FIX, AND NOT FORBIDDEN AS THE CODE USED TO CLAIM ────────────────────
 *
 * The old comment said a reopen "must not save first: the close lock would refuse the save and turn a
 * legal reopen into a refusal". The lock is narrower than that. `DealEntityServer.checkCloseLock`
 * refuses on `f.Dirty && !editable.has(f.Name)` — a DIRTY FROZEN field — so a save carrying only the
 * carve-out fields passes it, and the carve-out fields are the only ones these panels let anyone type
 * into. When something frozen IS dirty the save is refused, and the right answer is then to abandon
 * the reopen rather than run it over the top: the deal is left as it was and the typing is still on
 * screen to fix.
 *
 * ── WHAT THESE CHECKS ARE REALLY FOR: THE ORDER ─────────────────────────────────────────────────
 *
 * Asserting merely that a save happened would stay green if someone moved it AFTER the operation —
 * and that is the worse bug, not a tidier version of the same one. Once `Sales.ReopenDeal` commits,
 * this record still holds the CLOSED status in both `Value` and `OldValue`, because the operation
 * moved the row and not the copy in the browser. Saving then writes that closing status back over the
 * reopened row.
 *
 * NOTHING ON THE SERVER WOULD STOP IT. The two halves being equal means the field is CLEAN, so
 * `planStatusTransition` returns null on `!field?.Dirty` and the golive#205 trigger never sees it; the
 * update writes the column regardless, because MJ sends every `AllowUpdateAPI` field and does not
 * filter on dirty. A silently re-closed deal with `ClosedAt` still cleared, and no refusal to read.
 * That is why these checks are about ORDER and not about whether a save occurred.
 *
 * So every check below records a CALL SEQUENCE and asserts about positions in it. `calls` is the
 * whole point of the fixture.
 */

const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
];

const REOPEN_OP = 'RouteOperation:Sales.ReopenDeal';

/**
 * The host form, reduced to the three calls that decide whether an edit survives.
 *
 * `SaveRecord` reports what it was passed, because `true` is the half that ends edit mode — without
 * it `canRefreshRecord()` stays false and the reload silently does nothing, which is the defect the
 * Pipeline panel's reopen was carrying before this one.
 */
function formStub(calls: string[], saveSucceeds = true) {
    return {
        EditMode: true,
        SaveRecord: async (stopEditModeAfterSave: boolean): Promise<boolean> => {
            calls.push(`SaveRecord(${stopEditModeAfterSave})`);
            return saveSucceeds;
        },
        EndEditMode: (): void => {
            calls.push('EndEditMode');
        },
        RefreshRecord: async (): Promise<boolean> => {
            calls.push('RefreshRecord');
            return true;
        },
    };
}

/** A reopen that succeeds, recording that it was reached at all. */
function providerStub(calls: string[], operationSucceeds = true) {
    return {
        RouteOperation: async (operationKey: string) => {
            calls.push(`RouteOperation:${operationKey}`);
            return { Success: true, Output: { Success: operationSucceeds, Issues: [] } };
        },
    } as unknown as IMetadataProvider;
}

/**
 * `before` happened, `after` happened, and they happened in that order.
 *
 * NOT a bare `indexOf(a) < indexOf(b)`, which is the vacuous shape this repo keeps finding: a call
 * that never happened indexes to -1, and -1 is less than everything, so the assertion passes LOUDEST
 * exactly when the step it guards has been deleted. Both positions are proved present first.
 */
function expectOrder(calls: readonly string[], before: string, after: string): void {
    expect(calls, `${before} must have happened`).toContain(before);
    expect(calls, `${after} must have happened`).toContain(after);
    expect(calls.indexOf(before), `${before} must come before ${after} — got ${JSON.stringify(calls)}`)
        .toBeLessThan(calls.indexOf(after));
}

/**
 * A closed deal, dirty or not.
 *
 * `Dirty` is the real question the fix asks — `BaseEntity.Dirty` covers fields, companions and the
 * IsA parent, so it is exactly "is there anything a reload would destroy". The stub carries it as a
 * plain value because nothing here needs to model HOW it became true.
 */
function recordStub(over: Record<string, unknown> = {}): DealEntity {
    return {
        ID: 'deal-1',
        IsSaved: true,
        DealStatusTypeID: 'won-1',
        Dirty: false,
        ...over,
    } as unknown as DealEntity;
}

/**
 * A Pipeline panel on a closed deal, with the reopen already picked THROUGH THE REAL ENTRY POINT.
 *
 * `SetStatus` rather than assigning `PendingReopenStatusID`, so the checks below go through the door
 * a user goes through. Poking the field directly would keep passing if `SetStatus` stopped routing a
 * pick on a closed deal into the reopen at all.
 */
function pipelinePanel(calls: string[], over: Record<string, unknown> = {}, saveSucceeds = true) {
    const panel = new MJSDealPipelinePanel();
    panel.Record = recordStub(over);
    panel.FormComponent = formStub(calls, saveSucceeds) as unknown as MJSDealPipelinePanel['FormComponent'];
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    panel.SetStatus('open-1');
    expect(panel.PendingReopenStatusID, 'the pick must have been held as a reopen').toBe('open-1');
    return panel;
}

function closePanel(calls: string[], over: Record<string, unknown> = {}, saveSucceeds = true) {
    const panel = new MJSDealClosePanel();
    panel.Record = recordStub(over);
    panel.FormComponent = formStub(calls, saveSucceeds) as unknown as MJSDealClosePanel['FormComponent'];
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    panel.OpenReopenPanel();
    return panel;
}

let savedProvider: IMetadataProvider;

beforeEach(() => {
    savedProvider = Metadata.Provider;
});

afterEach(() => {
    // The provider is a global. Leaving a stub behind would make an unrelated suite's first database
    // read return this fixture's reopen, which is the kind of failure that gets blamed on the wrong file.
    Metadata.Provider = savedProvider;
});

describe('reopening from the Pipeline status control keeps unsaved edits', () => {
    it('saves them, and saves them BEFORE the reopen runs', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: true });

        await panel.ConfirmReopen();

        // The edit reached the database at all, and did so while the deal was still closed.
        // Afterwards the record still holds the CLOSED status in Value AND OldValue, so a save there
        // writes it back over the reopened row.
        expectOrder(calls, 'SaveRecord(true)', REOPEN_OP);
    });

    it('passes `true`, which is what ends edit mode and lets the reload happen', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: true });

        await panel.ConfirmReopen();

        // `canRefreshRecord()` is `record && IsSaved && !EditMode`. A save that left edit mode on would
        // reload nothing and report no failure — the stale screen this panel already fixed once.
        expect(calls).toContain('SaveRecord(true)');
        expect(calls).not.toContain('SaveRecord(false)');
        expectOrder(calls, REOPEN_OP, 'RefreshRecord');
    });

    it('does not write to a locked deal that has nothing to save', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: false });

        await panel.ConfirmReopen();

        // The reopen control renders only inside `@if (EditMode)`, so a condition of
        // `EditMode || Dirty` would save on EVERY reopen — a write to a locked row for no reason.
        expect(calls.some((c) => c.startsWith('SaveRecord'))).toBe(false);
        // ...but edit mode still has to end, or the reload below it does nothing.
        expect(calls).toContain('EndEditMode');
        expect(calls).toContain('RefreshRecord');
    });

    it('abandons the reopen when the save is refused, rather than discarding the edit', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: true }, false);

        await panel.ConfirmReopen();

        // A dirty FROZEN field is the case the lock really does refuse. Reopening anyway would mean
        // the reload discards the typing after all — the original defect, one branch further in.
        expect(calls).not.toContain(REOPEN_OP);
        expect(calls).not.toContain('RefreshRecord');
        expect(panel.ActionFailed).toBe(true);
        expect(panel.ActionMessage).toMatch(/not reopened/i);
    });

    it('leaves the pick standing after a refused save, so the user can retry', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: true }, false);

        await panel.ConfirmReopen();

        // Clearing it would drop the user back to a closed deal with no pending reopen and an error
        // about a save, which reads as the reopen having been the thing that failed.
        expect(panel.PendingReopenStatusID).toBe('open-1');
        expect(panel.Busy, 'the finally must still have run').toBe(false);
    });

    it('does not save when the reopen was never confirmable', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = pipelinePanel(calls, { Dirty: true });
        panel.CancelReopen();

        await panel.ConfirmReopen();

        // The guard is the first line of the method and must stay ahead of the save. A save here would
        // be a write nobody asked for, on a deal the user had just cancelled out of reopening.
        expect(calls).toEqual([]);
    });
});

describe('reopening from the Close panel behaves the same way', () => {
    /**
     * The same fix, because the same wrong premise was written down in both places — this panel's
     * comment said "no save-first step ... the close lock would refuse the save anyway".
     *
     * Its symptom differed. This button is NOT inside `@if (EditMode)`, so in edit mode it reopened
     * the deal and then reloaded NOTHING — `canRefreshRecord()` is false while edit mode is on, and it
     * returns false rather than throwing — leaving a reopened deal still drawn as closed and locked.
     */
    it('saves before the reopen, then reloads', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = closePanel(calls, { Dirty: true });

        await panel.ConfirmReopen();

        expectOrder(calls, 'SaveRecord(true)', REOPEN_OP);
        expectOrder(calls, REOPEN_OP, 'RefreshRecord');
    });

    it('ends edit mode even with nothing to save, so the reload is not a no-op', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = closePanel(calls, { Dirty: false });

        await panel.ConfirmReopen();

        expect(calls.some((c) => c.startsWith('SaveRecord'))).toBe(false);
        expectOrder(calls, 'EndEditMode', 'RefreshRecord');
    });

    it('abandons the reopen when the save is refused', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const panel = closePanel(calls, { Dirty: true }, false);

        await panel.ConfirmReopen();

        expect(calls).not.toContain(REOPEN_OP);
        expect(panel.MessageIsError).toBe(true);
        expect(panel.Message).toMatch(/not reopened/i);
        expect(panel.Closing, 'the finally must still have run').toBe(false);
    });
});
