import '@angular/compiler';
import { describe, expect, it } from 'vitest';

import { ALL_PIPELINES, DealBoardComponent } from '../lib/board/deal-board.component';
import type { PipelineLookup, StageLookup } from '../lib/workspace/deal-workspace.types';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

/**
 * The Board showed one pipeline at a time, so seeing every company's deals meant clicking through each
 * tab. The All tab lays every allowed pipeline out at once, one lane per pipeline, since each pipeline
 * has its own stages.
 */

const P = (ID: string, CompanyID: string, DisplayRank: number): PipelineLookup => ({
    ID, Name: ID, Code: ID, CompanyID, CompanyName: CompanyID, IsDefault: false, DisplayRank,
});
const S = (ID: string, PipelineID: string, DisplayOrder: number): StageLookup => ({
    ID, Name: ID, PipelineID, DisplayOrder, Probability: null, ForecastCategoryTypeID: null, DealStatusTypeID: null, RottingDays: null,
});
const D = (ID: string, PipelineID: string, PipelineStageID: string | null): DealRosterRow =>
    ({ ID, Name: ID, PipelineID, PipelineStageID, Amount: 0, CurrencyCode: 'USD', IsOpen: true, AmountIsComputed: false }) as DealRosterRow;

const PIPELINES = [P('p-a', 'company-a', 1), P('p-b', 'company-b', 2), P('p-c', 'company-c', 3)];
const STAGES = [S('a1', 'p-a', 1), S('a2', 'p-a', 2), S('b1', 'p-b', 1), S('c1', 'p-c', 1)];
const DEALS = [D('d1', 'p-a', 'a2'), D('d2', 'p-b', 'b1'), D('d3', 'p-b', null)];

function boardWith(selected: string | null, companyIDs: string[] = []): DealBoardComponent {
    const b = Object.create(DealBoardComponent.prototype) as DealBoardComponent;
    Object.assign(b, {
        Pipelines: PIPELINES,
        Stages: STAGES,
        DealStatusTypes: [],
        Deals: DEALS,
        CompanyIDs: companyIDs,
        PipelineIDs: [],
        HidePipelines: false,
        SelectedPipelineID: selected,
        columnIDCache: new Map(),
    });
    return b;
}

describe('the Board All tab', () => {
    it('shows one lane per pipeline that holds a deal, each with its own stages', () => {
        const lanes = boardWith(ALL_PIPELINES).Lanes;
        expect(lanes.map((l) => l.PipelineID)).toEqual(['p-a', 'p-b']);
        const a = lanes.find((l) => l.PipelineID === 'p-a');
        expect(a?.Columns.map((c) => c.StageID)).toEqual(['a1', 'a2']);
        expect(a?.Columns.find((c) => c.StageID === 'a2')?.Cards.map((d) => d.ID)).toEqual(['d1']);
        const b = lanes.find((l) => l.PipelineID === 'p-b');
        expect(b?.Unstaged.map((d) => d.ID)).toEqual(['d3']);
    });

    it('shows a single pipeline when a pipeline tab is chosen', () => {
        expect(boardWith('p-c').Lanes.map((l) => l.PipelineID)).toEqual(['p-c']);
    });

    it('falls back to one pipeline when the filters leave only one', () => {
        const b = boardWith(ALL_PIPELINES, ['company-b']);
        expect(b.ShowingAll).toBe(false);
        expect(b.Lanes.map((l) => l.PipelineID)).toEqual(['p-b']);
    });

    it("keeps each lane's drop targets to its own pipeline", () => {
        const b = boardWith(ALL_PIPELINES);
        const [a, bLane] = b.Lanes;
        expect(b.ColumnIDsFor(a.PipelineID, a.Columns)).toEqual(['col-a1', 'col-a2']);
        expect(b.ColumnIDsFor(bLane.PipelineID, bLane.Columns)).toEqual(['col-b1']);
        // Same IDs, same array: CDK re-wires its drop lists when the reference changes.
        expect(b.ColumnIDsFor(a.PipelineID, b.Lanes[0].Columns)).toBe(b.ColumnIDsFor(a.PipelineID, a.Columns));
    });

    it('names the tab by company when pipelines are hidden', () => {
        const b = boardWith(ALL_PIPELINES);
        expect(b.AllLabel).toBe('All pipelines');
        Object.assign(b, { HidePipelines: true });
        expect(b.AllLabel).toBe('All companies');
    });
});
