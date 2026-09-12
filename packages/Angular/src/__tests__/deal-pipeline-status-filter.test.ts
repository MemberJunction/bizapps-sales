import '@angular/compiler';
import { describe, it, expect } from 'vitest';
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
 */
const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false },
    { ID: 'hold-1', Name: 'On Hold', LocksDeal: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true },
    { ID: 'lost-1', Name: 'Lost', LocksDeal: true },
    { ID: 'aban-1', Name: 'Abandoned', LocksDeal: true },
];

const panelWith = (statusID: string | null, statuses: DealStatusOption[] = STATUSES) => {
    const panel = Object.create(MJSDealPipelinePanel.prototype) as MJSDealPipelinePanel;
    Object.defineProperty(panel, 'Record', {
        value: { DealStatusTypeID: statusID } as unknown as DealEntity,
        configurable: true,
    });
    // The loaded list, as ngOnInit would have left it.
    (panel as unknown as { statuses: DealStatusOption[] }).statuses = statuses;
    return panel;
};

describe('the status control offers the open lifecycle only', () => {
    it('excludes every status that locks the deal', () => {
        const names = panelWith('open-1').SelectableStatuses.map((s) => s.Name);
        expect(names).toEqual(['Open', 'On Hold']);
    });

    it('keeps On Hold, which is neither won nor lost nor locking', () => {
        // The reason to filter on LocksDeal rather than "is it closed": pausing a deal is not closing it.
        expect(panelWith('open-1').SelectableStatuses.map((s) => s.ID)).toContain('hold-1');
    });

    it('excludes Abandoned, which a won/lost filter would have to know about separately', () => {
        expect(panelWith('open-1').SelectableStatuses.map((s) => s.ID)).not.toContain('aban-1');
    });

    it('offers nothing when the lookup returned nothing, rather than inventing a list', () => {
        expect(panelWith('open-1', []).SelectableStatuses).toEqual([]);
    });
});

describe('a closed deal still shows what it is', () => {
    it('names the current status even though it is not selectable', () => {
        // Dropping the option entirely would render a won deal as "— choose —", which reads as data loss.
        const panel = panelWith('won-1');
        expect(panel.CurrentStatusName).toBe('Won');
        expect(panel.SelectableStatuses.map((s) => s.ID)).not.toContain('won-1');
    });

    it('knows it is sitting in a closing status', () => {
        expect(panelWith('won-1').CurrentStatusIsClosing).toBe(true);
        expect(panelWith('open-1').CurrentStatusIsClosing).toBe(false);
    });

    it('matches the id case-insensitively, because ids arrive cased either way', () => {
        expect(panelWith('WON-1').CurrentStatusIsClosing).toBe(true);
        expect(panelWith('WON-1').CurrentStatusName).toBe('Won');
    });

    it('refuses to edit the status of a closed deal', () => {
        // The mirror of the defect this closes: a status write that UNLOCKS a deal without the reopen
        // having run. Reopening is the audited way back.
        expect(panelWith('won-1').StatusIsEditable).toBe(false);
        expect(panelWith('open-1').StatusIsEditable).toBe(true);
    });

    it('says nothing about a status it has never heard of, rather than guessing', () => {
        const panel = panelWith('not-a-real-id');
        expect(panel.CurrentStatusName).toBe('');
        expect(panel.CurrentStatusIsClosing).toBe(false);
    });
});
