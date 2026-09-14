import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, type LossReasonOption } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#205: the deal form had no way to close a deal, and no way back.
 *
 * Filtering the closing statuses out of the Status control (the companion change) matches what the
 * workspace has always done — but the workspace also has close AND reopen actions, and this form had
 * neither. Its "Close" panel was a list of fields; fields are not an action, so removing the status
 * option would have left a form user unable to close a deal at all, and a closed one stranded.
 *
 * WHAT IS TESTED HERE is the decision, not the round trip. Whether `Sales.CloseDeal` does the right
 * thing is the operation's own business and has integration coverage; what can silently go wrong here
 * is offering an action on a deal that cannot take it, or letting a close through without what the
 * operation will refuse it for.
 *
 * CONSTRUCTED, NOT `Object.create`d — the prototype trick meant no field initialiser ever ran, so
 * removing one stayed green here and threw in the browser. Measured: changing `LossNotes = ''` to
 * `LossNotes!: string` used to pass.
 */
const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'hold-1', Name: 'On Hold', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
    { ID: 'lost-1', Name: 'Lost', LocksDeal: true, IsWon: false, IsLost: true },
    { ID: 'aban-1', Name: 'Abandoned', LocksDeal: true, IsWon: false, IsLost: true },
];

const REASONS: LossReasonOption[] = [
    { ID: 'r-price', Name: 'Price', RequiresNotes: false },
    { ID: 'r-compet', Name: 'Competitor', RequiresNotes: true },
];

function panelWith(over: Record<string, unknown> = {}) {
    const panel = new MJSDealClosePanel();
    Object.defineProperty(panel, 'Record', {
        value: { IsSaved: true, DealStatusTypeID: 'open-1', ...over } as unknown as DealEntity,
        configurable: true,
        writable: true,
    });
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    panel.LossReasons.set(REASONS);
    return panel;
}

describe('the close action is offered only where it can be taken', () => {
    it('is offered on a saved, open deal', () => {
        expect(panelWith().CanClose).toBe(true);
    });

    it('is not offered on a deal nobody has saved', () => {
        // There is nothing to close, and the operation needs a DealID.
        expect(panelWith({ IsSaved: false }).CanClose).toBe(false);
    });

    it('is not offered on a deal that is already closed', () => {
        expect(panelWith({ DealStatusTypeID: 'won-1' }).CanClose).toBe(false);
        expect(panelWith({ DealStatusTypeID: 'lost-1' }).CanClose).toBe(false);
    });

    it('stays offered on a deal merely paused', () => {
        // On Hold neither wins nor loses nor locks. Treating "not open" as "closed" would hide the
        // action on a deal that is still very much live.
        expect(panelWith({ DealStatusTypeID: 'hold-1' }).CanClose).toBe(true);
    });

    it('is NOT offered when the status cannot be resolved', () => {
        // Fails closed. The old version read an empty list as "nothing locks, so it is open" and
        // offered Close on a deal that was already closed.
        const p = panelWith();
        (p as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set([]);
        expect(p.CanClose).toBe(false);
        expect(panelWith({ DealStatusTypeID: 'ghost-1' }).CanClose).toBe(false);
    });
});

describe('the reopen action is the mirror of it', () => {
    it('is offered on a closed deal', () => {
        expect(panelWith({ DealStatusTypeID: 'won-1' }).CanReopen).toBe(true);
    });

    it('is not offered on an open one', () => {
        expect(panelWith().CanReopen).toBe(false);
    });

    it('is not offered on an unsaved deal, nor on an unresolved status', () => {
        expect(panelWith({ IsSaved: false, DealStatusTypeID: 'won-1' }).CanReopen).toBe(false);
        expect(panelWith({ DealStatusTypeID: 'ghost-1' }).CanReopen).toBe(false);
    });

    it('never offers both actions at once', () => {
        for (const id of ['open-1', 'hold-1', 'won-1', 'lost-1', 'aban-1', 'ghost-1']) {
            const p = panelWith({ DealStatusTypeID: id });
            expect(p.CanClose && p.CanReopen, id).toBe(false);
        }
    });

    it('demands a reason, which the operation requires', () => {
        // golive#205 asks for the opposite ("No reopen reason should be required in this path"), but
        // Sales.ReopenDeal refuses without one and CD10 pins that. Refusing here saves a round trip.
        const p = panelWith({ DealStatusTypeID: 'won-1' });
        expect(p.CanConfirmReopen).toBe(false);
        p.ReopenReason = '   ';
        expect(p.CanConfirmReopen, 'whitespace is not a reason').toBe(false);
        p.ReopenReason = 'Customer came back.';
        expect(p.CanConfirmReopen).toBe(true);
    });
});

describe('the outcome is a real status, not a Won/Lost abstraction', () => {
    it('offers every status that locks, by name', () => {
        expect(panelWith().ClosingStatuses.map((s) => s.Name)).toEqual(['Won', 'Lost', 'Abandoned']);
    });

    it('reaches Abandoned, which a find(IsLost) could never select', () => {
        // Lost and Abandoned both carry IsLost. The old code resolved the target with find(IsLost),
        // so it picked whichever sorted first and Abandoned was unreachable from the form.
        const p = panelWith();
        p.TargetStatusID = 'aban-1';
        expect(p.SelectedStatus?.Name).toBe('Abandoned');
        expect(p.SelectedStatus?.IsLost).toBe(true);
    });
});

describe('a losing close cannot be confirmed without what the operation demands', () => {
    it('refuses to confirm before an outcome is chosen', () => {
        expect(panelWith().CanConfirm).toBe(false);
    });

    it('confirms a winning close with nothing else filled in', () => {
        const p = panelWith();
        p.TargetStatusID = 'won-1';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses a losing close with no reason', () => {
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        expect(p.CanConfirm).toBe(false);
    });

    it('confirms once a reason that needs no notes is chosen', () => {
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        p.LossReasonID = 'r-price';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses a reason flagged RequiresNotes until notes are written', () => {
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        p.LossReasonID = 'r-compet';
        expect(p.LossReasonRequiresNotes).toBe(true);
        expect(p.CanConfirm).toBe(false);

        p.LossNotes = '   ';
        expect(p.CanConfirm, 'whitespace is not notes').toBe(false);

        p.LossNotes = 'Lost to a cheaper incumbent.';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses to confirm twice while something is in flight', () => {
        const p = panelWith();
        p.TargetStatusID = 'won-1';
        p.Closing = true;
        expect(p.CanConfirm).toBe(false);
    });
});

describe('loss detail does not outlive the outcome it belonged to', () => {
    it('drops the reason and notes when the outcome stops being a loss', () => {
        // The notes field only renders while a RequiresNotes reason is selected, so a user who typed
        // notes and then switched to Won could not see they were still there — and they were still
        // submitted, against an outcome that contradicts them.
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        p.LossReasonID = 'r-compet';
        p.LossNotes = 'Lost to Acme on price.';

        p.TargetStatusID = 'won-1';
        p.OnTargetChange();
        expect(p.LossReasonID).toBeNull();
        expect(p.LossNotes).toBe('');
    });

    it('keeps them when switching between two losing statuses', () => {
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        p.LossReasonID = 'r-price';
        p.TargetStatusID = 'aban-1';
        p.OnTargetChange();
        expect(p.LossReasonID).toBe('r-price');
    });

    it('drops notes when the new reason does not require them', () => {
        const p = panelWith();
        p.TargetStatusID = 'lost-1';
        p.LossReasonID = 'r-compet';
        p.LossNotes = 'Lost to Acme.';
        p.LossReasonID = 'r-price';
        p.OnLossReasonChange();
        expect(p.LossNotes).toBe('');
    });
});

describe('the template wires the actions it claims to', () => {
    /**
     * The assertions above are all getters. The actions themselves live in the template, and deleting
     * a gate there leaves every test above green while the button reappears on a deal that cannot take
     * it — the same hole the status-filter suite had.
     */
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

    it('gates the close action on CanClose and the reopen on CanReopen', () => {
        expect(source).toContain('@if (CanClose) {');
        expect(source).toContain('@if (CanReopen) {');
    });

    it('renders the outcome radios from ClosingStatuses', () => {
        expect(source).toContain('@for (s of ClosingStatuses; track s.ID)');
    });

    it('shows the result OUTSIDE both action gates', () => {
        // These used to sit inside @if (CanClose), and ConfirmClose ends by reloading the record —
        // which closes the deal, flips CanClose false, and unmounted the confirmation and every
        // warning the close had just produced.
        expect(source).toContain('@if (Message || Issues.length) {');
    });

    it('tracks issues by index, since two tasks can fail identically', () => {
        expect(source).toContain('@for (i of Issues; track $index)');
    });
});
