import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, type LossReasonOption } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#205: the deal form had no way to close a deal.
 *
 * Filtering the closing statuses out of the Status control (the companion change) matches what the
 * workspace has always done — but the workspace also has a close ACTION, and this form did not. Its
 * "Close" panel is a list of fields: ActualCloseDate, ClosedAt, ClosedByUserID. Fields are not an
 * action, so removing the status option would have left a form user unable to close a deal at all.
 *
 * WHAT IS TESTED HERE is the decision, not the round trip. Whether `Sales.CloseDeal` does the right
 * thing is the operation's own business and has integration coverage; what can silently go wrong here
 * is offering the action on a deal that cannot take it, or letting a Lost close through without the
 * reason the operation will refuse it for.
 */
const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'hold-1', Name: 'On Hold', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
    { ID: 'lost-1', Name: 'Lost', LocksDeal: true, IsWon: false, IsLost: true },
];

const REASONS: LossReasonOption[] = [
    { ID: 'r-price', Name: 'Price', RequiresNotes: false },
    { ID: 'r-compet', Name: 'Competitor', RequiresNotes: true },
];

function panelWith(over: Partial<Record<string, unknown>> = {}) {
    const panel = Object.create(MJSDealClosePanel.prototype) as MJSDealClosePanel;
    Object.defineProperty(panel, 'Record', {
        value: { IsSaved: true, DealStatusTypeID: 'open-1', ...over } as unknown as DealEntity,
        configurable: true,
    });
    (panel as unknown as { statuses: DealStatusOption[] }).statuses = STATUSES;
    panel.LossReasons = REASONS;
    panel.Closing = false;
    panel.Outcome = null;
    panel.LossReasonID = null;
    panel.LossNotes = '';
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

    it('is not offered when the status list never loaded', () => {
        const panel = panelWith();
        (panel as unknown as { statuses: DealStatusOption[] }).statuses = [];
        // Nothing is known to lock, so nothing reads as closed — the action stays available and the
        // server refuses anything wrong. Pinned so the empty-list case is a decision, not an accident.
        expect(panel.CanClose).toBe(true);
    });
});

describe('a Lost close cannot be confirmed without what the operation demands', () => {
    it('refuses to confirm before an outcome is chosen', () => {
        expect(panelWith().CanConfirm).toBe(false);
    });

    it('confirms a Won close with nothing else filled in', () => {
        const p = panelWith();
        p.Outcome = 'won';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses a Lost close with no reason', () => {
        const p = panelWith();
        p.Outcome = 'lost';
        expect(p.CanConfirm).toBe(false);
    });

    it('confirms a Lost close once a reason that needs no notes is chosen', () => {
        const p = panelWith();
        p.Outcome = 'lost';
        p.LossReasonID = 'r-price';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses a reason flagged RequiresNotes until notes are written', () => {
        const p = panelWith();
        p.Outcome = 'lost';
        p.LossReasonID = 'r-compet';
        expect(p.LossReasonRequiresNotes).toBe(true);
        expect(p.CanConfirm).toBe(false);

        p.LossNotes = '   ';
        expect(p.CanConfirm, 'whitespace is not notes').toBe(false);

        p.LossNotes = 'Lost to a cheaper incumbent.';
        expect(p.CanConfirm).toBe(true);
    });

    it('refuses to confirm twice while a close is in flight', () => {
        const p = panelWith();
        p.Outcome = 'won';
        p.Closing = true;
        expect(p.CanConfirm).toBe(false);
    });
});
