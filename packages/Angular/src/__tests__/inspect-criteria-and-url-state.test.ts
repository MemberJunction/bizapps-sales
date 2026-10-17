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

    it('limits every slice to open deals in forecast pipelines, by flag', () => {
        expect(InspectCriteriaWhere('open', TABLES, today)).toBe(OPEN_IN_FORECAST);
    });

    it.each<[CriteriaInspectKey, string]>([
        ['commit', 'ForecastCategoryTypeID IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInCommit = 1)'],
        ['best', 'ForecastCategoryTypeID IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInBestCase = 1)'],
        ['pipe', '(ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInPipeline = 0))'],
        ['remainder', '(ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM [s].[vwForecastCategoryTypes] WHERE IncludeInPipeline = 0 OR IncludeInCommit = 1 OR IncludeInBestCase = 1))'],
        ['slipped', "ExpectedCloseDate IS NOT NULL AND ExpectedCloseDate < '2026-08-15'"],
        ['noowner', "(OwnerEmployee IS NULL OR OwnerEmployee = '')"],
        ['week', "ExpectedCloseDate >= '2026-08-15' AND ExpectedCloseDate <= '2026-08-22'"],
        ['month', "ExpectedCloseDate > '2026-08-22' AND ExpectedCloseDate <= '2026-08-31'"],
        ['later', "(ExpectedCloseDate IS NULL OR ExpectedCloseDate > '2026-08-31')"],
    ])('%s', (key, extra) => {
        expect(InspectCriteriaWhere(key, TABLES, today)).toBe(`${OPEN_IN_FORECAST} AND ${extra}`);
    });

    it('splits the date buckets where the roster filter does, near month end too', () => {
        expect(InspectDateBounds('2026-08-28')).toEqual({ WeekEnd: '2026-09-04', MonthEnd: '2026-08-31', LaterFrom: '2026-09-04' });
        // FilterInspect reads the same bounds: a deal on the week's last day is in "week", not "later".
        const deal = { IsOpen: true, ExpectedCloseDate: '2026-09-04' } as Parameters<typeof FilterInspect>[0][number];
        expect(FilterInspect([deal], 'week', '2026-08-28')).toHaveLength(1);
        expect(FilterInspect([deal], 'later', '2026-08-28')).toHaveLength(0);
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
        expect(ParseSalesUrlState({ page: 'board', period: 'year', inspect: 'slipped', company: 'c1', pipeline: 'p1' }, pages))
            .toEqual({ Page: 'board', Period: 'year', Inspect: 'slipped', Company: 'c1', Pipeline: 'p1' });
        expect(ParseSalesUrlState({ page: 'nope', period: 'decade', inspect: 'x', company: ' ' }, pages)).toEqual(DEFAULT_SALES_URL_STATE);
    });

    it('writes every key, null for a default, so a default leaves the URL', () => {
        expect(SalesUrlParams({ ...DEFAULT_SALES_URL_STATE, Period: 'alltime' }))
            .toEqual({ page: null, period: 'alltime', inspect: null, company: null, pipeline: null });
    });

    it('round-trips', () => {
        const state = { Page: 'list', Period: 'lastquarter' as const, Inspect: 'won' as const, Company: null, Pipeline: 'p' };
        const params = Object.fromEntries(Object.entries(SalesUrlParams(state)).filter(([, v]) => v !== null)) as Record<string, string>;
        expect(SameSalesUrlState(ParseSalesUrlState(params, pages), state)).toBe(true);
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
