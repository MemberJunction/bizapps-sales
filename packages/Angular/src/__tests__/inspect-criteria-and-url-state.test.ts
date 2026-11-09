import { describe, expect, it } from 'vitest';

import { DayLabel } from '../lib/pages/dashboard-dates';
import { FilterInspect, InspectDateBounds } from '../lib/pages/dashboard-inspect';
import { DealPipelineGridState, InspectCriteriaWhere, type CriteriaInspectKey } from '../lib/pages/deal-views';
import { DescribeFiscalBasis, CALENDAR_YEAR_START } from '../lib/pages/dashboard-period';
import { ParseSalesUrlState, SalesUrlParams, SameSalesUrlState, DEFAULT_SALES_URL_STATE } from '../lib/sections/sales-url-state';
import { StageEntryDays } from '../lib/workspace/deal-workspace.service';

const TABLES = {
    Status: { SchemaName: 's', BaseView: 'vwDealStatusTypes' },
    Pipeline: { SchemaName: 's', BaseView: 'vwPipelines' },
    Forecast: { SchemaName: 's', BaseView: 'vwForecastCategoryTypes' },
};
const OPEN_IN_FORECAST =
    'DealStatusTypeID IN (SELECT ID FROM [s].[vwDealStatusTypes] WHERE IsOpen = 1)'
    + ' AND PipelineID IN (SELECT ID FROM [s].[vwPipelines] WHERE IncludeInForecast = 1)';

/**
 * INSPECT FILTERS BY CRITERIA, NOT BY A LIST OF IDS (bizapps-sales#449).
 *
 * The filter's length used to grow with the book. Each slice is now its own criteria; these pin the SQL
 * for each and that it is the same length whatever the book holds.
 */
describe('InspectCriteriaWhere', () => {
    const today = '2026-08-15';
    const PIPE = '(ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInPipeline = 0))';

    it('limits every open slice to open deals in forecast pipelines, by flag', () => {
        expect(InspectCriteriaWhere('pipe', TABLES, today)).toBe(`${OPEN_IN_FORECAST} AND ${PIPE}`);
    });

    it.each<[CriteriaInspectKey, string]>([
        ['closing', "ExpectedCloseDate >= '2026-08-15' AND ExpectedCloseDate <= '2026-09-14'"],
        ['commit', `${PIPE} AND ForecastCategoryTypeID IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInCommit = 1)`],
        ['best', `${PIPE} AND (ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInCommit = 1)) AND ForecastCategoryTypeID IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInBestCase = 1)`],
        ['weighted', PIPE],
        ['remainder', '(ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInPipeline = 0 OR IncludeInCommit = 1 OR IncludeInBestCase = 1))'],
        ['slipped', "ExpectedCloseDate IS NOT NULL AND ExpectedCloseDate < '2026-08-15'"],
        ['noowner', 'OwnerEmployeeID IS NULL'],
        ['nodate', 'ExpectedCloseDate IS NULL'],
        ['week', "ExpectedCloseDate >= '2026-08-15' AND ExpectedCloseDate <= '2026-08-22'"],
        ['month', "ExpectedCloseDate > '2026-08-22' AND ExpectedCloseDate <= '2026-08-31'"],
        ['later', "ExpectedCloseDate > '2026-08-31'"],
    ])('%s', (key, extra) => {
        expect(InspectCriteriaWhere(key, TABLES, today)).toBe(`${OPEN_IN_FORECAST} AND ${extra}`);
    });

    it('splits the date buckets where the roster filter does, near month end too', () => {
        expect(InspectDateBounds('2026-08-28')).toEqual({ WeekEnd: '2026-09-04', MonthEnd: '2026-08-31', LaterFrom: '2026-09-04', ClosingEnd: '2026-09-27' });
        // FilterInspect reads the same bounds: a deal on the week's last day is in "week", not "later".
        const deal = { IsOpen: true, ExpectedCloseDate: '2026-09-04' } as Parameters<typeof FilterInspect>[0][number];
        expect(FilterInspect([deal], 'week', '2026-08-28')).toHaveLength(1);
        expect(FilterInspect([deal], 'later', '2026-08-28')).toHaveLength(0);
    });
});

/**
 * THE PERIOD AND THE FILTER BAR REACH THE GRID (bc-aidp-next-golive#350). Each tile's list is narrowed
 * by the same rule its query applied, so the list holds the deals the tile counted.
 */
describe('InspectCriteriaWhere with a period and filters', () => {
    const today = '2026-08-15';
    const Q3 = { Key: 'quarter' as const, Label: 'This quarter', Start: '2026-07-01', End: '2026-09-30' };
    const TABLES_WITH_LINES = { ...TABLES, OrderLine: { SchemaName: 'o', BaseView: 'vwOrderLines' } };

    it('bounds an open slice on the expected close date', () => {
        expect(InspectCriteriaWhere('pipe', TABLES, today, { Window: Q3 }))
            .toContain("ExpectedCloseDate >= '2026-07-01' AND ExpectedCloseDate <= '2026-09-30'");
    });

    it('bounds Won and the win rate on the day the deal closed, inclusive of the last day', () => {
        expect(InspectCriteriaWhere('won', TABLES, today, { Window: Q3 })).toBe(
            "DealStatusTypeID IN (SELECT ID FROM [s].[vwDealStatusTypes] WHERE IsWon = 1) AND ActualCloseDate >= '2026-07-01' AND ActualCloseDate <= '2026-09-30'",
        );
        expect(InspectCriteriaWhere('closed', TABLES, today, { Window: Q3 }))
            .toMatch(/^DealStatusTypeID IN \(SELECT ID FROM \[s\]\.\[vwDealStatusTypes\] WHERE IsClosed = 1\) AND ActualCloseDate >= /);
    });

    it('leaves the attention slices and the default list unbounded by the period', () => {
        for (const key of ['slipped', 'noowner', 'nodate', 'closing'] as const) {
            expect(InspectCriteriaWhere(key, TABLES, today, { Window: Q3 })).toBe(InspectCriteriaWhere(key, TABLES, today));
        }
    });

    it('narrows every slice by the filter bar, and a named pipeline replaces the forecast rule', () => {
        const where = InspectCriteriaWhere('commit', TABLES_WITH_LINES, today, {
            Filters: { CompanyIDs: ['C1', 'C2'], OwnerEmployeeIDs: ['E1'], PipelineIDs: ['P1'], ProductCompanyIDs: ['PC1'] },
        });
        expect(where).toContain("CompanyID IN ('C1', 'C2')");
        expect(where).toContain("OwnerEmployeeID IN ('E1')");
        expect(where).toContain("PipelineID IN ('P1')");
        expect(where).toContain("OrderID IN (SELECT OrderHeaderID FROM [o].[vwOrderLines] WHERE CompanyID IN ('PC1'))");
        expect(where).not.toContain('IncludeInForecast');
    });

    it('matches nothing for a product company when the order-line table is unknown, rather than ignoring it', () => {
        expect(InspectCriteriaWhere('pipe', TABLES, today, { Filters: { CompanyIDs: [], OwnerEmployeeIDs: [], PipelineIDs: [], ProductCompanyIDs: ['PC1'] } }))
            .toContain('1 = 0');
    });

    it('lists a stage column, an unstaged column and an owner row by their argument', () => {
        expect(InspectCriteriaWhere('stage', TABLES, today, { Arg: 's1' })).toContain("PipelineStageID = 's1'");
        expect(InspectCriteriaWhere('stage', TABLES, today, { Arg: 'unstaged:P1' })).toContain("PipelineStageID IS NULL AND PipelineID = 'P1'");
        expect(InspectCriteriaWhere('owner', TABLES, today, { Arg: 'E1' })).toContain("OwnerEmployeeID = 'E1'");
        expect(InspectCriteriaWhere('owner', TABLES, today, { Arg: 'none' })).toContain('OwnerEmployeeID IS NULL');
    });

    it('escapes a quote in an ID', () => {
        expect(InspectCriteriaWhere('pipe', TABLES, today, { Filters: { CompanyIDs: ["x'y"], OwnerEmployeeIDs: [], PipelineIDs: [], ProductCompanyIDs: [] } }))
            .toContain("CompanyID IN ('x''y')");
    });
});

describe('All deals order (bizapps-sales#371)', () => {
    it('sorts open deals first, then by expected close, on columns the grid holds', () => {
        const grid = DealPipelineGridState();
        expect(grid.sortSettings).toEqual([{ field: 'ClosedAt', dir: 'asc' }, { field: 'ExpectedCloseDate', dir: 'asc' }]);
        const names = grid.columnSettings.map((c) => c.Name);
        for (const s of grid.sortSettings) expect(names).toContain(s.field);
    });
});

describe('grid columns (bizapps-sales#371)', () => {
    const columns = DealPipelineGridState().columnSettings;

    it('shows probability as a percent', () => {
        expect(columns.find((c) => c.Name === 'Probability')?.format).toMatchObject({ type: 'percent', decimals: 0 });
    });

    it('labels the forecast and the close day as two columns', () => {
        expect(columns.find((c) => c.Name === 'ExpectedCloseDate')?.DisplayName).toBe('Expected close');
        expect(columns.find((c) => c.Name === 'ActualCloseDate')?.DisplayName).toBe('Closed on');
        expect(columns.map((c) => c.orderIndex)).toEqual(columns.map((_, i) => i));
    });
});

describe('one date format (bizapps-sales#371)', () => {
    it('writes a stored day as "Jul 1, 2026", from its UTC parts', () => {
        expect(DayLabel('2026-07-01')).toBe('Jul 1, 2026');
        expect(DayLabel(new Date('2026-09-30T00:00:00Z'))).toBe('Sep 30, 2026');
        expect(DayLabel(null)).toBe('');
    });

    it('does not tell a rep which apps the host installed', () => {
        expect(DescribeFiscalBasis({ Start: CALENDAR_YEAR_START, Basis: 'no-accounting' })).toBe('calendar year');
    });
});

describe('the section URL state (bizapps-sales#371)', () => {
    const pages = ['dashboard', 'list', 'board'];

    it('reads known values and drops unknown ones', () => {
        expect(ParseSalesUrlState({ page: 'board', period: 'year', inspect: 'slipped', pipeline: 'p1' }, pages))
            .toEqual({ ...DEFAULT_SALES_URL_STATE, Page: 'board', Period: 'year', Inspect: 'slipped', Pipeline: 'p1' });
        expect(ParseSalesUrlState({ page: 'nope', period: 'decade', inspect: 'x', company: ' ' }, pages)).toEqual(DEFAULT_SALES_URL_STATE);
    });

    it("ignores the Board's retired company, and writes it empty so an old link loses it (bc-aidp-next-golive#351)", () => {
        expect(ParseSalesUrlState({ page: 'board', company: 'c1' }, pages)).toEqual({ ...DEFAULT_SALES_URL_STATE, Page: 'board' });
        expect(SalesUrlParams({ ...DEFAULT_SALES_URL_STATE, Page: 'board' }).company).toBeNull();
    });

    it('writes every key, null for a default, so a default leaves the URL', () => {
        expect(SalesUrlParams({ ...DEFAULT_SALES_URL_STATE, Period: 'alltime' })).toEqual({
            page: null, period: 'alltime', from: null, to: null, companies: null, productCompanies: null, owners: null, pipelines: null,
            inspect: null, inspectArg: null, company: null, pipeline: null,
        });
    });

    it('round-trips', () => {
        const state = { ...DEFAULT_SALES_URL_STATE, Page: 'list', Period: 'lastquarter' as const, Inspect: 'won' as const, Pipeline: 'p' };
        const params = Object.fromEntries(Object.entries(SalesUrlParams(state)).filter(([, v]) => v !== null)) as Record<string, string>;
        expect(SameSalesUrlState(ParseSalesUrlState(params, pages), state)).toBe(true);
    });

    it('keeps the filter bar, a custom range and a stage argument (bc-aidp-next-golive#350)', () => {
        const state = {
            ...DEFAULT_SALES_URL_STATE,
            Period: 'custom' as const, PeriodStart: '2026-01-01', PeriodEnd: '2026-03-31',
            Companies: ['c1', 'c2'], ProductCompanies: ['pc1'], Owners: ['e1'], Pipelines: ['p1'],
            Inspect: 'stage' as const, InspectArg: 's1',
        };
        const params = Object.fromEntries(Object.entries(SalesUrlParams(state)).filter(([, v]) => v !== null)) as Record<string, string>;
        expect(params).toMatchObject({ companies: 'c1,c2', from: '2026-01-01', inspectArg: 's1' });
        expect(ParseSalesUrlState(params, pages)).toEqual(state);
    });

    it('drops dates that belong to no custom range, and an argument on a slice that takes none', () => {
        const parsed = ParseSalesUrlState({ period: 'year', from: '2026-01-01', inspect: 'won', inspectArg: 's1', companies: ',c1,,C1' }, pages);
        expect(parsed.PeriodStart).toBeNull();
        expect(parsed.InspectArg).toBeNull();
        expect(parsed.Companies).toEqual(['c1']);
    });
});

describe('StageEntryDays (bizapps-sales#450)', () => {
    it("takes the newest event into the deal's current stage, else the day it was created", () => {
        const days = StageEntryDays(
            [
                { DealID: 'D1', ToStageID: 'S2', ChangedAt: '2026-08-10T15:00:00Z' },
                { DealID: 'D1', ToStageID: 'S1', ChangedAt: '2026-08-01T15:00:00Z' },
                { DealID: 'D3', ToStageID: 'S9', ChangedAt: '2026-08-02T15:00:00Z' },
            ],
            [
                { ID: 'D1', PipelineStageID: 's2', __mj_CreatedAt: '2026-07-01T15:00:00Z' },
                { ID: 'D2', PipelineStageID: 'S1', __mj_CreatedAt: '2026-07-05T15:00:00Z' },
                { ID: 'D3', PipelineStageID: 'S1', __mj_CreatedAt: '2026-07-05T15:00:00Z' },
            ],
        );
        expect(days.get('d1')).toBe('2026-08-10');
        expect(days.get('d2')).toBe('2026-07-05');
        expect(days.has('d3'), 'newest event names another stage: unknown, not guessed').toBe(false);
    });
});
