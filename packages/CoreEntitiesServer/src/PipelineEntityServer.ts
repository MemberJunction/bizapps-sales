/**
 * @fileoverview A pipeline's Close Won Policy is checked when it is saved (bizapps-sales#448).
 *
 * The policy is JSON typed into a text box. `Sales.CloseDeal` reads it at every won close, and when it
 * does not parse the close logs one line and routes with the defaults: no contract, default line
 * routing, no tasks. Nobody who closes the deal is told. Refusing the save puts the problem in front of
 * the person who typed it, while they can still fix it.
 *
 * ── WHAT IS CHECKED ────────────────────────────────────────────────────────────────────────────────
 *
 * The JSON parses to an object; every key is one the close reads (`SalesCloseWonPolicy`, plus the
 * `CloseWonTasks` block `CloseWonTaskService` reads); every value has that key's type; the two routing
 * keys hold one of the values the close understands. Nothing is looked up in the database: a contract
 * type CODE or an assignee ID that names no row is the close's own problem to report.
 *
 * ── ONLY WHEN THE POLICY CHANGES ───────────────────────────────────────────────────────────────────
 *
 * A pipeline saved before this check may carry a retired key (`OrderState`, a task-type ID). The close
 * ignores those, so they are harmless, and refusing every later edit of such a pipeline (a rename, say)
 * would block work that has nothing to do with the policy. The check runs on a new pipeline and on a
 * save that changes the policy.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsSalesPipelineEntity } from '@mj-biz-apps/sales-entities';

const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';

type ValueKind = 'boolean' | 'text' | 'whole number' | 'object';

/** One key the close reads: what its value must be, and (for routing keys) which values it accepts. */
interface PolicyKey {
    Kind: ValueKind;
    OneOf?: readonly string[];
}

/** The keys of `SalesCloseWonPolicy` and the `CloseWonTasks` block. Each may also be null. */
const POLICY_KEYS: Record<string, PolicyKey> = {
    CreateContract: { Kind: 'boolean' },
    ContractTypeCode: { Kind: 'text' },
    TermMonths: { Kind: 'whole number' },
    SubscriptionLinesTo: { Kind: 'text', OneOf: ['Contract', 'Subscription', 'None'] },
    OneTimeLinesTo: { Kind: 'text', OneOf: ['Order', 'Contract', 'None'] },
    RequireApprovalTaskTypeCode: { Kind: 'text' },
    CloseWonTasks: { Kind: 'object' },
};

const TASK_KEYS: Record<string, PolicyKey> = {
    AssigneeEntityName: { Kind: 'text' },
    AssigneeRecordID: { Kind: 'text' },
    AssigneeRoleID: { Kind: 'text' },
    DueInDays: { Kind: 'whole number' },
    RaiseOrderReviewTask: { Kind: 'boolean' },
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKind(value: unknown, kind: ValueKind): boolean {
    switch (kind) {
        case 'boolean':
            return typeof value === 'boolean';
        case 'text':
            return typeof value === 'string';
        case 'whole number':
            return typeof value === 'number' && Number.isInteger(value);
        case 'object':
            return isObject(value);
    }
}

/** The first problem with one block's keys, or null. `where` names the block in the message. */
function keyProblem(block: Record<string, unknown>, keys: Record<string, PolicyKey>, where: string): string | null {
    for (const [name, value] of Object.entries(block)) {
        const rule = keys[name];
        if (!rule) {
            return `${where} has a setting the close does not use: "${name}". Allowed: ${Object.keys(keys).join(', ')}.`;
        }
        if (value === null) {
            continue;
        }
        if (!hasKind(value, rule.Kind)) {
            return `${where} setting "${name}" must be ${rule.Kind === 'object' ? 'an object' : `a ${rule.Kind}`}.`;
        }
        if (rule.OneOf && !rule.OneOf.includes(value as string)) {
            return `${where} setting "${name}" must be one of ${rule.OneOf.join(', ')}; it is "${String(value)}".`;
        }
    }
    return null;
}

/**
 * Why a Close Won Policy would not be honoured as written, or null when it would. Empty is valid: the
 * close then uses its defaults, which is what an empty policy means.
 */
export function CloseWonPolicyProblem(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined || raw.trim() === '') {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return `Close Won Policy is not valid JSON (${e instanceof Error ? e.message : String(e)}).`;
    }
    if (!isObject(parsed)) {
        return 'Close Won Policy must be a JSON object, such as {"CreateContract": true}.';
    }
    const top = keyProblem(parsed, POLICY_KEYS, 'Close Won Policy');
    if (top) {
        return top;
    }
    return isObject(parsed['CloseWonTasks']) ? keyProblem(parsed['CloseWonTasks'], TASK_KEYS, 'Close Won Policy CloseWonTasks') : null;
}

@RegisterClass(BaseEntity, PIPELINE_ENTITY)
export class PipelineEntityServer extends mjBizAppsSalesPipelineEntity {
    /**
     * @remarks `super.Validate()` carries the generated field checks, so its result is built upon rather
     * than replaced.
     */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        const field = this.GetFieldByName('CloseWonPolicy');
        if (this.IsSaved && !field?.Dirty) {
            return result;
        }
        const problem = CloseWonPolicyProblem(this.CloseWonPolicy);
        if (problem) {
            result.Success = false;
            result.Errors.push(new ValidationErrorInfo('CloseWonPolicy', problem, this.CloseWonPolicy, ValidationErrorType.Failure));
        }
        return result;
    }
}
