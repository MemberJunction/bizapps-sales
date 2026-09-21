import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import { DealWorkspaceComponent } from '../lib/workspace/deal-workspace.component';

/**
 * REOPENING FROM THE WORKSPACE MUST NOT EAT WHAT THE USER TYPED (bc-aidp-next-golive#224).
 *
 * sales#78 fixed this on the deal FORM, on both its reopen paths, and left the workspace — which had
 * the same shape and one extra turn of the knife. `ReopenDeal()` went straight to
 * `RouteOperation('Sales.ReopenDeal')` and then `ReloadActiveDeal()`, which replaces the `DealEntity`
 * wholesale. A locked deal is not a read-only deal: `DealFieldsEditableWhileLocked` keeps six fields
 * open, seven on a lost one, and this component renders them with `[disabled]="!IsFieldEditable(...)"`
 * — so a rep can legitimately be mid-sentence in Description when they hit Reopen in the lock banner
 * directly above it.
 *
 * WORSE THAN THE FORM'S VERSION WAS. There, the edit was lost but the record stayed dirty.
 * `ReloadActiveDeal()` also calls `store.MarkClean(tabId)`, so the tab-strip marker was cleared too
 * and nothing on screen suggested anything had been pending.
 *
 * ── WHAT THESE CHECKS ARE REALLY FOR: THE ORDER ─────────────────────────────────────────────────
 *
 * Asserting merely that a save happened would stay green if someone moved it AFTER the operation, and
 * that is the worse bug rather than a tidier version of the same one. Once `Sales.ReopenDeal` commits
 * it has moved the ROW, not this copy in the browser, which still holds the CLOSED status in both
 * `Value` and `OldValue`. A save at that point writes the closing status straight back over the
 * reopened row, and nothing would refuse it — the two halves being equal means the field reads CLEAN,
 * so golive#205's status trigger never sees it while MJ sends the column anyway.
 *
 * So every check records a CALL SEQUENCE and asserts about positions in it. `calls` is the fixture.
 *
 * ── WHY `Object.create` AND NOT TestBed ─────────────────────────────────────────────────────────
 *
 * The same reason `workspace-line-edit-locked` gives: this is one method over a handful of
 * collaborators, and standing up the component's real providers would test the harness. The stub
 * below is deliberately the complete set of things `ReopenDeal()` touches, so a new collaborator
 * appearing in that method makes these fail loudly rather than silently skipping a branch.
 */

const REOPEN_OP = 'RouteOperation:Sales.ReopenDeal';
const TAB = 'tab-1';

/**
 * `before` happened, `after` happened, and they happened in that order.
 *
 * NOT a bare `indexOf(a) < indexOf(b)`: a call that never happened indexes to -1, and -1 is less than
 * everything, so that shape passes LOUDEST exactly when the step it guards has been deleted. Both
 * positions are proved present first. Borrowed verbatim from `deal-reopen-unsaved-edits`, which is
 * the form-side sibling of this file.
 */
function expectOrder(calls: readonly string[], before: string, after: string): void {
    expect(calls, `${before} must have happened`).toContain(before);
    expect(calls, `${after} must have happened`).toContain(after);
    expect(calls.indexOf(before), `${before} must come before ${after} — got ${JSON.stringify(calls)}`)
        .toBeLessThan(calls.indexOf(after));
}

/** A reopen that reports success, recording that it was reached at all. */
function providerStub(calls: string[], issues: unknown[] = []) {
    return {
        RouteOperation: async (operationKey: string) => {
            calls.push(`RouteOperation:${operationKey}`);
            return { Success: true, Output: { Success: true, Issues: issues } };
        },
    } as unknown as IMetadataProvider;
}

/** A signal-shaped stand-in — `Closing()` to read, `Closing.set()` to write. */
function fakeSignal<T>(initial: T) {
    let value = initial;
    const s = (() => value) as (() => T) & { set(v: T): void };
    s.set = (v: T) => {
        value = v;
    };
    return s;
}

interface Opts {
    /** Is the ACTIVE tab dirty? */
    dirty?: boolean;
    /** Does `Save()` fail — i.e. leave `MessageIsError` true, the way a refused save does? */
    saveFails?: boolean;
}

function workspace(calls: string[], opts: Opts = {}) {
    const c = Object.create(DealWorkspaceComponent.prototype) as Record<string, unknown> & {
        ReopenDeal(): Promise<void>;
        ReopenReason: string;
        MessageIsError: boolean;
        Message: string;
        ReopenPanelOpen: boolean;
    };

    Object.defineProperty(c, 'Deal', { value: { ID: 'deal-1', IsSaved: true }, writable: true });

    c.Closing = fakeSignal(false);
    c.ReopenReason = 'a reason, because the workspace requires one';
    c.ReopenPanelOpen = true;
    c.CloseRouting = [];
    c.MessageIsError = false;
    c.Message = '';

    // The tab store, reduced to what the dirty check reads. A SECOND, clean tab is present on purpose:
    // the check must consult the ACTIVE one, and a stub with a single tab would pass either way.
    c.store = {
        ActiveId: TAB,
        Tabs: [
            { Id: 'tab-0', Dirty: false },
            { Id: TAB, Dirty: opts.dirty === true },
        ],
        MarkClean: (id: string) => {
            calls.push(`MarkClean(${id})`);
        },
    };

    c.Save = async (): Promise<void> => {
        calls.push('Save');
        if (opts.saveFails) {
            // What a refused save actually leaves behind: the reason on screen, and this flag set.
            c.MessageIsError = true;
            c.Message = 'The deal could not be saved.';
        }
    };

    c.ReloadActiveDeal = async (): Promise<void> => {
        calls.push('ReloadActiveDeal');
        (c.store as { MarkClean(id: string): void }).MarkClean(TAB);
    };
    c.RefreshLock = async (): Promise<void> => {
        calls.push('RefreshLock');
    };
    c.SurfaceOperationIssues = (): void => {
        calls.push('SurfaceOperationIssues');
    };
    c.ApplyCloseIssues = (): void => {
        calls.push('ApplyCloseIssues');
    };
    c.Fail = (message: string): void => {
        calls.push('Fail');
        c.MessageIsError = true;
        c.Message = message;
    };
    c.cdr = { detectChanges: () => undefined };

    return c;
}

let savedProvider: IMetadataProvider;

beforeEach(() => {
    savedProvider = Metadata.Provider;
});

afterEach(() => {
    // The provider is a global. Leaving a stub behind would make an unrelated suite's first database
    // read return this fixture's reopen, which is the kind of failure that gets blamed on another file.
    Metadata.Provider = savedProvider;
});

describe('reopening from the workspace keeps unsaved edits', () => {
    it('saves them, and saves them BEFORE the reopen runs', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true });

        await c.ReopenDeal();

        // The edit reached the database at all, and did so while the deal was still closed.
        expectOrder(calls, 'Save', REOPEN_OP);
    });

    it('saves before the reload that would have destroyed the edit', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true });

        await c.ReopenDeal();

        // `ReloadActiveDeal` replaces the entity AND marks the tab clean. Either alone loses the work.
        expectOrder(calls, 'Save', 'ReloadActiveDeal');
        expectOrder(calls, 'Save', `MarkClean(${TAB})`);
    });

    it('does NOT save a clean tab', async () => {
        // The control. Without it the gate could be "always save" and every assertion above still
        // passes — while every reopen of an untouched deal wrote a pointless row and ended edit mode.
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: false });

        await c.ReopenDeal();

        expect(calls, 'a clean tab has nothing to save').not.toContain('Save');
        expect(calls, 'and the reopen still runs').toContain(REOPEN_OP);
    });

    it('reads the ACTIVE tab, not just any tab', async () => {
        // `store.Tabs` carries a clean tab-0 as well. A dirty check that matched the first tab, or
        // `.some(t => t.Dirty)`, would disagree with this the moment a second deal is open.
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true });
        (c.store as { ActiveId: string }).ActiveId = 'tab-0';

        await c.ReopenDeal();

        expect(calls, 'tab-0 is clean, so nothing should have been saved').not.toContain('Save');
    });
});

describe('a save the server refuses abandons the reopen', () => {
    it('does not run the operation', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true, saveFails: true });

        await c.ReopenDeal();

        expect(calls, 'the save was attempted').toContain('Save');
        expect(calls, 'and the reopen must NOT have run over the top of it').not.toContain(REOPEN_OP);
    });

    it('does not reload, so the typing is still on screen to fix', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true, saveFails: true });

        await c.ReopenDeal();

        expect(calls, 'a reload here is the silent loss this issue is about').not.toContain(
            'ReloadActiveDeal',
        );
        expect(calls, 'and the tab must keep its dirty marker').not.toContain(`MarkClean(${TAB})`);
    });

    it('leaves the refusal on screen rather than replacing it with the success line', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true, saveFails: true });

        await c.ReopenDeal();

        expect(c.MessageIsError, 'the error state must survive the early return').toBe(true);
        expect(c.Message).not.toContain('Deal reopened');
    });

    it('keeps the reopen panel open, so the user can retry after fixing the save', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls);
        const c = workspace(calls, { dirty: true, saveFails: true });

        await c.ReopenDeal();

        expect(c.ReopenPanelOpen, 'closing it would hide the reason and the retry').toBe(true);
        expect(c.ReopenReason, 'and the typed reason must not be cleared').not.toBe('');
    });
});

describe('the ordinary success path is unchanged', () => {
    it('still reloads, refreshes the lock and surfaces the operation warnings', async () => {
        const calls: string[] = [];
        Metadata.Provider = providerStub(calls, [{ Message: 'the order stayed Voided' }]);
        const c = workspace(calls, { dirty: false });

        await c.ReopenDeal();

        expectOrder(calls, REOPEN_OP, 'ReloadActiveDeal');
        expect(calls).toContain('RefreshLock');
        // A reopen whose order could not come back says so. `71-lost-and-reopen` names a silent
        // reopen as the bug, because the deal looks workable and its order is dead.
        expect(calls, 'the operation issues must still be surfaced').toContain('SurfaceOperationIssues');
        expect(c.MessageIsError).toBe(false);
    });
});
