// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';

import type { DealDashboardSummary } from '../lib/workspace/deal-workspace.service';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection,
    stubService,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * THE SALES SECTION'S FIRST LOAD SHIPPED EVERY DEAL (bizapps-sales#209).
 *
 * The roster query ran with no parameters, so the browser received the whole book, closed deals
 * included, and reduced it. Only three things read closed deals: the board, the forecast stack's
 * Closed segment, and the Won inspect list. These pin where each now gets them:
 *
 *  - the roster asks only for closed deals from the current fiscal quarter, which is what the board
 *    shows, and the board says so;
 *  - the Closed segment is the summary query's `WonAmount`, not a sum over the roster;
 *  - the Won list is a server-side filter with the Won tile's predicate, not a list of roster IDs.
 */

/** The pipeline view is read from MJ; each grid's filter is recorded here so the Won list's can be read back. */
const pipelineView = vi.hoisted(() => ({ wheres: [] as Array<string | undefined> }));
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async (_entity: EntityInfo) => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => {
            pipelineView.wheres.push(where);
            return { WhereClause: where ?? '' };
        }),
    };
});

/** A business day in the third calendar quarter; the fiscal year starts 1 January in the stub. */
const TODAY = new Date('2026-08-15T15:00:00Z');

const SUMMARY: DealDashboardSummary = {
    OpenAmount: 1000,
    OpenCount: 2,
    OpenOmittedCount: 0,
    TotalCount: 9,
    PastExpectedCloseCount: 0,
    WonCount: 4,
    WonAmount: 750,
    OpenPricedAmount: 0,
    OpenStatedAmount: 1000,
    OpenNoAmountCount: 0,
};

/** The two entities the section looks up: Deals (for the grids) and Deal Status Types (for Won). */
const ENTITIES = [
    { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal', BaseView: 'vwDeals' },
    {
        ID: 'status-entity',
        Name: 'MJ_BizApps_Sales: Deal Status Types',
        SchemaName: '__mj_BizAppsSales',
        BaseTable: 'DealStatusType',
        BaseView: 'vwDealStatusTypes',
    },
] as unknown as EntityInfo[];

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
    pipelineView.wheres = [];
    service = stubService();
    service.LoadDashboardSummary.mockResolvedValue(SUMMARY);
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(ENTITIES);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('the roster read', () => {
    it("asks only for closed deals from the current fiscal quarter's start", async () => {
        await mountSection();

        expect(service.LoadRoster).toHaveBeenCalledTimes(1);
        expect(service.LoadRoster).toHaveBeenCalledWith('2026-07-01');
    });

    it('is not re-read, and the board scope does not move, when the period changes', async () => {
        const fixture = await mountSection('board');
        await fixture.componentInstance.SetPeriod('alltime');
        fixture.detectChanges();

        expect(service.LoadRoster).toHaveBeenCalledTimes(1);
        const scope = visiblePage(fixture).querySelector('[data-testid="sales-board-scope"]');
        expect(scope?.textContent?.trim()).toBe('Open deals, and deals closed from Jul 1, 2026');
    });
});

describe('the won figures', () => {
    it("take the forecast stack's Closed segment from the summary, with no won deal in the roster", async () => {
        const fixture = await mountSection();

        expect(fixture.componentInstance.Stack.Closed).toBe(SUMMARY.WonAmount);
    });

    it('list Won deals with the Won tile predicate on the server, counted as the tile counts them', async () => {
        const fixture = await mountSection();
        fixture.componentInstance.SetInspect('won');
        await vi.waitFor(() => expect(pipelineView.wheres.at(-1)).toContain('IsWon = 1'));

        expect(pipelineView.wheres.at(-1)).toBe(
            'DealStatusTypeID IN (SELECT ID FROM [__mj_BizAppsSales].[vwDealStatusTypes] WHERE IsWon = 1)' +
                " AND ActualCloseDate >= '2026-07-01' AND ActualCloseDate <= '2026-09-30'",
        );
        expect(fixture.componentInstance.InspectCount).toBe(SUMMARY.WonCount);
    });
});
