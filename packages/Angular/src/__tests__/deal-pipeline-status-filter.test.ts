import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#205: the deal form offered Won and Lost in the Status control, and picking one
 * wrote the status with none of the close running — no stage event, no contract, no finance tasks.
 *
 * WHY THE FORM AND NOT THE SERVER. The server already refuses the write; that guard is elsewhere and
 * has its own integration check. What this pins is that the option is not offered in the first place,
 * which is how the deal workspace has always behaved: closing goes through the close action, and the
 * status dropdown carries the open lifecycle only.
 *
 * BY FLAG, NEVER BY NAME. A deployment can rename "Won" to "Signed". `LocksDeal` is also specifically
 * the flag the SERVER reads, so filtering on anything else would eventually offer a status the save
 * then refuses — the form and the server disagreeing, which is the failure `close-lock.ts` exists to
 * prevent.
 *
 * CONSTRUCTED, NOT `Object.create`d. The earlier version built the panel off the prototype, so no
 * field initialiser ever ran and a removed one was invisible here while crashing in the browser. The
 * panel takes no constructor arguments and injects nothing, deliberately — see the note on `statuses`
 * in the component.
 */
const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'hold-1', Name: 'On Hold', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
    { ID: 'lost-1', Name: 'Lost', LocksDeal: true, IsWon: false, IsLost: true },
    { ID: 'aban-1', Name: 'Abandoned', LocksDeal: true, IsWon: false, IsLost: true },
];

function panelWith(statusID: string | null, statuses: DealStatusOption[] = STATUSES, isSaved = true) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', {
        value: { DealStatusTypeID: statusID, IsSaved: isSaved } as unknown as DealEntity,
        configurable: true,
        writable: true,
    });
    // The loaded list, as ngOnInit would have left it.
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(statuses);
    return panel;
}

describe('the status control offers the open lifecycle only', () => {
    it('excludes every status that locks the deal', () => {
        const names = panelWith('open-1').SelectableStatuses.map((s) => s.Name);
        expect(names).toEqual(['Open', 'On Hold']);
    });

    it('keeps On Hold, which is neither won nor lost nor locking', () => {
        // Pausing a deal is not closing it. A filter on "is it closed" would take this with it.
        expect(panelWith('open-1').SelectableStatuses.map((s) => s.ID)).toContain('hold-1');
    });

    it('excludes Abandoned, which a won/lost filter would have to know about separately', () => {
        expect(panelWith('open-1').SelectableStatuses.map((s) => s.ID)).not.toContain('aban-1');
    });
});

describe('a closed deal still shows what it is', () => {
    it('names the current status even though it is not selectable', () => {
        expect(panelWith('won-1').CurrentStatusName).toBe('Won');
        expect(panelWith('won-1').CurrentStatusIsClosing).toBe(true);
    });

    it('matches the id case-insensitively, because ids arrive cased either way', () => {
        expect(panelWith('WON-1').CurrentStatusIsClosing).toBe(true);
        expect(panelWith('WON-1').CurrentStatusName).toBe('Won');
    });

    it('reports no name for a status that is not in the list', () => {
        expect(panelWith('ghost-1').CurrentStatusName).toBe('');
    });
});

describe('editability fails CLOSED when the status cannot be resolved', () => {
    it('is editable on an open deal', () => {
        expect(panelWith('open-1').StatusIsEditable).toBe(true);
    });

    it('is not editable on a closed deal', () => {
        expect(panelWith('won-1').StatusIsEditable).toBe(false);
    });

    it('is not editable before the list has loaded', () => {
        // Rendering an enabled control whose only option is the blank one, on a deal whose real status
        // is simply not known yet, is how a user nulls a status by accident.
        expect(panelWith('won-1', []).StatusIsEditable).toBe(false);
    });

    it('is not editable on an UNSAVED deal before the list has loaded', () => {
        /**
         * The case that isolates the empty-list guard. On a SAVED deal the unresolved-status check
         * below catches an empty list too, so deleting the guard leaves that assertion green — measured.
         * Only an unsaved deal reaches it alone, and an enabled dropdown with nothing in it but the
         * blank option is exactly the control a user clicks to no effect.
         */
        expect(panelWith(null, [], false).StatusIsEditable).toBe(false);
    });

    it('is not editable when a saved deal sits in a status the list does not contain', () => {
        // An admin deactivating "Won" (the loader filters IsActive = 1) used to make every won deal
        // read as open and editable, while the server refused every edit to it.
        expect(panelWith('ghost-1').StatusIsEditable).toBe(false);
    });

    it('stays editable on an UNSAVED deal whose status is not set', () => {
        expect(panelWith(null, STATUSES, false).StatusIsEditable).toBe(true);
    });
});

describe('the blank option cannot clear a saved deal', () => {
    it('writes a chosen status', () => {
        const p = panelWith('open-1');
        p.SetStatus('hold-1');
        expect(p.Record.DealStatusTypeID).toBe('hold-1');
    });

    it('refuses to null the status of a saved deal', () => {
        // DealStatusTypeID is nullable and the server cannot repair it: the opening default is
        // creation-only and a deliberate null counts as caller-supplied. The result is a deal every
        // IsOpen/IsWon rollup skips.
        const p = panelWith('open-1');
        p.SetStatus(null);
        expect(p.Record.DealStatusTypeID).toBe('open-1');
    });

    it('allows a null on a deal nobody has saved', () => {
        const p = panelWith('open-1', STATUSES, false);
        p.SetStatus(null);
        expect(p.Record.DealStatusTypeID).toBeNull();
    });
});

describe('option matching is case-insensitive', () => {
    it('compares ids without regard to case', () => {
        const c = panelWith('open-1').CompareStatus;
        expect(c('WON-1', 'won-1')).toBe(true);
        expect(c('won-1', 'lost-1')).toBe(false);
        expect(c(null, null)).toBe(true);
    });
});

describe('the template actually uses all of this', () => {
    /**
     * Everything above tests GETTERS. None of it reaches the template, and the whole user-visible fix
     * lives there: point the `@for` at `statuses` instead of `SelectableStatuses`, or drop the
     * `[disabled]`, and every assertion in this file stays green while Won and Lost are back in the
     * dropdown. Measured — that exact edit passed the suite before this block existed.
     */
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
    const select = source.slice(source.indexOf('<select [ngModel]="Record.DealStatusTypeID"'));
    const control = select.slice(0, select.indexOf('</select>'));

    it('renders the filtered list, not the raw one', () => {
        expect(control).toContain('@for (s of SelectableStatuses; track s.ID)');
        expect(control).not.toMatch(/@for \(s of statuses/);
    });

    it('disables the control from StatusIsEditable', () => {
        expect(control).toContain('[disabled]="!StatusIsEditable"');
    });

    it('matches options with CompareStatus', () => {
        expect(control).toContain('[compareWith]="CompareStatus"');
    });

    it('disables the blank option on a saved deal', () => {
        expect(control).toMatch(/<option \[ngValue\]="null" \[disabled\]="Record\.IsSaved"/);
    });

    it('keeps the current status visible when it is a closing one', () => {
        expect(control).toContain('@if (CurrentStatusIsClosing)');
    });
});
