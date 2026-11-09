import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationResult } from '@memberjunction/core';
import { mjBizAppsSalesPipelineEntity } from '@mj-biz-apps/sales-entities';

import { CloseWonPolicyProblem, PipelineEntityServer } from '../PipelineEntityServer.js';

/**
 * A PIPELINE'S CLOSE WON POLICY IS CHECKED WHEN IT IS SAVED (bizapps-sales#448).
 *
 * `Sales.CloseDeal` parses the policy at every won close and, on a parse error, logs one line and routes
 * with the defaults. These pin what the save refuses, so a policy the close would ignore cannot be stored.
 */
describe('CloseWonPolicyProblem', () => {
    it('accepts an empty policy, which means the defaults', () => {
        expect(CloseWonPolicyProblem(null)).toBeNull();
        expect(CloseWonPolicyProblem('')).toBeNull();
        expect(CloseWonPolicyProblem('  ')).toBeNull();
    });

    it('accepts the seeded policies', () => {
        expect(CloseWonPolicyProblem(
            '{"CreateContract":true,"ContractTypeCode":"Order Form","TermMonths":12,"SubscriptionLinesTo":"Contract",'
            + '"OneTimeLinesTo":"Order","RequireApprovalTaskTypeCode":null,'
            + '"CloseWonTasks":{"AssigneeEntityName":"MJ_BizApps_Common: People","AssigneeRecordID":null,"DueInDays":5}}',
        )).toBeNull();
        expect(CloseWonPolicyProblem('{"CreateContract":false,"OneTimeLinesTo":"Order"}')).toBeNull();
    });

    it('refuses JSON that does not parse, and says so', () => {
        expect(CloseWonPolicyProblem('{ "CreateContract": true,')).toMatch(/^Close Won Policy is not valid JSON/);
    });

    it('refuses JSON that is not an object', () => {
        expect(CloseWonPolicyProblem('[1, 2]')).toMatch(/must be a JSON object/);
        expect(CloseWonPolicyProblem('true')).toMatch(/must be a JSON object/);
    });

    it('refuses a key the close does not read, naming it', () => {
        expect(CloseWonPolicyProblem('{"CreateContrat":true}')).toContain('"CreateContrat"');
        expect(CloseWonPolicyProblem('{"CloseWonTasks":{"DueDays":5}}')).toContain('"DueDays"');
    });

    it('refuses a value of the wrong type', () => {
        expect(CloseWonPolicyProblem('{"CreateContract":"yes"}')).toContain('must be a boolean');
        expect(CloseWonPolicyProblem('{"TermMonths":"12"}')).toContain('must be a whole number');
        expect(CloseWonPolicyProblem('{"TermMonths":1.5}')).toContain('must be a whole number');
        expect(CloseWonPolicyProblem('{"CloseWonTasks":5}')).toContain('must be an object');
        expect(CloseWonPolicyProblem('{"CloseWonTasks":{"DueInDays":"5"}}')).toContain('must be a whole number');
    });

    it('refuses a routing value the close does not understand', () => {
        expect(CloseWonPolicyProblem('{"SubscriptionLinesTo":"Orders"}')).toContain('must be one of Contract, Subscription, None');
        expect(CloseWonPolicyProblem('{"OneTimeLinesTo":"order"}')).toContain('must be one of Order, Contract, None');
    });

    it('accepts null for any key', () => {
        expect(CloseWonPolicyProblem('{"CreateContract":null,"TermMonths":null,"SubscriptionLinesTo":null}')).toBeNull();
    });
});

/**
 * `Validate()` is what refuses the save: MJ writes only when its result is a success. `Object.create`
 * holds the entity without metadata, the way `StageBelongsToPipeline` does, so everything the method
 * reads is shadowed below, and the generated field checks are stubbed to pass.
 */
describe('PipelineEntityServer.Validate', () => {
    const RETIRED = '{"OrderState":"Draft"}';

    function pipeline(opts: { IsSaved: boolean; policyDirty: boolean; CloseWonPolicy: string | null }) {
        const instance = Object.create(PipelineEntityServer.prototype) as PipelineEntityServer;
        Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved });
        Object.defineProperty(instance, 'CloseWonPolicy', { value: opts.CloseWonPolicy });
        Object.defineProperty(instance, 'GetFieldByName', {
            value: (name: string) => (name === 'CloseWonPolicy' ? { Dirty: opts.policyDirty } : undefined),
        });
        return instance;
    }

    beforeEach(() => {
        vi.spyOn(mjBizAppsSalesPipelineEntity.prototype, 'Validate').mockImplementation(() => {
            const result = new ValidationResult();
            result.Success = true;
            return result;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('refuses a new pipeline whose policy the close would not honour', () => {
        const result = pipeline({ IsSaved: false, policyDirty: true, CloseWonPolicy: RETIRED }).Validate();
        expect(result.Success).toBe(false);
        expect(result.Errors.map((e) => e.Source)).toEqual(['CloseWonPolicy']);
        expect(result.Errors[0].Message).toContain('"OrderState"');
    });

    it('refuses a saved pipeline when the save changes the policy to one the close would not honour', () => {
        const result = pipeline({ IsSaved: true, policyDirty: true, CloseWonPolicy: RETIRED }).Validate();
        expect(result.Success).toBe(false);
        expect(result.Errors).toHaveLength(1);
    });

    it('passes a save of a saved pipeline that leaves an older policy as it was', () => {
        const result = pipeline({ IsSaved: true, policyDirty: false, CloseWonPolicy: RETIRED }).Validate();
        expect(result.Success).toBe(true);
        expect(result.Errors).toHaveLength(0);
    });

    it('passes a new pipeline with a valid policy', () => {
        const result = pipeline({ IsSaved: false, policyDirty: true, CloseWonPolicy: '{"CreateContract":true}' }).Validate();
        expect(result.Success).toBe(true);
    });
});
