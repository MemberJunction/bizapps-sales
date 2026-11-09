import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import {
    MJSDealPipelinePanel,
    type PipelineOption,
    type PipelineStageOption,
} from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#291: the deal form's Pipeline Stage control listed EVERY stage in the system —
 * D2C's three and sixteen legacy pipelines' alongside B2B's six — because `<mj-form-field>` renders a
 * foreign key as an unfiltered dropdown off the related entity. A B2B deal could be positioned in
 * D2C's process, and `applyStageDefaults` then took that stage's probability, forecast category and
 * status from it.
 *
 * Exactly the defect golive#205 fixed for Status in this same panel, and fixed the same way: a
 * control that offers only what is valid.
 *
 * WHY THE FORM AND NOT ONLY THE SERVER. The server now refuses the mismatch too
 * (`StageBelongsToPipeline.test.ts`), and that guard is the one imports and Actions hit. This pins
 * the other half: a control that never offers the invalid option in the first place, so the refusal
 * is a backstop rather than the everyday experience.
 *
 * CONSTRUCTED, NOT `Object.create`d, for the reason `deal-pipeline-status-filter` records: building
 * off the prototype runs no field initialiser, so a removed one is invisible here while crashing in
 * the browser.
 */

const B2B = 'p-b2b';
const D2C = 'p-d2c';
const LEGACY = 'p-legacy';

const HOME = 'c-home';
const OTHER = 'c-other';
const OTHER_B2B = 'p-other-b2b';
/** Retired: deactivated, so only a deal already in it may still name it (bc-aidp-next-golive#423). */
const RETIRED = 'p-retired';
/** A company whose only pipeline is retired. */
const LEGACY_CO = 'c-legacy';

const PIPELINES: PipelineOption[] = [
    { ID: B2B, Name: 'B2B', Code: 'B2B', CompanyID: HOME, CompanyName: 'Home', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
    { ID: D2C, Name: 'D2C', Code: 'D2C', CompanyID: HOME, CompanyName: 'Home', IsDefault: false, DisplayRank: 20, IsActive: true, LinkIsActive: true },
    { ID: LEGACY, Name: 'Sidecar Legacy Pipeline', Code: 'LEGACY', CompanyID: HOME, CompanyName: 'Home', IsDefault: false, DisplayRank: 30, IsActive: true, LinkIsActive: true },
    { ID: OTHER_B2B, Name: 'B2B', Code: 'B2B', CompanyID: OTHER, CompanyName: 'Other', IsDefault: false, DisplayRank: 10, IsActive: true, LinkIsActive: true },
    { ID: RETIRED, Name: 'Legacy', Code: 'LEG', CompanyID: LEGACY_CO, CompanyName: 'Legacy Co', IsDefault: false, DisplayRank: 10, IsActive: false, LinkIsActive: true },
];

const STAGES: PipelineStageOption[] = [
    { ID: 's-disc', Name: 'Discovery', PipelineID: B2B },
    { ID: 's-qual', Name: 'Qualification', PipelineID: B2B },
    { ID: 's-prop', Name: 'Proposal', PipelineID: B2B },
    { ID: 's-intro', Name: 'Introduced', PipelineID: D2C },
    { ID: 's-eval', Name: 'Evaluating', PipelineID: D2C },
    { ID: 's-develop', Name: 'Develop', PipelineID: LEGACY },
];

/** The company of each single-company pipeline above, so a saved deal carries the company it was saved with. */
function companyOf(pipelineID: string | null): string | null {
    return PIPELINES.find((p) => p.ID === pipelineID?.toLowerCase())?.CompanyID ?? null;
}

function panelWith(
    pipelineID: string | null,
    stageID: string | null = null,
    isSaved = true,
    companyID: string | null = isSaved ? companyOf(pipelineID) : null,
    pipelines: PipelineOption[] = PIPELINES,
) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', {
        value: { PipelineID: pipelineID, PipelineStageID: stageID, CompanyID: companyID, IsSaved: isSaved } as unknown as DealEntity,
        configurable: true,
        writable: true,
    });
    // The loaded lists, as ngOnInit would have left them.
    (panel as unknown as { pipelines: { set(v: PipelineOption[]): void } }).pipelines.set(pipelines);
    (panel as unknown as { stages: { set(v: PipelineStageOption[]): void } }).stages.set(STAGES);
    return panel;
}

describe('the stage list carries one pipeline, not all of them', () => {
    it('offers only the chosen pipeline\'s stages', () => {
        const names = panelWith(B2B).StagesForCurrentPipeline.map((s) => s.Name);
        expect(names).toEqual(['Discovery', 'Qualification', 'Proposal']);
    });

    it('offers a different pipeline\'s stages when the deal sits in it', () => {
        const names = panelWith(D2C).StagesForCurrentPipeline.map((s) => s.Name);
        expect(names).toEqual(['Introduced', 'Evaluating']);
    });

    /** The reported symptom, stated as an assertion: no cross-pipeline leakage. */
    it('never offers another pipeline\'s stage', () => {
        const ids = panelWith(B2B).StagesForCurrentPipeline.map((s) => s.ID);
        expect(ids).not.toContain('s-intro');
        expect(ids).not.toContain('s-develop');
    });

    it('offers nothing, and disables the control, until a pipeline is chosen', () => {
        const panel = panelWith(null);
        expect(panel.StagesForCurrentPipeline).toEqual([]);
        expect(panel.StageIsEditable).toBe(false);
    });

    /** Ids round-trip through JSON; SQL Server returns uppercase and clients generate lowercase. */
    it('matches the pipeline case-insensitively', () => {
        expect(panelWith(B2B.toUpperCase()).StagesForCurrentPipeline).toHaveLength(3);
    });
});

describe('changing the pipeline', () => {
    it('clears a stage that belonged to the previous pipeline', () => {
        const panel = panelWith(D2C, 's-intro');
        panel.SetPipeline(B2B);
        expect(panel.Record.PipelineID).toBe(B2B);
        expect(panel.Record.PipelineStageID).toBeNull();
    });

    /**
     * Cleared, not remapped. There is no honest translation from one pipeline's process to another's,
     * which is the same reasoning that makes the server REFUSE a mismatch rather than correct it.
     */
    it('does not silently move the deal to the new pipeline\'s first stage', () => {
        const panel = panelWith(D2C, 's-intro');
        panel.SetPipeline(B2B);
        expect(panel.Record.PipelineStageID).not.toBe('s-disc');
    });

    it('keeps a stage that still belongs after the change', () => {
        const panel = panelWith(B2B, 's-qual');
        panel.SetPipeline(B2B);
        expect(panel.Record.PipelineStageID).toBe('s-qual');
    });

    it('clears the stage when the pipeline is unset entirely', () => {
        const panel = panelWith(B2B, 's-qual');
        panel.SetPipeline(null);
        expect(panel.Record.PipelineStageID).toBeNull();
    });

    /**
     * The deal's company is the rep's choice, made with Company. A pipeline pick keeps it: the picker
     * only offers the chosen company's pipelines, and `DealEntityServer` refuses a mismatch.
     */
    it('keeps a company the deal already has', () => {
        const panel = panelWith(D2C, 's-intro');
        panel.SetPipeline(B2B);
        expect(panel.Record.CompanyID).toBe(HOME);
    });

    /** The Company picker is hidden when one company has every pipeline, so nothing else would fill it. */
    it('fills an empty CompanyID with the selected company the pipeline serves', () => {
        const panel = panelWith(null, null, false);
        expect(panel.Record.CompanyID).toBeNull();
        panel.SetPipeline(D2C);
        expect(panel.Record.CompanyID).toBe(HOME);
    });

    it('does not fill an empty CompanyID with a company the pipeline does not serve', () => {
        const panel = panelWith(null, null, false);
        panel.SetPipeline(OTHER_B2B);
        expect(panel.Record.CompanyID).toBeNull();
    });
});

describe('picking a stage', () => {
    it('records the pick', () => {
        const panel = panelWith(B2B, null);
        panel.SetStage('s-prop');
        expect(panel.Record.PipelineStageID).toBe('s-prop');
    });

    /**
     * The stage's Probability and ForecastCategoryTypeID are the SERVER's to apply. Writing them here
     * would destroy a rep-typed probability before the server ever saw it — the defect
     * `applyStageDefaults` guards and that the workspace's `OnStageChange` records.
     */
    it('does not write the stage\'s defaults', () => {
        const panel = panelWith(B2B, null);
        const rec = panel.Record as unknown as { Probability: number | null; ForecastCategoryTypeID: string | null };
        rec.Probability = 85;
        rec.ForecastCategoryTypeID = 'fc-typed';
        panel.SetStage('s-prop');
        expect(rec.Probability).toBe(85);
        expect(rec.ForecastCategoryTypeID).toBe('fc-typed');
    });
});

/**
 * The control has to actually be the dedicated one. Asserting the getters while the template still
 * rendered `<mj-form-field FieldName="PipelineStageID">` would pass and ship the bug — the same shape
 * as the returns-picker wiring check in bizapps-orders, which caught exactly that.
 */
describe('the template uses the dedicated controls', () => {
    const source = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), '../lib/form-panels/deal-form.panels.ts'),
        'utf8',
    );

    it('renders Pipeline Stage as a filtered select, not a generic form field', () => {
        expect(source).toContain('data-testid="deal-stage"');
        expect(source).toContain('StagesForCurrentPipeline');
    });

    it('renders Pipeline as a select that routes through SetPipeline', () => {
        expect(source).toContain('data-testid="deal-pipeline"');
        expect(source).toContain('SetPipeline($event)');
    });

    it('no longer lists either as a generic field spec', () => {
        expect(source).not.toContain("{ name: 'PipelineStageID', type: 'textbox'");
        expect(source).not.toContain("{ name: 'PipelineID', type: 'textbox'");
    });
});

/**
 * #327: the Company control writes the deal's company and narrows the Pipeline list. Choosing a company
 * the current pipeline does not serve moves the deal to that company's first pipeline through the same
 * path a pipeline pick takes, so a stale stage is cleared.
 */
describe('the company filter over the pipeline list', () => {
    it('offers the deal\'s own company\'s pipelines, each labelled with its company', () => {
        const panel = panelWith(OTHER_B2B);
        expect(panel.SelectedCompanyID).toBe(OTHER);
        expect(panel.PipelineOptions.map((p) => panel.PipelineText(p))).toEqual(['B2B (Other)']);
    });

    it('opens a new deal on the default company', () => {
        const panel = panelWith(null, null, false);
        expect(panel.SelectedCompanyID).toBe(HOME);
        expect(panel.PipelineOptions.map((p) => p.ID)).toEqual([B2B, D2C, LEGACY]);
    });

    it('lists companies default first', () => {
        expect(panelWith(B2B).CompanyOptions.map((c) => c.CompanyID)).toEqual([HOME, OTHER]);
    });

    it('writes the deal\'s company, moves it to the company\'s first pipeline and clears the old stage', () => {
        const panel = panelWith(B2B, 's-qual');
        panel.SetCompany(OTHER);
        expect(panel.Record?.CompanyID).toBe(OTHER);
        expect(panel.Record?.PipelineID).toBe(OTHER_B2B);
        expect(panel.Record?.PipelineStageID).toBeNull();
    });

    it('opens on the deal\'s company, not on one its pipeline also serves', () => {
        expect(panelWith(OTHER_B2B, null, true, OTHER).SelectedCompanyID).toBe(OTHER);
    });

    it('reads the current pipeline with its company when not editing', () => {
        expect(panelWith(OTHER_B2B).CurrentPipelineName).toBe('B2B (Other)');
    });
});

describe('an inactive pipeline is shown only on the deal already in it (bc-aidp-next-golive#423)', () => {
    it('is not offered to a deal in another pipeline', () => {
        const panel = panelWith(B2B);
        expect(panel.CompanyOptions.map((c) => c.CompanyID)).not.toContain(LEGACY_CO);
        expect(panelWith(null, null, false).PipelineOptions.map((p) => p.ID)).not.toContain(RETIRED);
    });

    it('stays selected, with its company, on a deal that sits in it', () => {
        const panel = panelWith(RETIRED);
        expect(panel.SelectedCompanyID).toBe(LEGACY_CO);
        expect(panel.PipelineOptions.map((p) => p.ID)).toEqual([RETIRED]);
        expect(panel.CompanyOptions.map((c) => c.CompanyID)).toContain(LEGACY_CO);
    });

    it('names it when not editing', () => {
        expect(panelWith(RETIRED).CurrentPipelineName).toBe('Legacy (Legacy Co)');
    });

    it('drops out once the deal moves to an active pipeline', () => {
        const panel = panelWith(RETIRED);
        panel.SetCompany(HOME);
        expect(panel.Record?.PipelineID).toBe(B2B);
        expect(panel.CompanyOptions.map((c) => c.CompanyID)).not.toContain(LEGACY_CO);
    });
});

/**
 * A pipeline linked to two companies (`PipelineCompany`) is offered under each, and choosing the other
 * company keeps the deal in it: only the company changes, so the stage survives.
 */
describe('a pipeline shared by two companies', () => {
    const SHARED = 'p-shared';
    const SHARED_PIPELINES: PipelineOption[] = [
        { ID: SHARED, Name: 'B2B', Code: 'B2B', CompanyID: HOME, CompanyName: 'Home', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
        { ID: SHARED, Name: 'B2B', Code: 'B2B', CompanyID: OTHER, CompanyName: 'Other', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
        { ID: D2C, Name: 'D2C', Code: 'D2C', CompanyID: HOME, CompanyName: 'Home', IsDefault: false, DisplayRank: 20, IsActive: true, LinkIsActive: true },
    ];
    const SHARED_STAGES: PipelineStageOption[] = [{ ID: 's-shared', Name: 'Discovery', PipelineID: SHARED }];

    function sharedPanel(companyID: string | null, stageID: string | null = 's-shared') {
        const panel = panelWith(SHARED, stageID, true, companyID, SHARED_PIPELINES);
        (panel as unknown as { stages: { set(v: PipelineStageOption[]): void } }).stages.set(SHARED_STAGES);
        return panel;
    }

    it('offers it under both companies', () => {
        expect(sharedPanel(HOME).PipelineOptions.map((p) => p.ID)).toEqual([SHARED, D2C]);
        expect(sharedPanel(OTHER).PipelineOptions.map((p) => p.ID)).toEqual([SHARED]);
        expect(sharedPanel(HOME).CompanyOptions.map((c) => c.CompanyID)).toEqual([HOME, OTHER]);
    });

    it('changes only the company when the new company is served by the same pipeline', () => {
        const panel = sharedPanel(HOME);
        panel.SetCompany(OTHER);
        expect(panel.Record.CompanyID).toBe(OTHER);
        expect(panel.Record.PipelineID).toBe(SHARED);
        expect(panel.Record.PipelineStageID).toBe('s-shared');
    });

    it('names the pipeline with the deal\'s own company', () => {
        expect(sharedPanel(OTHER).CurrentPipelineName).toBe('B2B (Other)');
        expect(sharedPanel(HOME).CurrentPipelineName).toBe('B2B (Home)');
    });

    it('hides a retired link from other deals but keeps it on the deal that uses it', () => {
        const retiredLink = SHARED_PIPELINES.map((p) => (p.CompanyID === OTHER ? { ...p, LinkIsActive: false } : p));
        const onHome = panelWith(SHARED, null, true, HOME, retiredLink);
        expect(onHome.CompanyOptions.map((c) => c.CompanyID)).toEqual([HOME]);
        const onOther = panelWith(SHARED, null, true, OTHER, retiredLink);
        expect(onOther.SelectedCompanyID).toBe(OTHER);
        expect(onOther.CompanyOptions.map((c) => c.CompanyID)).toContain(OTHER);
    });
});
