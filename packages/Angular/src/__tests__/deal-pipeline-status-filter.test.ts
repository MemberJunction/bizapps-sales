import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealPipelinePanel, type LossReasonOption } from '../lib/form-panels/deal-form.panels';

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
const REASONS: LossReasonOption[] = [
    { ID: 'r-price', Name: 'Price', RequiresNotes: false },
    { ID: 'r-compet', Name: 'Competitor', RequiresNotes: true },
];

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
    panel.LossReasons.set(REASONS);
    return panel;
}

describe('what the status control offers depends on where the deal is', () => {
    it('offers the WHOLE lifecycle on an open deal', () => {
        /**
         * golive#205: "Changing Deal Status to Won or Lost should close the deal properly." The closing
         * statuses are offered again — what makes that safe is that picking one does not WRITE it, it
         * starts the close. See the suite below.
         */
        const names = panelWith('open-1').SelectableStatuses.map((s) => s.Name);
        expect(names).toEqual(['Open', 'On Hold', 'Won', 'Lost', 'Abandoned']);
    });

    it('reaches Abandoned, which a Won/Lost pair could never express', () => {
        expect(panelWith('open-1').SelectableStatuses.map((s) => s.ID)).toContain('aban-1');
    });

    it('offers only the non-locking ones on a CLOSED deal', () => {
        // The only move a closed deal has is a reopen. Another closing status is neither a close nor
        // a reopen, and the server has no path for it.
        const names = panelWith('won-1').SelectableStatuses.map((s) => s.Name);
        expect(names).toEqual(['Open', 'On Hold']);
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

    it('IS editable on a closed deal, because that is how you reopen it', () => {
        /**
         * golive#205 D9 and #206 item 3 both ask for this: "Deal Status should stay editable so the
         * deal can be set back to Open." What makes it safe is that picking does not WRITE — see the
         * reopen suite below.
         */
        expect(panelWith('won-1').StatusIsEditable).toBe(true);
    });

    it('is not editable while a close or reopen is in flight', () => {
        const p = panelWith('won-1');
        p.Busy = true;
        expect(p.StatusIsEditable).toBe(false);
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

describe('picking an open status on a CLOSED deal starts a reopen, it does not write', () => {
    /**
     * The mirror of the defect this whole change closes. A bare status write OUT of a locking status
     * would unlock the deal with no reopen event, the close stamps still set and the order still
     * voided — and nothing would refuse it: `IsBareCloseWrite` returns false when the PRIOR status
     * locks, deliberately, because the close lock owns that refusal, and the lock only owns it while
     * DealStatusTypeID stays out of the editable-while-locked set.
     */
    it('holds the pick instead of writing it', () => {
        const p = panelWith('won-1');
        p.SetStatus('open-1');
        expect(p.Record.DealStatusTypeID, 'the status must not have moved').toBe('won-1');
        expect(p.PendingReopenStatusID).toBe('open-1');
        expect(p.PendingReopenStatusName).toBe('Open');
    });

    it('writes normally on a deal that is not closed', () => {
        const p = panelWith('open-1');
        p.SetStatus('hold-1');
        expect(p.Record.DealStatusTypeID).toBe('hold-1');
        expect(p.PendingReopenStatusID).toBeNull();
    });

    /**
     * THIS PINNED THE OPPOSITE, and golive#205 asks for it in so many words: "No reopen reason should
     * be required in this path." Master plan 7.3 and `close-deal.CD10` still hold -- they are about
     * the AUDIT TRAIL, and `Sales.ReopenDeal` still refuses a blank reason. The form stops demanding
     * one and starts supplying one instead, so nobody is made to type and nothing lands unexplained.
     */
    it('does not demand a reason before the button works', () => {
        const p = panelWith('won-1');
        p.SetStatus('open-1');
        expect(p.CanConfirmReopen).toBe(true);
        p.ReopenReason = '   ';
        expect(p.CanConfirmReopen, 'whitespace must not re-impose the requirement').toBe(true);
    });

    it('records a reason naming the status it was reopened into', () => {
        // The operation refuses a blank one, so an "optional" label that sent blank would fail a round
        // trip on a field the form said was optional.
        const p = panelWith('won-1');
        p.SetStatus('open-1');
        const reason = p.ResolvedReopenReason();
        expect(reason.trim().length).toBeGreaterThan(0);
        expect(reason).toContain('Open');
    });

    it('cannot confirm without a pending pick', () => {
        const p = panelWith('won-1');
        p.ReopenReason = 'Customer came back.';
        expect(p.CanConfirmReopen).toBe(false);
    });

    it('cancelling drops the pick and leaves the deal closed', () => {
        const p = panelWith('won-1');
        p.SetStatus('open-1');
        p.ReopenReason = 'Changed my mind.';
        p.CancelReopen();
        expect(p.PendingReopenStatusID).toBeNull();
        expect(p.ReopenReason).toBe('');
        expect(p.Record.DealStatusTypeID).toBe('won-1');
    });
});

describe('picking a closing status on an OPEN deal starts a close, it does not write', () => {
    /**
     * The other half of the same rule as the reopen. Writing it would lock the deal with none of the
     * close having run — no stage event, no contract, no finance tasks, and for a Lost deal no loss
     * reason and a live order. `bareCloseRefusal` refuses exactly that on the server, so writing it
     * here would produce a refused save rather than a closed deal.
     */
    it('holds the pick instead of writing it', () => {
        const p = panelWith('open-1');
        p.SetStatus('won-1');
        expect(p.Record.DealStatusTypeID, 'the status must not have moved').toBe('open-1');
        expect(p.PendingCloseStatusID).toBe('won-1');
        expect(p.PendingCloseStatusName).toBe('Won');
    });

    it('a winning close needs nothing else', () => {
        const p = panelWith('open-1');
        p.SetStatus('won-1');
        expect(p.CanConfirmClose).toBe(true);
    });

    it('a losing close needs a reason', () => {
        const p = panelWith('open-1');
        p.SetStatus('lost-1');
        expect(p.CanConfirmClose).toBe(false);
        p.LossReasonID = 'r-price';
        expect(p.CanConfirmClose).toBe(true);
    });

    it('a reason flagged RequiresNotes needs notes', () => {
        const p = panelWith('open-1');
        p.SetStatus('aban-1');
        p.LossReasonID = 'r-compet';
        expect(p.LossReasonRequiresNotes).toBe(true);
        expect(p.CanConfirmClose).toBe(false);
        p.LossNotes = '   ';
        expect(p.CanConfirmClose, 'whitespace is not notes').toBe(false);
        p.LossNotes = 'Lost to a cheaper incumbent.';
        expect(p.CanConfirmClose).toBe(true);
    });

    it('drops notes when the new reason does not require them', () => {
        const p = panelWith('open-1');
        p.SetStatus('lost-1');
        p.LossReasonID = 'r-compet';
        p.LossNotes = 'Lost to Acme.';
        p.LossReasonID = 'r-price';
        p.OnLossReasonChange();
        expect(p.LossNotes).toBe('');
    });

    it('cancelling drops the pick and leaves the deal open', () => {
        const p = panelWith('open-1');
        p.SetStatus('won-1');
        p.CancelClose();
        expect(p.PendingCloseStatusID).toBeNull();
        expect(p.Record.DealStatusTypeID).toBe('open-1');
    });

    it('cannot confirm while something is in flight', () => {
        const p = panelWith('open-1');
        p.SetStatus('won-1');
        p.Busy = true;
        expect(p.CanConfirmClose).toBe(false);
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

    it('renders the close prompt and wires it to the guarded confirm', () => {
        // Same reasoning as the reopen prompt below: without this block a pick on an open deal is held
        // and never released, and without the guard a Lost close goes through with no reason.
        const after = source.slice(source.indexOf('@if (PendingCloseStatusID) {'));
        const prompt = after.slice(0, after.indexOf('@if (PendingReopenStatusID) {'));
        expect(prompt).toContain('[disabled]="!CanConfirmClose"');
        expect(prompt).toContain('(click)="ConfirmClose()"');
        expect(prompt).toContain('(click)="CancelClose()"');
        expect(prompt).toContain('@if (PendingCloseStatus?.IsLost)');
    });

    it('renders the reopen prompt and wires it to the guarded confirm', () => {
        // The prompt is the only thing standing between a pick on a closed deal and nothing happening
        // at all: SetStatus holds the value, and without this block there is no way to release it.
        const after = source.slice(source.indexOf('@if (PendingReopenStatusID) {'));
        const prompt = after.slice(0, after.indexOf('} @else if (!CurrentStatusIsClosing)'));
        expect(prompt).toContain('[(ngModel)]="ReopenReason"');
        expect(prompt).toContain('[disabled]="!CanConfirmReopen"');
        expect(prompt).toContain('(click)="ConfirmReopen()"');
        expect(prompt).toContain('(click)="CancelReopen()"');
    });
});

/**
 * THE WIRING, which the behavioural tests above cannot see.
 *
 * `ReopenReasonOrDefault` is correct and pinned, and both `CanConfirmReopen` gates are pinned — and a
 * mutation making `ConfirmReopen` send `this.ReopenReason` straight through, bypassing the default,
 * SURVIVED all of them. The helper being right does not prove anything calls it, which is the exact
 * shape of defect this branch exists to remove.
 *
 * Asserted against the source because `ConfirmReopen` reaches `Metadata.Provider` through `RunReopen`,
 * and standing that up to observe one argument would test the harness more than the code.
 */
describe('every reopen goes through the resolved reason', () => {
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

    it('has both call sites, and neither passes the raw field', () => {
        // `await` so the function's own declaration does not count as a call site.
        const calls = source.match(/await RunReopen\([^)]*\)/g) ?? [];
        // Two panels offer a reopen; if a third appears this count fails and someone has to decide
        // whether it too should go through the helper. That is the intended outcome.
        expect(calls.length, 'the Close panel and the Pipeline panel').toBe(2);
        for (const call of calls) {
            expect(call, `raw ReopenReason must not reach the operation: ${call}`).not.toMatch(
                /this\.ReopenReason/,
            );
            expect(call).toMatch(/ResolvedReopenReason\(\)/);
        }
    });

    it('resolves through the one module-level rule, not a per-panel copy', () => {
        // Two copies of this rule is what made the two panels disagree in the first place.
        const definitions = source.match(/function ReopenReasonOrDefault\(/g) ?? [];
        expect(definitions.length, 'exactly one definition').toBe(1);
    });
});
