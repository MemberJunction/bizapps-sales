// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import { DealBoardComponent, StageIdleFor } from '../lib/board/deal-board.component';
import { DealWorkspaceService, type DealRosterRow } from '../lib/workspace/deal-workspace.service';
import type { StageLookup } from '../lib/workspace/deal-workspace.types';

/**
 * THE BOARD MOVES A CARD AT ONCE, AND BY KEYBOARD TOO (bizapps-sales#371), AND FLAGS IDLE DEALS (#450).
 *
 * A dropped card stayed in its old column for the whole save and then jumped. It now moves before the
 * save goes out, and goes back with the reason when the save fails. "Move to stage" takes the same path.
 */

const STAGES: StageLookup[] = [
    { ID: 'S1', Name: 'Qualify', PipelineID: 'P', DisplayOrder: 1, Probability: 10, ForecastCategoryTypeID: null, DealStatusTypeID: null, RottingDays: 14 },
    { ID: 'S2', Name: 'Propose', PipelineID: 'P', DisplayOrder: 2, Probability: 50, ForecastCategoryTypeID: null, DealStatusTypeID: null, RottingDays: null },
];

function deal(): DealRosterRow {
    return { ID: 'D1', Name: 'Pilot', PipelineID: 'P', PipelineStageID: 'S1', PipelineStage: 'Qualify', IsOpen: true } as DealRosterRow;
}

let service: { LoadDeal: ReturnType<typeof vi.fn>; Save: ReturnType<typeof vi.fn> };

beforeAll(() => TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()));

beforeEach(() => {
    service = { LoadDeal: vi.fn(), Save: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: DealWorkspaceService, useValue: service }] });
    TestBed.overrideComponent(DealBoardComponent, { set: { template: '', templateUrl: undefined, styleUrls: undefined, styles: [] } });
});

afterEach(() => TestBed.resetTestingModule());

function mount(row: DealRosterRow): DealBoardComponent {
    const board = TestBed.createComponent(DealBoardComponent).componentInstance;
    board.Deals = [row];
    board.Stages = STAGES;
    board.Pipelines = [{ ID: 'P', Name: 'Main', Code: '', CompanyID: 'C', CompanyName: null, IsDefault: true, DisplayRank: 0 }];
    return board;
}

describe('a move', () => {
    it('shows the card in the target column while the save is out, then reports the move', async () => {
        const row = deal();
        const board = mount(row);
        let finish: (v: { Success: boolean }) => void = () => undefined;
        service.LoadDeal.mockResolvedValue({ PipelineStageID: 'S1' });
        service.Save.mockReturnValue(new Promise((r) => (finish = r)));
        const moved = vi.fn();
        board.StageMoved.subscribe(moved);

        board.PendingMove.set('D1', 'S2');
        const pending = board.MoveToPicked(row);
        await vi.waitFor(() => expect(service.Save).toHaveBeenCalled());
        expect(board.Columns.find((c) => c.StageID === 'S2')?.Cards).toContain(row);

        finish({ Success: true });
        await pending;
        expect(moved).toHaveBeenCalledTimes(1);
        expect(board.Message).toBeNull();
    });

    it('puts the card back with the reason when the save fails', async () => {
        const row = deal();
        const board = mount(row);
        service.LoadDeal.mockResolvedValue({ PipelineStageID: 'S1' });
        service.Save.mockResolvedValue({ Success: false, ErrorMessage: 'Stage needs an amount' });

        board.PendingMove.set('D1', 'S2');
        await board.MoveToPicked(row);

        expect(row.PipelineStageID).toBe('S1');
        expect(board.Columns.find((c) => c.StageID === 'S1')?.Cards).toContain(row);
        expect(board.Message).toBe('Stage needs an amount');
    });

    it('offers every open column but the card\'s own', () => {
        const row = deal();
        const board = mount(row);
        expect(board.MoveTargets(board.Columns, row).map((c) => c.StageID)).toEqual(['S2']);
    });

    it('offers nothing on a card in a closing column', () => {
        const row = { ...deal(), PipelineStageID: 'S3', PipelineStage: 'Signed', IsOpen: false } as DealRosterRow;
        const board = mount(row);
        board.Stages = [...STAGES, { ID: 'S3', Name: 'Signed', PipelineID: 'P', DisplayOrder: 3, Probability: 100, ForecastCategoryTypeID: null, DealStatusTypeID: 'WON', RottingDays: null }];
        board.DealStatusTypes = [{ ID: 'WON', LocksDeal: true } as (typeof board.DealStatusTypes)[number]];
        expect(board.MoveTargets(board.Columns, row)).toEqual([]);
    });

    it('offers nothing on a closed deal that sits in an ordinary column', () => {
        const row = { ...deal(), IsOpen: false } as DealRosterRow;
        const board = mount(row);
        expect(board.MoveTargets(board.Columns, row)).toEqual([]);
    });
});

describe('the idle flag', () => {
    it('flags an open deal past its stage limit, and not on the limit day', () => {
        expect(StageIdleFor({ IsOpen: true }, 14, '2026-08-01', '2026-08-15')).toBeNull();
        expect(StageIdleFor({ IsOpen: true }, 14, '2026-08-01', '2026-08-16')).toMatchObject({ Days: 15, Limit: 14 });
    });

    it('does not flag a closed deal, a stage with no limit, or an unknown entry day', () => {
        expect(StageIdleFor({ IsOpen: false }, 14, '2026-01-01', '2026-08-16')).toBeNull();
        expect(StageIdleFor({ IsOpen: true }, null, '2026-01-01', '2026-08-16')).toBeNull();
        expect(StageIdleFor({ IsOpen: true }, 14, undefined, '2026-08-16')).toBeNull();
    });
});
