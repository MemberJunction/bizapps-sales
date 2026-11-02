import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { CloseDealOperation } from '../CloseDealOperation.js';
import {
    CLOSE_WON_ASSIGNEE_ENTITY,
    CloseWonTaskService,
    ReadCloseWonTaskConfig,
    WithPipelineAssignee,
    type CloseWonTaskInput,
} from '../CloseWonTaskService.js';

/**
 * THE PIPELINE'S ASSIGNEE COLUMN OUTRANKS THE ASSIGNEE IN ITS JSON (bc-aidp-next-golive#326).
 *
 * The default pipelines ship in metadata with `CloseWonTasks.AssigneeRecordID` null, and a metadata
 * push writes that back over the database, so an assignee set in the JSON is lost on the next install.
 * `Pipeline.CloseWonAssigneePersonID` is not in the metadata files. These checks pin that a won close
 * routes to the column when it is set, to the JSON when it is not, and to nobody when neither is.
 *
 * `resolvePolicy` runs for real against a stubbed pipeline read, as in CloseWonTaskPolicyOverride.
 */

const WON = { ID: 'won', IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true };
const NO_CLOSING = { StageID: null, Probability: 100, ForecastCategoryTypeID: null, Issues: [] as never[] };

const COLUMN_PERSON = 'aaaaaaaa-0000-4000-a000-000000000001';
const JSON_PERSON = 'bbbbbbbb-0000-4000-a000-000000000002';
const ROLE = 'cccccccc-0000-4000-a000-000000000003';

afterEach(() => {
    vi.restoreAllMocks();
});

interface PipelineRow {
    CloseWonPolicy: string | null;
    CloseWonAssigneePersonID: string | null;
}

async function wonClose(row: PipelineRow) {
    let taskInput: CloseWonTaskInput | null = null;
    const fieldsRead: string[][] = [];
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(CloseWonTaskService.prototype, 'CreateCloseWonTasks').mockImplementation(async (input) => {
        taskInput = input;
        return { Success: true, Tasks: [], Issues: [] };
    });

    const deal = {
        ID: 'd1', Name: 'Assignee win', DealNumber: 'D-1', CompanyID: 'c1', PipelineID: 'p1', OrderID: 'o1',
        ContractID: null, AccountID: 'a1', DealStatusTypeID: null, PipelineStageID: null,
        LossReasonID: null, LossNotes: null, ClosedAt: null, ClosedByUserID: null, ActualCloseDate: null,
        OrderStatusWarnings: [], LastStageEventID: 'e1',
        DeclareTransition: () => undefined,
        Load: async () => true,
        Save: async () => true,
        BeginClose: async <T>(body: () => Promise<T>): Promise<T> => body(),
    };
    const provider = {
        GetEntityObject: async () => deal,
        BeginTransaction: async () => undefined,
        CommitTransaction: async () => undefined,
        RollbackTransaction: async () => undefined,
        RunView: async (params: { Fields?: string[] }) => {
            fieldsRead.push(params.Fields ?? []);
            return { Success: true, Results: [row] };
        },
    };

    const op = new CloseDealOperation() as unknown as Record<string, unknown> & {
        InternalExecute(input: unknown, provider: unknown, user: unknown): Promise<{ Success: boolean }>;
    };
    op.loadStatusFlags = async () => WON;
    op.validate = async () => ({ Issues: [], LossReasonName: null, RenewalNextTerm: [] });
    op.planRouting = async () => [];
    op.resolveClosing = async () => NO_CLOSING;

    const result = await op.InternalExecute({ DealID: 'd1', DealStatusTypeID: WON.ID }, provider, { ID: 'u1' });
    expect(result.Success, 'the close itself must run').toBe(true);
    return { taskInput: taskInput as CloseWonTaskInput | null, fieldsRead };
}

function policyWithAssignee(recordID: string | null): string {
    return JSON.stringify({
        CreateContract: false,
        CloseWonTasks: {
            AssigneeEntityName: CLOSE_WON_ASSIGNEE_ENTITY,
            AssigneeRecordID: recordID,
            AssigneeRoleID: ROLE,
            DueInDays: 5,
        },
    });
}

describe('who a won close routes its tasks to', () => {
    it('reads the assignee column in the same pipeline read as the policy', async () => {
        const { fieldsRead } = await wonClose({ CloseWonPolicy: policyWithAssignee(null), CloseWonAssigneePersonID: null });
        expect(fieldsRead.some((f) => f.includes('CloseWonPolicy') && f.includes('CloseWonAssigneePersonID'))).toBe(true);
    });

    it('takes the column over the JSON, keeping the role from the JSON', async () => {
        const { taskInput } = await wonClose({
            CloseWonPolicy: policyWithAssignee(JSON_PERSON),
            CloseWonAssigneePersonID: COLUMN_PERSON,
        });
        expect(taskInput?.Assignee).toEqual({
            EntityName: CLOSE_WON_ASSIGNEE_ENTITY,
            RecordID: COLUMN_PERSON,
            RoleID: ROLE,
        });
    });

    it('takes the column when the shipped JSON has no assignee, which is the upgrade case', async () => {
        const { taskInput } = await wonClose({
            CloseWonPolicy: policyWithAssignee(null),
            CloseWonAssigneePersonID: COLUMN_PERSON,
        });
        expect(taskInput?.Assignee?.RecordID).toBe(COLUMN_PERSON);
    });

    it('falls back to the JSON assignee when the column is empty', async () => {
        const { taskInput } = await wonClose({
            CloseWonPolicy: policyWithAssignee(JSON_PERSON),
            CloseWonAssigneePersonID: null,
        });
        expect(taskInput?.Assignee?.RecordID).toBe(JSON_PERSON);
    });

    it('routes to nobody when neither is set, so the close reports the tasks unrouted', async () => {
        const { taskInput } = await wonClose({ CloseWonPolicy: policyWithAssignee(null), CloseWonAssigneePersonID: null });
        expect(taskInput).not.toBeNull();
        expect(taskInput?.Assignee).toBeUndefined();
    });

    it('takes the column when the pipeline has no policy at all', async () => {
        const { taskInput } = await wonClose({ CloseWonPolicy: null, CloseWonAssigneePersonID: COLUMN_PERSON });
        expect(taskInput?.Assignee?.RecordID).toBe(COLUMN_PERSON);
        expect(taskInput?.Assignee?.EntityName).toBe(CLOSE_WON_ASSIGNEE_ENTITY);
    });
});

describe('WithPipelineAssignee', () => {
    it('returns the policy unchanged when the column is empty', () => {
        const policy = { CreateContract: true, CloseWonTasks: { AssigneeRecordID: JSON_PERSON } };
        expect(WithPipelineAssignee(policy, null)).toBe(policy);
        expect(WithPipelineAssignee(policy, '')).toBe(policy);
    });

    it('replaces only the assignee and keeps the other task settings', () => {
        const policy = {
            CreateContract: true,
            CloseWonTasks: { AssigneeEntityName: 'Somewhere Else', AssigneeRecordID: JSON_PERSON, DueInDays: 2, RaiseOrderReviewTask: false },
        };
        const merged = WithPipelineAssignee(policy, COLUMN_PERSON);
        expect(merged.CreateContract).toBe(true);
        expect(ReadCloseWonTaskConfig(merged)).toEqual({
            AssigneeEntityName: CLOSE_WON_ASSIGNEE_ENTITY,
            AssigneeRecordID: COLUMN_PERSON,
            DueInDays: 2,
            RaiseOrderReviewTask: false,
        });
        expect(ReadCloseWonTaskConfig(policy).AssigneeRecordID, 'the input is not mutated').toBe(JSON_PERSON);
    });
});
