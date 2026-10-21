import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { SelectableStages } from '../lib/data/selectable-stages';
import { MJSDealPipelinePanel, type PipelineStageOption } from '../lib/form-panels/deal-form.panels';

/**
 * The deal form and the workspace leave out of their Stage lists every stage whose status locks the
 * deal, as the board does. Picking one did not close the deal, it left it open at a closing stage.
 * Read from `LocksDeal`, never from a name.
 */

const PIPELINE = 'p-b2b';

const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
    { ID: 'lost-1', Name: 'Lost', LocksDeal: true, IsWon: false, IsLost: true },
];

const STAGES: PipelineStageOption[] = [
    { ID: 's-disc', Name: 'Discovery', PipelineID: PIPELINE, DealStatusTypeID: 'open-1' },
    { ID: 's-prop', Name: 'Proposal', PipelineID: PIPELINE, DealStatusTypeID: 'OPEN-1' },
    { ID: 's-signed', Name: 'Signed', PipelineID: PIPELINE, DealStatusTypeID: 'won-1' },
    { ID: 's-lost', Name: 'Lost', PipelineID: PIPELINE, DealStatusTypeID: 'LOST-1' },
    { ID: 's-none', Name: 'Unassigned', PipelineID: PIPELINE, DealStatusTypeID: null },
];

describe('SelectableStages', () => {
    it('leaves out stages whose status locks the deal, matching IDs in any case', () => {
        expect(SelectableStages(STAGES, STATUSES, null).map((s) => s.Name)).toEqual([
            'Discovery',
            'Proposal',
            'Unassigned',
        ]);
    });

    it('keeps the current stage listed when the deal already sits in a closing one', () => {
        expect(SelectableStages(STAGES, STATUSES, 'S-LOST').map((s) => s.Name)).toEqual([
            'Discovery',
            'Proposal',
            'Lost',
            'Unassigned',
        ]);
    });

    it('leaves every stage in when no status is known to lock', () => {
        expect(SelectableStages(STAGES, [], null)).toHaveLength(STAGES.length);
    });
});

describe('the deal form Stage list', () => {
    function panelWith(stageID: string | null) {
        const panel = new MJSDealPipelinePanel();
        Object.defineProperty(panel, 'Record', {
            value: { PipelineID: PIPELINE, PipelineStageID: stageID, IsSaved: true } as unknown as DealEntity,
            configurable: true,
            writable: true,
        });
        const signals = panel as unknown as {
            stages: { set(v: PipelineStageOption[]): void };
            statuses: { set(v: DealStatusOption[]): void };
        };
        signals.stages.set(STAGES);
        signals.statuses.set(STATUSES);
        return panel;
    }

    it('does not offer the closing stages', () => {
        expect(panelWith('s-disc').StagesForCurrentPipeline.map((s) => s.Name)).toEqual([
            'Discovery',
            'Proposal',
            'Unassigned',
        ]);
    });

    it('still shows a closing stage the deal is already in', () => {
        expect(panelWith('s-signed').StagesForCurrentPipeline.map((s) => s.ID)).toContain('s-signed');
    });
});
