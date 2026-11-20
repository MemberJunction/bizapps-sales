import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealPipelinePanel, type PipelineOption, type PipelineStageOption } from '../lib/form-panels/deal-form.panels';
import { CompanyDefaultPipeline, PipelineCompanyNames } from '../lib/data/company-pipelines';
import { BoardPipelines } from '../lib/board/deal-board.component';

/**
 * A company's default pipeline, and the `HidePipelines` setting that runs every deal on it.
 *
 * A new deal opened with the default company in the Company picker and no pipeline, so the rep had to
 * pick a pipeline the company already implied. With pipelines hidden, choosing a company is the only
 * way a deal gets a pipeline, so it must always land on that company's default.
 *
 * Constructed rather than `Object.create`d, for the reason `deal-pipeline-stage-filter` records.
 */

const HOME = 'c-home';
const OTHER = 'c-other';
const SHARED = 'p-shared';
const HOME_D2C = 'p-home-d2c';
const OTHER_ONLY = 'p-other-only';

/** SHARED is the IsDefault pipeline and serves both companies; OTHER_ONLY outranks it for Other. */
const PIPELINES: PipelineOption[] = [
    { ID: SHARED, Name: 'B2B', Code: 'B2B', CompanyID: HOME, CompanyName: 'Home', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
    { ID: SHARED, Name: 'B2B', Code: 'B2B', CompanyID: OTHER, CompanyName: 'Other', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
    { ID: HOME_D2C, Name: 'D2C', Code: 'D2C', CompanyID: HOME, CompanyName: 'Home', IsDefault: false, DisplayRank: 5, IsActive: true, LinkIsActive: true },
    { ID: OTHER_ONLY, Name: 'Direct', Code: 'DIRECT', CompanyID: OTHER, CompanyName: 'Other', IsDefault: false, DisplayRank: 1, IsActive: true, LinkIsActive: true },
];

const STAGES: PipelineStageOption[] = [
    { ID: 's-shared', Name: 'Discovery', PipelineID: SHARED },
    { ID: 's-d2c', Name: 'Introduced', PipelineID: HOME_D2C },
];

interface PanelOptions {
    PipelineID?: string | null;
    StageID?: string | null;
    CompanyID?: string | null;
    EditMode?: boolean;
    Hide?: boolean;
}

function panelWith(options: PanelOptions = {}) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', {
        value: {
            PipelineID: options.PipelineID ?? null,
            PipelineStageID: options.StageID ?? null,
            CompanyID: options.CompanyID ?? null,
            IsSaved: !!options.PipelineID,
        } as unknown as DealEntity,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(panel, 'EditMode', { value: options.EditMode ?? true, configurable: true });
    (panel as unknown as { pipelines: { set(v: PipelineOption[]): void } }).pipelines.set(PIPELINES);
    (panel as unknown as { stages: { set(v: PipelineStageOption[]): void } }).stages.set(STAGES);
    panel.HidePipelines.set(options.Hide ?? false);
    return panel;
}

describe('a company\'s default pipeline', () => {
    it('is the IsDefault pipeline when the company is linked to it, whatever the DisplayRank', () => {
        expect(CompanyDefaultPipeline(PIPELINES, OTHER)?.ID).toBe(SHARED);
        expect(CompanyDefaultPipeline(PIPELINES, HOME)?.ID).toBe(SHARED);
    });

    it('is the lowest DisplayRank when the IsDefault pipeline is not linked', () => {
        const unlinked = PIPELINES.filter((p) => !(p.ID === SHARED && p.CompanyID === OTHER));
        expect(CompanyDefaultPipeline(unlinked, OTHER)?.ID).toBe(OTHER_ONLY);
    });

    it('is null for no company, or a company with no pipeline', () => {
        expect(CompanyDefaultPipeline(PIPELINES, null)).toBeNull();
        expect(CompanyDefaultPipeline(PIPELINES, 'c-none')).toBeNull();
    });
});

describe('a new deal starts on the default company\'s default pipeline', () => {
    it('fills the company and its default pipeline', () => {
        const panel = panelWith();
        panel.FillDefaultPipeline();
        expect(panel.Record.CompanyID).toBe(HOME);
        expect(panel.Record.PipelineID).toBe(SHARED);
    });

    it('leaves a deal that already has a pipeline alone', () => {
        const panel = panelWith({ PipelineID: HOME_D2C, CompanyID: HOME });
        panel.FillDefaultPipeline();
        expect(panel.Record.PipelineID).toBe(HOME_D2C);
    });

    it('writes nothing outside edit mode', () => {
        const panel = panelWith({ EditMode: false });
        panel.FillDefaultPipeline();
        expect(panel.Record.PipelineID).toBeNull();
        expect(panel.Record.CompanyID).toBeNull();
    });
});

describe('choosing a company', () => {
    it('keeps a pipeline the new company also uses while pipelines are shown', () => {
        const panel = panelWith({ PipelineID: SHARED, CompanyID: HOME });
        panel.SetCompany(OTHER);
        expect(panel.Record.PipelineID).toBe(SHARED);
    });

    it('always moves to the company\'s default pipeline while pipelines are hidden', () => {
        const panel = panelWith({ PipelineID: HOME_D2C, StageID: 's-d2c', CompanyID: HOME, Hide: true });
        panel.SetCompany(HOME);
        expect(panel.Record.PipelineID).toBe(SHARED);
        expect(panel.Record.PipelineStageID).toBeNull();
    });

    it('keeps the stage when the deal is already on the default pipeline', () => {
        const panel = panelWith({ PipelineID: SHARED, StageID: 's-shared', CompanyID: HOME, Hide: true });
        panel.SetCompany(OTHER);
        expect(panel.Record.CompanyID).toBe(OTHER);
        expect(panel.Record.PipelineID).toBe(SHARED);
        expect(panel.Record.PipelineStageID).toBe('s-shared');
    });
});

describe('naming a pipeline by its companies', () => {
    it('joins every company the pipeline serves, default company first', () => {
        expect(PipelineCompanyNames(PIPELINES, { ID: SHARED, Name: 'B2B' })).toBe('Home, Other');
    });

    it('names a one-company pipeline by that company', () => {
        expect(PipelineCompanyNames(PIPELINES, { ID: OTHER_ONLY, Name: 'Direct' })).toBe('Other');
    });

    it('falls back to the pipeline\'s name when no company is named', () => {
        const unnamed = PIPELINES.map((p) => ({ ...p, CompanyName: null }));
        expect(PipelineCompanyNames(unnamed, { ID: SHARED, Name: 'B2B' })).toBe('B2B');
    });

    it('leaves the board one tab per pipeline', () => {
        expect(BoardPipelines(PIPELINES, [], []).map((p) => p.ID)).toEqual([SHARED, HOME_D2C, OTHER_ONLY]);
    });
});
