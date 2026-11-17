// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';

import { DealFiltersWhere, LoadDealPipelineViewTemplate, DealPipelineGridState } from '../lib/pages/deal-views';
import { NO_FILTERS } from '../lib/pages/dashboard-filters';
import { SalesSettings } from '../lib/data/sales-settings';
import { MJSSalesFilterBarComponent, type SalesFilterBarState } from '../lib/sections/sales-filter-bar.component';
import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection,
    stubService,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * ALL DEALS COULD NOT BE FILTERED (bc-aidp-next-golive#453).
 *
 * The filter bar was mounted on the Dashboard and the Board only, and All Deals showed the saved view
 * with no filter. All Deals now shows the bar's lists, without the period (All Deals lists every
 * deal), and every filter change re-derives the grid's filter from the section's selection.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return { ...actual, LoadDealPipelineViewTemplate: vi.fn() };
});

const grid = DealPipelineGridState();
const TEMPLATE = {
    Name: 'Sales: Pipeline', WhereClause: '', GridState: JSON.stringify(grid), GridStateObject: grid,
} as unknown as MJUserViewEntityExtended;

const ENTITIES = [
    { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal', BaseView: 'vwDeals' },
    { ID: 'line-entity', Name: 'MJ_BizApps_Orders: Order Lines', SchemaName: '__mj_BizAppsOrders', BaseTable: 'OrderLine', BaseView: 'vwOrderLines' },
] as unknown as EntityInfo[];

type BarElement = HTMLElement & { State?: SalesFilterBarState };

let service: StubService;

beforeAll(initSectionTestEnvironment);

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

describe('All Deals and the filter bar', () => {
    beforeEach(() => {
        service = stubService();
        vi.mocked(LoadDealPipelineViewTemplate).mockReset().mockResolvedValue(TEMPLATE);
        vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(ENTITIES);
        vi.spyOn(SalesSettings, 'LoadHidePipelines').mockResolvedValue(false);
        configureSection(service);
    });

    async function mountList() {
        const fixture = await mountSection('list');
        fixture.detectChanges();
        return fixture;
    }

    it('shows the bar, without the period', async () => {
        const fixture = await mountList();
        const bar = visiblePage(fixture).querySelector('mjs-sales-filter-bar') as BarElement | null;

        expect(bar, 'All Deals mounts the bar').not.toBeNull();
        expect(fixture.nativeElement.querySelectorAll('mjs-sales-filter-bar'), 'one copy in the page').toHaveLength(1);
        expect(bar?.State?.HidePeriod).toBe(true);
        expect(bar?.State?.NoLinesLeftOut, "the summary's no-lines count is the period's").toBe(0);
    });

    it('keeps the period on the Dashboard', async () => {
        const fixture = await mountSection('dashboard');
        fixture.detectChanges();
        const bar = visiblePage(fixture).querySelector('mjs-sales-filter-bar') as BarElement | null;

        expect(bar?.State?.HidePeriod).toBe(false);
    });

    it('lists every deal with no filter set', async () => {
        const fixture = await mountList();

        expect(fixture.componentInstance.AllDealsView?.WhereClause).toBe('');
    });

    it('re-derives the grid filter on every filter change, and drops it when the last list is cleared', async () => {
        const fixture = await mountList();
        const section = fixture.componentInstance;
        const first = section.AllDealsView;

        section.ToggleFilter('CompanyIDs', 'company-1');
        await vi.waitFor(() => expect(section.AllDealsView?.WhereClause).toBe("CompanyID IN ('company-1')"));
        expect(section.AllDealsView, 'a new view, so the grid re-runs').not.toBe(first);

        section.ToggleFilter('OwnerEmployeeIDs', 'E1');
        await vi.waitFor(() => expect(section.AllDealsView?.WhereClause).toBe("CompanyID IN ('company-1') AND OwnerEmployeeID IN ('E1')"));

        section.ClearFilter('CompanyIDs');
        section.ClearFilter('OwnerEmployeeIDs');
        await vi.waitFor(() => expect(section.AllDealsView?.WhereClause).toBe(''));
    });

    it('takes filters from the URL', async () => {
        const fixture = await mountList();
        const section = fixture.componentInstance;

        section.UrlState = { ...section.CurrentUrlState, Owners: ['E2'] };
        await vi.waitFor(() => expect(section.AllDealsView?.WhereClause).toBe("OwnerEmployeeID IN ('E2')"));
    });

    it('is not re-derived by a period change', async () => {
        const fixture = await mountList();
        const section = fixture.componentInstance;
        const before = section.AllDealsView;

        await section.SetPeriod('year');

        expect(section.AllDealsView).toBe(before);
    });

    it('keeps the Pipeline column hidden while HidePipelines is on', async () => {
        vi.mocked(SalesSettings.LoadHidePipelines).mockResolvedValue(true);
        const fixture = await mountList();
        const section = fixture.componentInstance;

        section.ToggleFilter('CompanyIDs', 'company-1');
        await vi.waitFor(() => expect(section.AllDealsView?.WhereClause).toBe("CompanyID IN ('company-1')"));

        const columns = (JSON.parse(section.AllDealsView?.GridState ?? '{}') as ReturnType<typeof DealPipelineGridState>).columnSettings;
        expect(columns.find((c) => c.Name === 'Pipeline')?.hidden).toBe(true);
        const bar = visiblePage(fixture).querySelector('mjs-sales-filter-bar') as BarElement | null;
        fixture.detectChanges();
        expect(bar?.State?.HiddenKinds).toEqual(['PipelineIDs']);
    });
});

describe('DealFiltersWhere', () => {
    const LINES = { SchemaName: '__mj_BizAppsOrders', BaseView: 'vwOrderLines' };

    it('is empty with no list set', () => {
        expect(DealFiltersWhere(NO_FILTERS, LINES)).toBe('');
    });

    it('matches a product company through the order lines, and nothing without that table', () => {
        const filters = { ...NO_FILTERS, ProductCompanyIDs: ['company-9'] };

        expect(DealFiltersWhere(filters, LINES)).toBe(
            "OrderID IN (SELECT OrderHeaderID FROM [__mj_BizAppsOrders].[vwOrderLines] WHERE CompanyID IN ('company-9'))",
        );
        expect(DealFiltersWhere(filters, null)).toBe('1 = 0');
    });

    it('applies no period', () => {
        const filters = { ...NO_FILTERS, PipelineIDs: ["p'1"] };

        expect(DealFiltersWhere(filters, LINES)).toBe("PipelineID IN ('p''1')");
    });
});

describe('the filter bar with HidePeriod', () => {
    const BAR_HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'sections', 'sales-filter-bar.component.html'), 'utf8');

    function state(overrides: Partial<SalesFilterBarState>): SalesFilterBarState {
        return {
            Period: 'custom', CustomStart: '2026-01-01', CustomEnd: '2026-03-31', WindowLabel: 'Jan 1 – Mar 31',
            PeriodTooltip: '', Filters: NO_FILTERS,
            Options: { CompanyIDs: [], ProductCompanyIDs: [], PipelineIDs: [], OwnerEmployeeIDs: [] },
            MyEmployeeID: null, NoLinesLeftOut: 0, ...overrides,
        };
    }

    function render(barState: SalesFilterBarState): HTMLElement {
        TestBed.configureTestingModule({ imports: [MJSSalesFilterBarComponent] });
        TestBed.overrideComponent(MJSSalesFilterBarComponent, {
            set: { template: BAR_HTML, templateUrl: undefined, styleUrls: undefined, styles: [], imports: [CommonModule], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
        });
        const fixture = TestBed.createComponent(MJSSalesFilterBarComponent);
        fixture.componentRef.setInput('State', barState);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it('leaves out the period, its dates and the custom range, and keeps the lists', () => {
        const bar = render(state({ HidePeriod: true }));

        for (const id of ['sales-period', 'sales-period-window', 'sales-period-from', 'sales-period-to']) {
            expect(bar.querySelector(`[data-testid="${id}"]`), id).toBeNull();
        }
        expect(bar.querySelector('[data-testid="sales-filter-company"]')).not.toBeNull();
        expect(bar.querySelector('[data-testid="sales-filter-owner"]')).not.toBeNull();
    });

    it('shows the period without it', () => {
        const bar = render(state({}));

        expect(bar.querySelector('[data-testid="sales-period"]')).not.toBeNull();
        expect(bar.querySelector('[data-testid="sales-period-from"]')).not.toBeNull();
    });
});
