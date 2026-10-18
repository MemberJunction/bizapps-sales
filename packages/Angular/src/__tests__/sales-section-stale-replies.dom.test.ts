// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';

import { DealPipelineViewWith } from '../lib/pages/deal-views';
import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
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
 * A SLOWER, OLDER REPLY COULD OVERWRITE A NEWER ONE on the dashboard. Each reply is now applied only
 * when it answers the latest request: the summary of the latest Refresh() for the period still
 * selected, and the inspect view of the latest slice click.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(async () => ({ WhereClause: '' })),
        DealPipelineViewWith: vi.fn(async (_template: unknown, where?: string) => ({ WhereClause: where ?? '' })),
    };
});

/** A summary whose Commit tile reads `CommitCount` deals, so which reply landed can be read off the tile. */
const summary = (CommitCount: number): DealDashboardSummary => Summary({ CommitCount });

/** A promise the test settles by hand. */
function held<T>(): { promise: Promise<T>; release: (value: T) => void } {
    let release: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => (release = resolve));
    return { promise, release };
}

const commitDealCount = (c: MJSSalesSectionComponent): string | undefined =>
    c.Kpis.find((k) => k.Label === 'Commit')?.Footnote.split(' ')[0];

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    service.LoadDashboardSummary.mockResolvedValue(summary(1));
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
        { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal', BaseView: 'vwDeals' },
    ] as unknown as EntityInfo[]);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

describe('the dashboard summary', () => {
    it("keeps the later Refresh()'s figures when the earlier one answers last", async () => {
        const fixture = await mount();
        const c = fixture.componentInstance;
        const first = held<DealDashboardSummary>();
        const second = held<DealDashboardSummary>();
        service.LoadDashboardSummary.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const a = c.Refresh();
        await vi.waitFor(() => expect(service.LoadDashboardSummary).toHaveBeenCalledTimes(2));
        const b = c.Refresh();
        await vi.waitFor(() => expect(service.LoadDashboardSummary).toHaveBeenCalledTimes(3));
        second.release(summary(2));
        await b;
        first.release(summary(9));
        await a;

        expect(commitDealCount(c)).toBe('2');
    });

    it("keeps a period change made mid-load, rather than the load's figures for the old period", async () => {
        const fixture = await mount();
        const c = fixture.componentInstance;
        const load = held<DealDashboardSummary>();
        service.LoadDashboardSummary.mockReturnValueOnce(load.promise).mockResolvedValueOnce(summary(5));

        const refresh = c.Refresh();
        await vi.waitFor(() => expect(service.LoadDashboardSummary).toHaveBeenCalledTimes(2));
        await c.SetPeriod('alltime');
        load.release(summary(9));
        await refresh;

        expect(commitDealCount(c)).toBe('5');
    });
});

describe('the inspect grid', () => {
    it("shows the later slice's view when the earlier one answers last", async () => {
        const fixture = await mount();
        const c = fixture.componentInstance;
        const viewWith = vi.mocked(DealPipelineViewWith);
        const first = held<Awaited<ReturnType<typeof DealPipelineViewWith>>>();
        const second = held<Awaited<ReturnType<typeof DealPipelineViewWith>>>();
        viewWith.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        c.SetInspect('commit');
        c.SetInspect('slipped');
        const later = { WhereClause: 'later' } as Awaited<ReturnType<typeof DealPipelineViewWith>>;
        second.release(later);
        await vi.waitFor(() => expect(c.InspectView).toBe(later));
        first.release({ WhereClause: 'earlier' } as Awaited<ReturnType<typeof DealPipelineViewWith>>);
        await Promise.resolve();
        await Promise.resolve();

        expect(c.InspectView).toBe(later);
    });
});
