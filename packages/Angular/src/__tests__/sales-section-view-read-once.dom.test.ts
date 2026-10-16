// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata, type EntityInfo } from '@memberjunction/core';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';

import { DealPipelineViewWith, LoadDealPipelineViewTemplate } from '../lib/pages/deal-views';
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
 * THE GRIDS' SAVED VIEW WAS READ TWICE, IN TURN, AFTER EVERYTHING ELSE (bizapps-sales#261).
 *
 * The inspect strip and All Deals each read the pipeline view by name, one after the other, and only
 * once every other read on the section had finished: two extra round trips added to every load,
 * and two more on every inspect slice click. The view is now read once, alongside the other reads,
 * and each grid gets its own copy.
 */
vi.mock('../lib/pages/deal-views', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/pages/deal-views')>();
    return {
        ...actual,
        LoadDealPipelineViewTemplate: vi.fn(),
        DealPipelineViewWith: vi.fn(actual.DealPipelineViewWith),
    };
});

const TEMPLATE = { Name: 'Sales: Pipeline', WhereClause: '' } as unknown as MJUserViewEntityExtended;

const ENTITIES = [
    { ID: 'deal-entity', Name: 'MJ_BizApps_Sales: Deals', SchemaName: '__mj_BizAppsSales', BaseTable: 'Deal' },
] as unknown as EntityInfo[];

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    vi.mocked(LoadDealPipelineViewTemplate).mockReset().mockResolvedValue(TEMPLATE);
    vi.mocked(DealPipelineViewWith).mockClear();
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(ENTITIES);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

describe('the pipeline view', () => {
    it('is requested while the roster is still loading, not after it', async () => {
        let releaseRoster: (rows: []) => void = () => undefined;
        service.LoadRoster.mockReturnValue(new Promise<[]>((resolve) => (releaseRoster = resolve)));
        const fixture = TestBed.createComponent(MJSSalesSectionComponent);
        fixture.detectChanges();

        await vi.waitFor(() => expect(service.LoadRoster).toHaveBeenCalled());
        expect(LoadDealPipelineViewTemplate).toHaveBeenCalledTimes(1);

        releaseRoster([]);
        await vi.waitFor(() => expect(fixture.componentInstance.Loading).toBe(false));
    });

    it('is read once per load, and each grid gets its own copy', async () => {
        const fixture = await mountSection();
        const section = fixture.componentInstance;

        expect(LoadDealPipelineViewTemplate).toHaveBeenCalledTimes(1);
        expect(section.InspectView).not.toBeNull();
        expect(section.AllDealsView).not.toBeNull();
        expect(section.InspectView).not.toBe(section.AllDealsView);
        expect(section.InspectView).not.toBe(TEMPLATE);
        expect(section.AllDealsView?.WhereClause).toBe('');
    });

    it('is not read again when the inspect slice changes', async () => {
        const fixture = await mountSection();
        const section = fixture.componentInstance;
        const before = section.InspectView;

        section.SetInspect('commit');
        await vi.waitFor(() => expect(section.InspectView).not.toBe(before));

        expect(LoadDealPipelineViewTemplate).toHaveBeenCalledTimes(1);
        // No deals in the stub roster, so the commit slice lists nothing.
        expect(section.InspectView?.WhereClause).toBe('1 = 0');
    });

    it('fails the load like any other read when it throws', async () => {
        vi.mocked(LoadDealPipelineViewTemplate).mockRejectedValue(new Error('Received status code 504'));
        const fixture = await mountSection();
        fixture.detectChanges();

        expect(fixture.componentInstance.LoadError).toContain('504');
        expect(visiblePage(fixture).querySelector('mj-loading')).toBeNull();
    });
});

describe('DealPipelineViewWith', () => {
    it('copies an unsaved view without changing it', async () => {
        const copy = await DealPipelineViewWith(TEMPLATE, 'ID IN (1)');

        expect(copy).not.toBe(TEMPLATE);
        expect(copy.WhereClause).toBe('ID IN (1)');
        expect(TEMPLATE.WhereClause).toBe('');
    });
});
