// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';
import type { DealDashboardSummary } from '../lib/workspace/deal-workspace.service';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection as mount,
    stubService,
    Summary,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * OMITTED DEALS ARE LEFT OUT OF THE OPEN PIPELINE AMOUNT, so the deal count under that amount leaves
 * them out too. The tile's second line still counts every open deal and says how many are excluded.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async () => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => ({ WhereClause: where ?? '' })),
    };
});

const summary: DealDashboardSummary = Summary({
    OpenAmount: 1475, OpenCount: 5, OpenOmittedCount: 1, TotalCount: 8, OpenPricedAmount: 1475,
});

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    service.LoadDashboardSummary.mockResolvedValue(summary);
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
        { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal', BaseView: 'vwDeals' },
    ] as unknown as EntityInfo[]);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

describe('the dashboard with an Omitted deal', () => {
    it('counts only the deals behind the Open pipeline amount', async () => {
        const c = (await mount()).componentInstance;
        await vi.waitFor(() => expect(c.Kpis.length).toBeGreaterThan(0));
        const tile = c.Kpis.find((k) => k.Label === 'Open pipeline');
        expect(tile?.Footnote).toBe('4 open deals');
        expect(tile?.Footnote2).toBe('5 total · 1 excluded from the forecast');
    });
});
