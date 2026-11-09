// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';
import type { MJLeftNavItem } from '@memberjunction/ng-ui-components';

import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';
import { configureSection, initSectionTestEnvironment, stubService, visiblePage, type StubService } from './helpers/sales-section-mount';

/**
 * THE BOARD WAITED FOR READS IT DOES NOT DRAW, WITH NO LIMIT (bc-aidp-next-golive#414).
 *
 * The board stayed on its spinner until every read in the section had landed: the win rate, every open
 * deal's stage history and both grids' view included. None of them had a time limit, so one slow or
 * unanswered read left the board loading until a browser refresh. The board now draws once the roster,
 * pipelines and stages land, the idle badges fill in when the stage history follows, and the board's
 * own reads get 30 seconds before it shows a Retry.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async () => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => ({ WhereClause: where ?? '' })),
    };
});

const ENTITIES = [
    { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal', BaseView: 'vwDeals' },
] as unknown as EntityInfo[];

const DEAL = { ID: 'deal-1', Name: 'Placeholder deal', PipelineStageID: 'stage-1' } as unknown as DealRosterRow;

/** A promise the test settles by hand. */
function held<T>(): { promise: Promise<T>; release: (value: T) => void } {
    let release: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => (release = resolve));
    return { promise, release };
}

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(ENTITIES);
    configureSection(service);
});

afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

function mount(): ComponentFixture<MJSSalesSectionComponent> {
    const fixture = TestBed.createComponent(MJSSalesSectionComponent);
    fixture.detectChanges();
    return fixture;
}

function boardPage(fixture: ComponentFixture<MJSSalesSectionComponent>): HTMLElement {
    fixture.componentInstance.OnNav({ id: 'board' } as MJLeftNavItem);
    fixture.detectChanges();
    return visiblePage(fixture);
}

describe('while the win rate, stage history and grids are still out', () => {
    it('draws the board, then fills in the idle days when the stage history lands', async () => {
        const entries = held<Map<string, string>>();
        const winRate = held<Record<string, unknown>[]>();
        service.LoadRoster.mockResolvedValue([DEAL]);
        service.LoadStageEntries.mockReturnValue(entries.promise);
        service.LoadWinRate.mockReturnValue(winRate.promise);
        const fixture = mount();

        await vi.waitFor(() => expect(fixture.componentInstance.BoardLoading).toBe(false));
        expect(fixture.componentInstance.DetailLoading, 'the other reads are still out').toBe(true);
        const page = boardPage(fixture);
        expect(page.querySelector('mj-loading')).toBeNull();
        const board = page.querySelector('mjs-deal-board');
        expect(board).not.toBeNull();
        expect(fixture.componentInstance.StageEnteredOn.size).toBe(0);

        entries.release(new Map([['deal-1', '2026-01-05']]));
        winRate.release([]);
        await vi.waitFor(() => expect(fixture.componentInstance.DetailLoading).toBe(false));
        expect(fixture.componentInstance.StageEnteredOn.get('deal-1')).toBe('2026-01-05');
        expect(boardPage(fixture).querySelector('mjs-deal-board'), 'the same board, not a redraw behind a spinner').toBe(board);
    });

    it('keeps the board on its spinner until the pipelines and stages land', async () => {
        const lookups = held<{ Pipelines: never[]; Stages: never[]; DealStatusTypes: never[] }>();
        service.LoadLookups.mockReturnValue(lookups.promise);
        const fixture = mount();

        await vi.waitFor(() => expect(fixture.componentInstance.Loading).toBe(false));
        expect(boardPage(fixture).querySelector('mj-loading')).not.toBeNull();

        lookups.release({ Pipelines: [], Stages: [], DealStatusTypes: [] });
        await vi.waitFor(() => expect(fixture.componentInstance.BoardLoading).toBe(false));
        expect(boardPage(fixture).querySelector('mjs-deal-board')).not.toBeNull();
    });
});

describe("a board read that doesn't answer", () => {
    it('shows a Retry after 30 seconds, and ignores the reply when it finally arrives', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const roster = held<DealRosterRow[]>();
        service.LoadRoster.mockReturnValue(roster.promise);
        const fixture = mount();

        await vi.advanceTimersByTimeAsync(29_000);
        expect(fixture.componentInstance.LoadError).toBeNull();
        expect(boardPage(fixture).querySelector('mj-loading')).not.toBeNull();

        await vi.advanceTimersByTimeAsync(1_000);
        expect(fixture.componentInstance.LoadError).toContain('longer than 30 seconds');
        const page = boardPage(fixture);
        expect(page.querySelector('mj-loading')).toBeNull();
        expect(page.querySelector('[data-testid="sales-load-failed"]')).not.toBeNull();

        roster.release([DEAL]);
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.componentInstance.Deals, 'a late reply does not land under the error').toEqual([]);
        expect(fixture.componentInstance.LoadError).toContain('longer than 30 seconds');
    });

    it('loads the board on Retry once the reads answer', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        service.LoadRoster.mockReturnValueOnce(held<DealRosterRow[]>().promise).mockResolvedValue([DEAL]);
        const fixture = mount();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(fixture.componentInstance.LoadError).not.toBeNull();

        await fixture.componentInstance.Refresh();
        expect(fixture.componentInstance.LoadError).toBeNull();
        expect(fixture.componentInstance.Deals).toEqual([DEAL]);
        expect(boardPage(fixture).querySelector('mjs-deal-board')).not.toBeNull();
    });
});

describe("a quiet re-read that doesn't answer", () => {
    it('keeps the board up past 30 seconds, and takes the reply when it finally arrives', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const later = { ...DEAL, ID: 'deal-2' } as DealRosterRow;
        const roster = held<DealRosterRow[]>();
        service.LoadRoster.mockResolvedValueOnce([DEAL]).mockReturnValueOnce(roster.promise);
        const fixture = mount();
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.componentInstance.Deals).toEqual([DEAL]);

        void fixture.componentInstance.Refresh(true);
        await vi.advanceTimersByTimeAsync(31_000);
        expect(fixture.componentInstance.LoadError, 'a save-driven re-read does not blank the board').toBeNull();
        const page = boardPage(fixture);
        expect(page.querySelector('[data-testid="sales-load-failed"]')).toBeNull();
        expect(page.querySelector('mjs-deal-board')).not.toBeNull();

        roster.release([DEAL, later]);
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.componentInstance.Deals, 'the late reply lands').toEqual([DEAL, later]);
        expect(fixture.componentInstance.LoadError).toBeNull();
    });
});
