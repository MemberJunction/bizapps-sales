import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { ValidationResult } from '@memberjunction/core';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealPipelinePanel, type PipelineOption } from '../lib/form-panels/deal-form.panels';
import { DealFormComponentExtended } from '../lib/custom/deal-form.component';
import { CHOOSE_PIPELINE_MESSAGE, NoPipelineMessage, type NoPipelineState } from '../lib/data/company-pipelines';

/**
 * A deal with no pipeline says why it cannot be saved, and what to do.
 *
 * `Deal.PipelineID` is NOT NULL and a deal's pipeline must be linked to its company, so a company with
 * no linked pipeline leaves the deal unsaveable. The save said "Choose a pipeline" — a choice that did
 * not exist, and with pipelines hidden, a field the rep could not see.
 */

const HOME = 'c-home';
const OTHER = 'c-other';
const BARE = 'c-bare';

const PIPELINES: PipelineOption[] = [
    { ID: 'p-b2b', Name: 'B2B', Code: 'B2B', CompanyID: HOME, CompanyName: 'Home', IsDefault: true, DisplayRank: 10, IsActive: true, LinkIsActive: true },
];

function state(overrides: Partial<NoPipelineState> = {}): NoPipelineState {
    return { HidePipelines: true, CompanyID: BARE, CompanyName: 'Bare Co', CompanyHasPipeline: false, OtherCompanyHasPipeline: true, ...overrides };
}

describe('the no-pipeline message', () => {
    it('names a company with no pipeline and offers another company or an admin', () => {
        expect(NoPipelineMessage(state())).toBe(
            'Bare Co has no pipeline, so this deal can\'t be saved. Choose another company, or ask a Sales admin to link a pipeline to Bare Co.',
        );
    });

    it('offers only the admin when no other company has a pipeline', () => {
        expect(NoPipelineMessage(state({ OtherCompanyHasPipeline: false }))).toBe(
            'Bare Co has no pipeline, so this deal can\'t be saved. Ask a Sales admin to link a pipeline to Bare Co.',
        );
    });

    it('says "this company" when the name is not known', () => {
        expect(NoPipelineMessage(state({ CompanyName: null }))).toMatch(/^This company has no pipeline.*to this company\.$/);
    });

    it('says when no company has a pipeline at all', () => {
        expect(NoPipelineMessage(state({ CompanyID: null, CompanyName: null, OtherCompanyHasPipeline: false }))).toMatch(/^No company has a pipeline/);
    });

    it('asks for a company, not a pipeline, while pipelines are hidden', () => {
        expect(NoPipelineMessage(state({ CompanyID: null, CompanyName: null }))).toMatch(/^Choose a company\./);
    });

    it('keeps "Choose a pipeline" when the Pipeline field is shown and the company has one', () => {
        expect(NoPipelineMessage(state({ HidePipelines: false, CompanyID: HOME, CompanyHasPipeline: true }))).toBe(CHOOSE_PIPELINE_MESSAGE);
    });
});

function panelWith(options: { CompanyID?: string | null; Company?: string | null; PipelineID?: string | null; Hide?: boolean; Loaded?: boolean; Pipelines?: PipelineOption[] }) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', {
        value: {
            PipelineID: options.PipelineID ?? null,
            PipelineStageID: null,
            CompanyID: options.CompanyID ?? null,
            Company: options.Company ?? null,
            IsSaved: false,
        } as unknown as DealEntity,
        configurable: true,
    });
    Object.defineProperty(panel, 'EditMode', { value: true, configurable: true });
    const internals = panel as unknown as { pipelines: { set(v: PipelineOption[]): void }; pipelinesLoaded: { set(v: boolean): void } };
    internals.pipelines.set(options.Pipelines ?? PIPELINES);
    internals.pipelinesLoaded.set(options.Loaded ?? true);
    panel.HidePipelines.set(options.Hide ?? true);
    return panel;
}

describe('the pipeline panel before a save', () => {
    it('warns when the deal\'s company has no pipeline', () => {
        const panel = panelWith({ CompanyID: BARE, Company: 'Bare Co' });
        expect(panel.NoPipelineHint).toMatch(/^Bare Co has no pipeline/);
    });

    it('shows the Company picker, with the deal\'s company marked, when that company has no pipeline', () => {
        const panel = panelWith({ CompanyID: BARE, Company: 'Bare Co' });
        expect(panel.CompanyOptions).toHaveLength(1);
        expect(panel.CompanyIsListed).toBe(false);
        expect(panel.ShowCompanyPicker).toBe(true);
    });

    it('says nothing until the pipelines load', () => {
        expect(panelWith({ CompanyID: BARE, Loaded: false }).NoPipelineHint).toBeNull();
    });

    it('says nothing once the deal has a pipeline', () => {
        expect(panelWith({ CompanyID: HOME, PipelineID: 'p-b2b' }).NoPipelineHint).toBeNull();
    });

    it('leaves an unmade choice in a visible Pipeline field to the required marker', () => {
        expect(panelWith({ CompanyID: HOME, Hide: false }).NoPipelineHint).toBeNull();
    });

    it('keeps the picker hidden when one company has every pipeline and the deal is on it', () => {
        expect(panelWith({ CompanyID: HOME, PipelineID: 'p-b2b' }).ShowCompanyPicker).toBe(false);
    });

    it('names the company from the pipeline links when the deal does not carry its name', () => {
        const other: PipelineOption = { ...PIPELINES[0], ID: 'p-other', CompanyID: OTHER, CompanyName: 'Other', IsDefault: false };
        expect(panelWith({ CompanyID: OTHER, Pipelines: [...PIPELINES, other] }).DealCompanyName).toBe('Other');
        expect(panelWith({ CompanyID: BARE }).DealCompanyName).toBeNull();
    });
});

describe('the save refusal', () => {
    /** The form with `super.Validate()` returning the entity's own "Choose a pipeline" refusal. */
    function validate(pipelineID: string | null, message: string | null, companyID: string | null = null): ValidationResult {
        const form = Object.create(DealFormComponentExtended.prototype) as DealFormComponentExtended;
        const values: Record<string, string | null> = { PipelineID: pipelineID, CompanyID: companyID };
        Object.defineProperty(form, 'record', { value: { Get: (f: string) => values[f] ?? null }, configurable: true });
        form.IsLocked = false;
        form.NoPipelineMessage = message;
        const generated = Object.getPrototypeOf(DealFormComponentExtended.prototype) as { Validate?: () => ValidationResult };
        const had = Object.prototype.hasOwnProperty.call(generated, 'Validate');
        const original = generated.Validate;
        generated.Validate = () => ({
            Success: false,
            Errors: [
                { Source: 'PipelineID', Message: CHOOSE_PIPELINE_MESSAGE, Value: null, Type: 'Failure' },
                { Source: 'CompanyID', Message: 'Company ID cannot be null', Value: null, Type: 'Failure' },
                { Source: 'PipelineID', Message: 'Pipeline ID cannot be null', Value: null, Type: 'Failure' },
                { Source: 'AccountID', Message: 'No customer chosen yet', Value: null, Type: 'Warning' },
            ],
        }) as unknown as ValidationResult;
        try {
            return form.Validate();
        } finally {
            if (had) generated.Validate = original;
            else delete generated.Validate;
        }
    }

    it('replaces "Choose a pipeline" with the reason', () => {
        const result = validate(null, 'Bare Co has no pipeline, so this deal can\'t be saved.');
        expect(result.Errors[0].Message).toBe('Bare Co has no pipeline, so this deal can\'t be saved.');
    });

    it('lists the problem once: one pipeline error, no "Company ID cannot be null", other errors kept', () => {
        const result = validate(null, 'reason');
        expect(result.Errors.map((e) => `${e.Source}: ${e.Message}`)).toEqual(['PipelineID: reason', 'AccountID: No customer chosen yet']);
    });

    it('keeps a CompanyID error when the deal has a company, since the message does not cover it', () => {
        expect(validate(null, 'reason', 'c-bare').Errors.map((e) => e.Source)).toEqual(['PipelineID', 'CompanyID', 'AccountID']);
    });

    it('keeps the entity\'s message when there is no reason to give', () => {
        expect(validate(null, null).Errors[0].Message).toBe(CHOOSE_PIPELINE_MESSAGE);
    });

    it('ignores a stale reason once the deal has a pipeline', () => {
        expect(validate('p-b2b', 'stale').Errors[0].Message).toBe(CHOOSE_PIPELINE_MESSAGE);
    });
});
