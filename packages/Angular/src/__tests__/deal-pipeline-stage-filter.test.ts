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

const PIPELINES: PipelineOption[] = [
    { ID: B2B, Name: 'B2B' },
    { ID: D2C, Name: 'D2C' },
    { ID: LEGACY, Name: 'Sidecar Legacy Pipeline' },
];

const STAGES: PipelineStageOption[] = [
    { ID: 's-disc', Name: 'Discovery', PipelineID: B2B },
    { ID: 's-qual', Name: 'Qualification', PipelineID: B2B },
    { ID: 's-prop', Name: 'Proposal', PipelineID: B2B },
    { ID: 's-intro', Name: 'Introduced', PipelineID: D2C },
    { ID: 's-eval', Name: 'Evaluating', PipelineID: D2C },
    { ID: 's-develop', Name: 'Develop', PipelineID: LEGACY },
];

function panelWith(pipelineID: string | null, stageID: string | null = null, isSaved = true) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', {
        value: { PipelineID: pipelineID, PipelineStageID: stageID, IsSaved: isSaved } as unknown as DealEntity,
        configurable: true,
        writable: true,
    });
    // The loaded lists, as ngOnInit would have left them.
    (panel as unknown as { pipelines: { set(v: PipelineOption[]): void } }).pipelines.set(PIPELINES);
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
     * The form does NOT write CompanyID, unlike the workspace's SelectPipeline. `DealEntityServer`
     * forces it from the pipeline on every save, ignoring whatever a caller supplies, so writing it
     * here would state something this form has no standing to know.
     */
    it('leaves CompanyID alone — the server owns it', () => {
        const panel = panelWith(D2C, 's-intro');
        (panel.Record as unknown as { CompanyID: string | null }).CompanyID = 'company-original';
        panel.SetPipeline(B2B);
        expect((panel.Record as unknown as { CompanyID: string | null }).CompanyID).toBe('company-original');
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
