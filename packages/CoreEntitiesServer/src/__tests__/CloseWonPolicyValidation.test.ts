import { describe, expect, it } from 'vitest';

import { CloseWonPolicyProblem } from '../PipelineEntityServer.js';

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
