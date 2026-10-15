// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';
import type { MJLeftNavItem } from '@memberjunction/ng-ui-components';

import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import type { DealDashboardSummary } from '../lib/workspace/deal-workspace.service';
import type { DealWorkspaceLookups } from '../lib/workspace/deal-workspace.types';
import {
    configureSection,
    initSectionTestEnvironment,
    stubService,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * THE TILES WAITED FOR READS THEY DO NOT USE (bizapps-sales#261).
 *
 * One spinner covered the whole section until every read had landed: the board's lookups, the win
 * rate and the grids' view included, although the tiles read only the roster and the summary. The
 * tiles now show when those two land; the win rate, the inspect grid, All Deals and the board each
 * show their own loading state until the rest arrives.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async () => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => ({ WhereClause: where ?? '' })),
    };
});

const SUMMARY: DealDashboardSummary = {
    OpenAmount: 1000,
    OpenCount: 2,
    TotalCount: 2,
    PastExpectedCloseCount: 0,
    WonCount: 0,
    WonAmount: 0,
    OpenPricedAmount: 0,
    OpenStatedAmount: 1000,
    OpenNoAmountCount: 0,
};

const ENTITIES = [
    { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal' },
] as unknown as EntityInfo[];

const LOOKUPS = { Pipelines: [], Stages: [], DealStatusTypes: [] } as unknown as DealWorkspaceLookups;

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
    service.LoadDashboardSummary.mockResolvedValue(SUMMARY);
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(ENTITIES);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

/** Mounts and waits only for the FIRST stage: the dashboard's figures. */
async function mountFiguresOnly(): Promise<ComponentFixture<MJSSalesSectionComponent>> {
    const fixture = TestBed.createComponent(MJSSalesSectionComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Loading).toBe(false));
    fixture.componentInstance.OnNav({ id: 'dashboard' } as MJLeftNavItem);
    fixture.detectChanges();
    return fixture;
}

function showPage(fixture: ComponentFixture<MJSSalesSectionComponent>, page: string): HTMLElement {
    fixture.componentInstance.OnNav({ id: page } as MJLeftNavItem);
    fixture.detectChanges();
    return visiblePage(fixture);
}

describe('while the lookups, win rate and view are still out', () => {
    it('shows the tiles, and a loading state on every surface that needs the rest', async () => {
        const lookups = held<DealWorkspaceLookups>();
        service.LoadLookups.mockReturnValue(lookups.promise);
        const fixture = await mountFiguresOnly();

        const dashboard = visiblePage(fixture);
        expect(dashboard.querySelector('.kpis')?.textContent).toContain('Open pipeline');
        expect(dashboard.querySelector('[data-testid="sales-winrate-count"]')?.textContent?.trim()).toBe('…');
        expect(dashboard.querySelector('.mjs-viewer-host mj-loading'), 'inspect grid').not.toBeNull();
        expect(showPage(fixture, 'list').querySelector('mj-loading'), 'All Deals').not.toBeNull();
        expect(showPage(fixture, 'board').querySelector('mj-loading'), 'board').not.toBeNull();

        lookups.release(LOOKUPS);
        await vi.waitFor(() => expect(fixture.componentInstance.DetailLoading).toBe(false));
        expect(showPage(fixture, 'board').querySelector('mj-loading')).toBeNull();
        const settled = showPage(fixture, 'dashboard');
        expect(settled.querySelector('[data-testid="sales-winrate-count"]')?.textContent?.trim()).not.toBe('…');
        expect(settled.querySelector('.mjs-viewer-host mj-loading')).toBeNull();
    });

    it('replaces the tiles with the Retry state when one of them then fails', async () => {
        const lookups = held<DealWorkspaceLookups>();
        service.LoadLookups.mockReturnValue(lookups.promise.then(() => Promise.reject(new Error('Received status code 504'))));
        const fixture = await mountFiguresOnly();
        expect(visiblePage(fixture).querySelector('.kpis')).not.toBeNull();

        lookups.release(LOOKUPS);
        await vi.waitFor(() => expect(fixture.componentInstance.LoadError).toContain('504'));
        fixture.detectChanges();

        const page = visiblePage(fixture);
        expect(page.querySelector('[data-testid="sales-load-failed"]')).not.toBeNull();
        expect(page.querySelector('.kpis')).toBeNull();
        expect(page.querySelector('mj-loading')).toBeNull();
    });

    it("does not overwrite a period's win rate picked meanwhile with the load's own", async () => {
        const firstWinRate = held<Record<string, unknown>[]>();
        service.RunNamedQuery.mockReturnValueOnce(firstWinRate.promise).mockResolvedValue([
            { ClosedCount: 4, WonCount: 3, WonAmount: 300, LostAmount: 100 },
        ]);
        const fixture = await mountFiguresOnly();

        await fixture.componentInstance.SetPeriod('alltime');
        firstWinRate.release([{ ClosedCount: 10, WonCount: 1, WonAmount: 10, LostAmount: 90 }]);
        await vi.waitFor(() => expect(fixture.componentInstance.DetailLoading).toBe(false));

        expect(fixture.componentInstance.WinWonCount).toBe(3);
        expect(fixture.componentInstance.WinClosedCount).toBe(4);
    });
});
