// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';

import { BoardPipelines, DealBoardComponent } from '../lib/board/deal-board.component';
import type { MJLeftNavItem } from '@memberjunction/ng-ui-components';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection as mount,
    stubService,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * A DRAG ON THE SECOND PIPELINE RELOADED THE BOARD ONTO THE FIRST.
 *
 * The board held the selected company and pipeline itself, and the section rebuilt the board on every
 * reload, so a successful drag on any pipeline but the first showed the first one afterwards. The
 * section now owns the choice, and a drag re-reads without the spinner so the board stays mounted.
 *
 * The board is an unknown element in this mount, so its bound inputs land as DOM properties and the
 * test can read them off the element.
 */

type BoardElement = HTMLElement & {
    SelectedPipelineID?: string | null;
    Deals?: DealRosterRow[];
    CompanyIDs?: readonly string[];
    PipelineIDs?: readonly string[];
};

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

function board(fixture: Awaited<ReturnType<typeof mount>>): BoardElement | null {
    return visiblePage(fixture).querySelector('mjs-deal-board') as BoardElement | null;
}

describe('the board selection, owned by the section', () => {
    it('survives the header Refresh, which rebuilds the board', async () => {
        const fixture = await mount('board');
        const section = fixture.componentInstance;
        section.BoardPipelineID = 'pipeline-2';
        const before = board(fixture);

        await section.Refresh();

        const after = board(fixture);
        expect(after, 'the board is back').not.toBeNull();
        expect(after, 'a full refresh rebuilds it').not.toBe(before);
        expect(after?.SelectedPipelineID).toBe('pipeline-2');
    });

    it('re-reads quietly after a drag, keeping the same board and no spinner', async () => {
        const fixture = await mount('board');
        const section = fixture.componentInstance;
        section.BoardPipelineID = 'pipeline-2';
        const before = board(fixture);

        let release: (rows: DealRosterRow[]) => void = () => undefined;
        service.LoadRoster.mockReturnValueOnce(new Promise<DealRosterRow[]>((r) => (release = r)));
        const pending = section.Refresh(true);

        expect(visiblePage(fixture).querySelector('mj-loading'), 'no spinner while it re-reads').toBeNull();
        expect(board(fixture), 'the board stays mounted').toBe(before);

        release([]);
        await pending;
        expect(board(fixture)).toBe(before);
        expect(board(fixture)?.SelectedPipelineID).toBe('pipeline-2');
        expect(service.LoadRoster).toHaveBeenCalledTimes(2);
    });
});

describe('the filter bar carries over between the Dashboard and the Board (bc-aidp-next-golive#351)', () => {
    const row = (id: string): DealRosterRow => ({ ID: id }) as DealRosterRow;

    it('gives the Board the filters picked on the Dashboard, and the deals read with them', async () => {
        const fixture = await mount('dashboard');
        const section = fixture.componentInstance;
        service.LoadRoster.mockResolvedValue([row('deal-acme')]);

        section.ToggleFilter('CompanyIDs', 'company-2');
        section.ToggleFilter('PipelineIDs', 'pipeline-2');
        await vi.waitFor(() => expect(section.PeriodLoading).toBe(false));
        section.OnNav({ id: 'board' } as MJLeftNavItem);
        fixture.detectChanges();

        const b = board(fixture);
        expect(b?.CompanyIDs).toEqual(['company-2']);
        expect(b?.PipelineIDs).toEqual(['pipeline-2']);
        expect(b?.Deals?.map((d) => d.ID)).toEqual(['deal-acme']);
    });

    it('keeps a filter picked on the Board when moving back to the Dashboard', async () => {
        const fixture = await mount('board');
        const section = fixture.componentInstance;
        section.ToggleFilter('OwnerEmployeeIDs', 'E1');
        section.OnNav({ id: 'dashboard' } as MJLeftNavItem);

        expect(section.Filters.OwnerEmployeeIDs).toEqual(['E1']);
        expect(section.CurrentUrlState.Owners).toEqual(['E1']);
        expect(section.CurrentUrlState.Page).toBeNull();
    });

    it('mounts one filter bar, on the page that shows it', async () => {
        const fixture = await mount('board');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('mjs-sales-filter-bar')).toHaveLength(1);
        expect(visiblePage(fixture).querySelector('mjs-sales-filter-bar')).not.toBeNull();

        fixture.componentInstance.OnNav({ id: 'list' } as MJLeftNavItem);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('mjs-sales-filter-bar'), 'All deals keeps its grid filters').toHaveLength(0);
    });
});

describe('the Board tabs (bc-aidp-next-golive#351)', () => {
    const P = (ID: string, CompanyID: string, IsDefault = false) => ({
        ID, Name: ID, Code: ID, CompanyID, CompanyName: CompanyID, IsDefault, DisplayRank: 0,
    });
    const PIPELINES = [P('p-b1', 'company-b'), P('p-a1', 'company-a', true), P('p-a2', 'company-a')];

    it('offers every pipeline with no filter, default company first', () => {
        expect(BoardPipelines(PIPELINES, [], []).map((p) => p.ID)).toEqual(['p-a1', 'p-a2', 'p-b1']);
    });

    it("offers the selling companies' pipelines, or the picked pipelines", () => {
        expect(BoardPipelines(PIPELINES, ['company-b'], []).map((p) => p.ID)).toEqual(['p-b1']);
        expect(BoardPipelines(PIPELINES, [], ['P-B1', 'p-a2']).map((p) => p.ID)).toEqual(['p-a2', 'p-b1']);
        expect(BoardPipelines(PIPELINES, ['company-a'], ['p-b1'])).toEqual([]);
    });

    function boardWith(selected: string | null, companyIDs: string[], pipelineIDs: string[]) {
        const b = Object.create(DealBoardComponent.prototype) as DealBoardComponent;
        Object.assign(b, {
            Pipelines: PIPELINES,
            Stages: [{ ID: 's1', PipelineID: 'p-a2' }, { ID: 's2', PipelineID: 'p-b1' }],
            CompanyIDs: companyIDs,
            PipelineIDs: pipelineIDs,
            SelectedPipelineID: selected,
        });
        return b;
    }

    it('shows the chosen tab while the filters allow it, else the first tab with stages', () => {
        expect(boardWith('p-b1', [], []).ActivePipelineID).toBe('p-b1');
        expect(boardWith('p-b1', ['company-a'], []).ActivePipelineID, 'ruled out by the company filter').toBe('p-a2');
        expect(boardWith(null, [], ['p-b1']).ActivePipelineID).toBe('p-b1');
    });

    it('names the company on a tab only when the tabs span companies', () => {
        expect(boardWith(null, [], []).TabLabel(PIPELINES[0])).toBe('p-b1 (company-b)');
        expect(boardWith(null, ['company-a'], []).TabLabel(PIPELINES[1])).toBe('p-a1');
    });
});

describe('the board reports a choice to the section', () => {
    it('emits the pipeline a rep picks', () => {
        const b = Object.create(DealBoardComponent.prototype) as DealBoardComponent;
        Object.assign(b, { SelectedPipelineIDChange: { emit: vi.fn() }, cdr: { detectChanges: vi.fn() } });
        b.SelectPipeline('pipeline-2');
        expect(b.SelectedPipelineIDChange.emit).toHaveBeenCalledWith('pipeline-2');
    });
});
