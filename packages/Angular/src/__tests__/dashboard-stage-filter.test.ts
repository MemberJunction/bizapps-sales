/**
 * The filter bar's Stage list (bc-aidp-next-golive#488).
 *
 * Stage names repeat across pipelines, so the list picks stage IDs grouped under each pipeline, with a
 * "No stage" entry per pipeline. The queries, the grids and the URL all read the same list.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    FilterParameters,
    NO_FILTERS,
    OpenStageIDs,
    SplitStageIDs,
    StageOptionsFor,
    StagesWithinPipelines,
    UnstagedKey,
    type StageChoice,
} from '../lib/pages/dashboard-filters';
import { DealFiltersWhere, InspectCriteriaWhere } from '../lib/pages/deal-views';
import { DEFAULT_SALES_URL_STATE, ParseSalesUrlState, SalesUrlParams } from '../lib/sections/sales-url-state';

const STAGES: StageChoice[] = [
    { ID: 'S2', Name: 'Propose', PipelineID: 'P1', DisplayOrder: 2, DealStatusTypeID: 'OPEN' },
    { ID: 'S1', Name: 'Qualify', PipelineID: 'P1', DisplayOrder: 1, DealStatusTypeID: 'OPEN' },
    { ID: 'S3', Name: 'Lost', PipelineID: 'P1', DisplayOrder: 3, DealStatusTypeID: 'LOST' },
    { ID: 'T1', Name: 'Qualify', PipelineID: 'P2', DisplayOrder: 1, DealStatusTypeID: 'OPEN' },
    { ID: 'T2', Name: 'Lost', PipelineID: 'P2', DisplayOrder: 2, DealStatusTypeID: 'LOST' },
];
const STATUSES = [{ ID: 'OPEN', IsOpen: true }, { ID: 'LOST', IsOpen: false }];
const PIPELINES = [{ ID: 'P1', Name: 'New business' }, { ID: 'P2', Name: 'Renewals' }];

describe('the Stage list', () => {
    it("groups each pipeline's stages in its own order, each followed by No stage", () => {
        const options = StageOptionsFor(PIPELINES, STAGES, (p) => p.Name);
        expect(options.map((o) => `${o.Group}/${o.Name}`)).toEqual([
            'New business/Qualify', 'New business/Propose', 'New business/Lost', 'New business/No stage',
            'Renewals/Qualify', 'Renewals/Lost', 'Renewals/No stage',
        ]);
        expect(options[3].ID).toBe(UnstagedKey('P1'));
    });

    it('lists only the pipelines it is given, under the heading it is given', () => {
        const options = StageOptionsFor([PIPELINES[1]], STAGES, () => 'Acme');
        expect(options.map((o) => o.ID)).toEqual(['T1', 'T2', 'unstaged:P2']);
        expect(new Set(options.map((o) => o.Group))).toEqual(new Set(['Acme']));
    });

    it('drops a picked stage whose pipeline the other filters no longer allow', () => {
        expect(StagesWithinPipelines(['S1', 'T1', 'unstaged:P2', 'gone'], STAGES, ['P2'])).toEqual(['T1', 'unstaged:P2']);
        expect(StagesWithinPipelines(['S1'], [], ['P2']), 'stages not loaded yet: kept').toEqual(['S1']);
    });

    it('"Open stages" picks the allowed stages whose status is open, by flag', () => {
        expect(OpenStageIDs(STAGES, STATUSES, ['P1', 'P2'])).toEqual(['S2', 'S1', 'T1']);
        expect(OpenStageIDs(STAGES, STATUSES, ['P2'])).toEqual(['T1']);
    });
});

describe('the queries receive the Stage list as two parameters', () => {
    it('splits stage IDs from No stage entries', () => {
        expect(SplitStageIDs(['S1', 'unstaged:P2', 'UNSTAGED:P1', 'unstaged:'])).toEqual({ StageIDs: ['S1'], UnstagedPipelineIDs: ['P2', 'P1'] });
        expect(FilterParameters({ ...NO_FILTERS, StageIDs: ['S1', 'unstaged:P2'] })).toEqual({ StageIDs: ['S1'], UnstagedPipelineIDs: ['P2'] });
        expect(FilterParameters({ ...NO_FILTERS, StageIDs: ['S1'] })).toEqual({ StageIDs: ['S1'] });
        expect(FilterParameters(NO_FILTERS)).toEqual({});
    });

    it.each(['dashboard-summary.sql', 'win-rate.sql', 'deal-roster.sql'])('%s narrows on both', (name) => {
        const sql = readFileSync(new URL(`../../../../metadata/queries/SQL/${name}`, import.meta.url), 'utf8');
        expect(sql).toContain('{% if StageIDs or UnstagedPipelineIDs %}');
        expect(sql).toMatch(/OR d\.PipelineStageID IN \{\{ StageIDs \| sqlIn \}\}/);
        expect(sql).toMatch(/OR \(d\.PipelineStageID IS NULL AND d\.PipelineID IN \{\{ UnstagedPipelineIDs \| sqlIn \}\}\)/);
    });
});

describe('the grids apply the same rule', () => {
    const TABLES = {
        Status: { SchemaName: 's', BaseView: 'vwStatus' },
        Pipeline: { SchemaName: 's', BaseView: 'vwPipelines' },
        Forecast: { SchemaName: 's', BaseView: 'vwForecast' },
    };

    it('All Deals', () => {
        expect(DealFiltersWhere({ ...NO_FILTERS, StageIDs: ['S1'] }, null)).toBe("PipelineStageID IN ('S1')");
        expect(DealFiltersWhere({ ...NO_FILTERS, StageIDs: ['S1', 'unstaged:P2'] }, null))
            .toBe("(PipelineStageID IN ('S1') OR (PipelineStageID IS NULL AND PipelineID IN ('P2')))");
    });

    it('the Won and win-rate lists narrow by stage too', () => {
        const where = InspectCriteriaWhere('won', TABLES, '2026-11-16', { Filters: { ...NO_FILTERS, StageIDs: ['S3'] } });
        expect(where).toContain("PipelineStageID IN ('S3')");
        expect(InspectCriteriaWhere('closed', TABLES, '2026-11-16', { Filters: { ...NO_FILTERS, StageIDs: ['S3'] } })).toContain("PipelineStageID IN ('S3')");
    });
});

describe('the URL keeps the Stage list as `stages`', () => {
    it('round-trips, No stage entries included', () => {
        const state = { ...DEFAULT_SALES_URL_STATE, Stages: ['S1', 'unstaged:P2'] };
        expect(SalesUrlParams(state).stages).toBe('S1,unstaged:P2');
        expect(ParseSalesUrlState({ stages: 'S1,unstaged:P2' }, ['dashboard'])).toEqual(state);
        expect(SalesUrlParams(DEFAULT_SALES_URL_STATE).stages).toBeNull();
    });
});
