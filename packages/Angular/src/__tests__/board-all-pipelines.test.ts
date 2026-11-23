import '@angular/compiler';
import { describe, expect, it } from 'vitest';

import { ALL_PIPELINES, DealBoardComponent } from '../lib/board/deal-board.component';
import type { PipelineLookup, StageLookup } from '../lib/workspace/deal-workspace.types';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

/**
 * The All tab showed one lane per pipeline, so selecting every company still gave a board per company.
 * It now shows one board: each company's pipeline is a copy of the default, so stages with the same code
 * share a column, and a move lands on the stage of the card's own pipeline.
 */

const P = (ID: string, CompanyID: string, DisplayRank: number): PipelineLookup => ({
    ID, Name: ID, Code: ID, CompanyID, CompanyName: CompanyID, IsDefault: false, DisplayRank,
});
const S = (ID: string, PipelineID: string, DisplayOrder: number, Code: string | null): StageLookup => ({
    ID, Name: ID, Code, PipelineID, DisplayOrder, Probability: null, ForecastCategoryTypeID: null, DealStatusTypeID: null, RottingDays: null,
});
const D = (ID: string, PipelineID: string, PipelineStageID: string | null): DealRosterRow =>
    ({ ID, Name: ID, PipelineID, PipelineStageID, Amount: 0, CurrencyCode: 'USD', IsOpen: true, AmountIsComputed: false }) as DealRosterRow;

const PIPELINES = [P('p-a', 'company-a', 1), P('p-b', 'company-b', 2), P('p-c', 'company-c', 3)];
// p-a and p-b are copies: same codes (one in another case). p-c has a stage of its own and one with no code.
const STAGES = [
    S('a1', 'p-a', 1, 'QUALIFY'), S('a2', 'p-a', 2, 'PROPOSE'),
    S('b1', 'p-b', 1, 'qualify'), S('b2', 'p-b', 2, 'PROPOSE'),
    S('c1', 'p-c', 1, 'QUALIFY'), S('c3', 'p-c', 3, null),
];
const DEALS = [D('d1', 'p-a', 'a2'), D('d2', 'p-b', 'b1'), D('d3', 'p-b', null), D('d4', 'p-c', 'c3')];

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
        PendingMove: new Map(),
        columnIDCache: new Map(),
    });
    return b;
}

describe('the Board All tab', () => {
    it('shows one board, with stages that share a code in one column', () => {
        const lanes = boardWith(ALL_PIPELINES).Lanes;
        expect(lanes).toHaveLength(1);
        const [board] = lanes;
        expect(board.Columns.map((c) => c.StageIDs)).toEqual([['a1', 'b1', 'c1'], ['a2', 'b2'], ['c3']]);
        expect(board.Columns.map((c) => c.Cards.map((d) => d.ID))).toEqual([['d2'], ['d1'], ['d4']]);
        expect(board.Unstaged.map((d) => d.ID)).toEqual(['d3']);
    });

    it('shows a single pipeline when a pipeline tab is chosen', () => {
        const [lane] = boardWith('p-c').Lanes;
        expect(lane.PipelineID).toBe('p-c');
        expect(lane.Columns.map((c) => c.StageIDs)).toEqual([['c1'], ['c3']]);
    });

    it('falls back to one pipeline when the filters leave only one', () => {
        const b = boardWith(ALL_PIPELINES, ['company-b']);
        expect(b.ShowingAll).toBe(false);
        expect(b.Lanes.map((l) => l.PipelineID)).toEqual(['p-b']);
    });

    it("moves a card to the column's stage on its own pipeline", () => {
        const b = boardWith(ALL_PIPELINES);
        const [qualify, propose, own] = b.Lanes[0].Columns;
        const d2 = DEALS[1];
        expect(b.StageFor(propose, d2)).toBe('b2');
        expect(b.StageFor(qualify, DEALS[0])).toBe('a1');
        // p-b has no stage in p-c's own column, so it is not offered.
        expect(b.StageFor(own, d2)).toBeNull();
        expect(b.MoveTargets(b.Lanes[0].Columns, d2).map((c) => c.StageID)).toEqual(['a2']);
    });

    it('names the tab by company when pipelines are hidden', () => {
        const b = boardWith(ALL_PIPELINES);
        expect(b.AllLabel).toBe('All pipelines');
        Object.assign(b, { HidePipelines: true });
        expect(b.AllLabel).toBe('All companies');
    });
});
