// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';

import { DealBoardComponent } from '../lib/board/deal-board.component';
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

type BoardElement = HTMLElement & { SelectedPipelineID?: string | null; SelectedCompanyID?: string | null };

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
        section.BoardCompanyID = 'company-2';
        section.BoardPipelineID = 'pipeline-2';
        const before = board(fixture);

        await section.Refresh();

        const after = board(fixture);
        expect(after, 'the board is back').not.toBeNull();
        expect(after, 'a full refresh rebuilds it').not.toBe(before);
        expect(after?.SelectedPipelineID).toBe('pipeline-2');
        expect(after?.SelectedCompanyID).toBe('company-2');
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

describe('the board reports a choice to the section', () => {
    /** Built with `Object.create`: the subject is two methods and their emitters, not the template. */
    function boardWith(pipelines: Array<{ ID: string; CompanyID: string }>) {
        const b = Object.create(DealBoardComponent.prototype) as DealBoardComponent;
        Object.assign(b, {
            Pipelines: pipelines,
            Stages: [],
            SelectedPipelineID: null,
            SelectedCompanyID: null,
            SelectedPipelineIDChange: { emit: vi.fn() },
            SelectedCompanyIDChange: { emit: vi.fn() },
            cdr: { detectChanges: vi.fn() },
        });
        return b;
    }

    it('emits the pipeline a rep picks', () => {
        const b = boardWith([]);
        b.SelectPipeline('pipeline-2');
        expect(b.SelectedPipelineIDChange.emit).toHaveBeenCalledWith('pipeline-2');
    });

    it('emits the company, and clears a pipeline that belongs to another company', () => {
        const b = boardWith([
            { ID: 'pipeline-1', CompanyID: 'company-1' },
            { ID: 'pipeline-2', CompanyID: 'company-2' },
        ]);
        b.SelectedPipelineID = 'pipeline-1';
        b.SelectCompany('company-2');
        expect(b.SelectedCompanyIDChange.emit).toHaveBeenCalledWith('company-2');
        expect(b.SelectedPipelineIDChange.emit).toHaveBeenCalledWith(null);
    });
});
