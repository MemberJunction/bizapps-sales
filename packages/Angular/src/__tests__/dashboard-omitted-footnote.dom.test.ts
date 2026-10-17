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
    type StubService,
} from './helpers/sales-section-mount';

/**
 * OMITTED DEALS ARE LEFT OUT OF THE OPEN PIPELINE AMOUNT, so the deal count under that amount leaves
 * them out too. The Open deals tile still counts every open deal and says how many are left out.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async () => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => ({ WhereClause: where ?? '' })),
    };
});

const summary: DealDashboardSummary = {
    OpenAmount: 1475, OpenCount: 5, OpenOmittedCount: 1, TotalCount: 8, PastExpectedCloseCount: 0,
    WonCount: 0, WonAmount: 0, OpenPricedAmount: 1475, OpenStatedAmount: 0, OpenNoAmountCount: 0,
};

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    service.LoadDashboardSummary.mockResolvedValue(summary);
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
        { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal' },
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
        expect(c.Kpis.find((k) => k.Label === 'Open pipeline')?.Footnote).toBe('across 4 open deals');
        expect(c.Kpis.find((k) => k.Label === 'Open deals')?.Footnote).toBe('of 8 total · 1 left out of the forecast');
    });
});
