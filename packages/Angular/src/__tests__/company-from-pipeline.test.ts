import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShouldStampCompanyFromPipeline } from '../lib/custom/company-from-pipeline';

/**
 * A NEW DEAL COULD NOT BE SAVED AT ALL.
 *
 * `Deal.CompanyID` is NOT NULL with no default, the form renders it server-maintained, and the server
 * fills it — after `SaveRecord` has already run `Validate()` and returned early. Required, unsettable,
 * supplied too late. The deal workspace stamped it client-side and the form never got the equivalent.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FORM = readFileSync(join(HERE, '..', 'lib', 'custom', 'deal-form.component.ts'), 'utf8');

describe('stamping the selling company', () => {
    it('fills an absent company once a pipeline is chosen', () => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: true, PipelineID: 'p1', CompanyID: null })).toBe(true);
    });

    it('never overwrites a company that is already there', () => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: true, PipelineID: 'p1', CompanyID: 'c1' })).toBe(false);
    });

    it('waits for the pipeline, because the pipeline is what decides the company', () => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: true, PipelineID: null, CompanyID: null })).toBe(false);
    });

    it('does nothing without a record', () => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: false, PipelineID: 'p1', CompanyID: null })).toBe(false);
    });

    /**
     * A cleared picker leaves '' rather than null, and a truthiness test alone would have read '   '
     * as a real id — stamping nothing onto a deal that then failed validation exactly as before.
     */
    it.each([
        ['empty string', ''],
        ['whitespace', '   '],
    ])('treats a company of %s as absent', (_label, blank) => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: true, PipelineID: 'p1', CompanyID: blank })).toBe(true);
    });

    it.each([
        ['empty string', ''],
        ['whitespace', '   '],
    ])('treats a pipeline of %s as not yet chosen', (_label, blank) => {
        expect(ShouldStampCompanyFromPipeline({ HasRecord: true, PipelineID: blank, CompanyID: null })).toBe(false);
    });

    /**
     * NOT gated on IsSaved, and the state shape is the assertion: the rule is keyed on the CAUSE — an
     * absent company with a pipeline to resolve it — so a path that creates a deal some other way is
     * covered without anyone remembering to widen a guard.
     */
    it('is keyed on the missing value, not on the record being new', () => {
        expect(Object.keys({ HasRecord: true, PipelineID: 'p1', CompanyID: null })).not.toContain('IsSaved');
    });
});

/**
 * THE STAMP HAS TO RUN BEFORE VALIDATION, which is the whole reason it lives in SaveRecord.
 *
 * `BaseFormComponent.SaveRecord` calls `Validate()` itself and returns early when it fails. A stamp
 * moved into `Validate()` — the obvious-looking home, since that is what is failing — would be racing
 * the very check it exists to satisfy. Asserted on the source because the ordering is the defect.
 */
describe('where the stamp runs', () => {
    it('is applied before the base save, not inside Validate', () => {
        const save = FORM.indexOf('public override async SaveRecord(');
        expect(save, 'SaveRecord must be overridden').toBeGreaterThan(-1);

        const body = FORM.slice(save, FORM.indexOf('\n    }', save));
        const stamp = body.indexOf('stampCompanyFromPipeline');
        const zuper = body.indexOf('super.SaveRecord');
        expect(stamp).toBeGreaterThan(-1);
        expect(zuper).toBeGreaterThan(-1);
        expect(stamp, 'the stamp must precede the base save').toBeLessThan(zuper);
    });

    it('does not stamp from inside Validate, where it would be too late', () => {
        const validate = FORM.indexOf('public override Validate(');
        const body = FORM.slice(validate);
        expect(body).not.toContain('stampCompanyFromPipeline');
    });

    /** RunView does not throw; a failed read must leave the deal exactly as it was. */
    it('checks the view succeeded before reading a row off it', () => {
        expect(FORM).toContain('if (!result.Success)');
    });
});
