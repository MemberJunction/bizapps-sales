import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A RE-CLOSE MUST NOT RAISE THE ORDER-REVIEW TASK TWICE (bc-aidp-next-golive#324).
 *
 * DEAL-002148 was closed Won, reopened, and closed Won again. The second close did not need a second
 * Order Review task — the first was still in finance's queue — but the service tried anyway, and the
 * attempt came back as a raw mssql error that `raise` printed onto the close panel, SQL and all.
 *
 * These drive the real service against a stubbed `RunView` and a stubbed tasks orchestration, the way
 * `DealLockOrderLineVeto.test.ts` does, so the lookup chain and the failure text are both real code.
 */

const runView = vi.fn();
const createTask = vi.fn();
const assignToTask = vi.fn(async () => ({ ID: 'assignment-1' }));

vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: () => undefined,
        LogStatus: () => undefined,
        RunView: class { public RunView = runView; },
    };
});
vi.mock('@mj-biz-apps/tasks-core', () => ({
    TaskOrchestrationService: class { public CreateTask = createTask; },
    TaskAssignmentService: class { public assignToTask = assignToTask; },
}));

const { CloseWonTaskService } = await import('../CloseWonTaskService.js');

const E_TASK_TYPE = 'MJ_BizApps_Tasks: Task Types';
const E_TASK_LINK = 'MJ_BizApps_Tasks: Task Links';
const E_TASK = 'MJ_BizApps_Tasks: Tasks';
const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_ORDER = 'MJ_BizApps_Orders: Order Headers';

const ORDER = 'oooooooo-0000-4000-8000-000000000001';
const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const PIPELINE = 'pppppppp-0000-4000-8000-000000000001';
const TYPE_ORDER_REVIEW = 'tttttttt-0000-4000-8000-00000000rev1';
const EXISTING_TASK = 'aaaaaaaa-0000-4000-8000-00000000task';
const USER = { ID: 'user-1' } as never;

/** A provider whose metadata is just enough for the service to resolve what it reads. */
const provider = {
    Entities: [
        { Name: E_TASK_TYPE, ID: 'e-tasktype', Fields: [{ Name: 'Code' }] },
        { Name: E_ORDER, ID: 'e-order', Fields: [] },
        { Name: 'MJ_BizApps_Sales: Deals', ID: 'e-deal', Fields: [] },
        { Name: E_TASK_LINK, ID: 'e-tasklink', Fields: [] },
    ],
    GetEntityObject: async () => ({ NewRecord: () => undefined, Save: async () => true, ID: 'link-1' }),
} as never;

const input = {
    DealID: DEAL,
    DealName: 'ZZ TEST deal',
    OrderID: ORDER,
    PipelineID: PIPELINE,
    DueAt: new Date('2026-10-13T00:00:00Z'),
} as never;

/**
 * @param links what `Task Links` returns for the order.
 * @param tasks what `Tasks` returns for those link ids, already filtered by type.
 */
function withReads(
    links: { TaskID: string }[],
    tasks: { ID: string }[],
    fail?: 'links' | 'tasks',
    onlyEntity?: string,
) {
    runView.mockImplementation(async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter?: string }) => {
        if (EntityName === E_TASK_TYPE) return { Success: true, Results: [{ ID: TYPE_ORDER_REVIEW }] };
        if (EntityName === E_PIPELINE) return { Success: true, Results: [{ CloseWonPolicy: null }] };
        if (EntityName === E_TASK_LINK) {
            if (fail === 'links') return { Success: false, ErrorMessage: 'links down', Results: [] };
            // The filter ORs one clause per target; `onlyEntity` pins which of them actually carries
            // the link, so a test can put it on the deal and ask with the order as primary.
            if (onlyEntity && !String(ExtraFilter ?? '').includes(onlyEntity)) {
                return { Success: true, Results: [] };
            }
            return { Success: true, Results: links };
        }
        if (EntityName === E_TASK) {
            return fail === 'tasks'
                ? { Success: false, ErrorMessage: 'tasks down', Results: [] }
                : { Success: true, Results: tasks };
        }
        return { Success: true, Results: [] };
    });
}

const run = () => new CloseWonTaskService().CreateCloseWonTasks(input, provider, USER);

afterEach(() => {
    runView.mockReset();
    createTask.mockReset();
});

describe('a re-close where the order-review task already exists', () => {
    it('does not create a second one', async () => {
        withReads([{ TaskID: EXISTING_TASK }], [{ ID: EXISTING_TASK }]);
        await run();
        expect(createTask).not.toHaveBeenCalled();
    });

    it('reports the task it found, flagged as pre-existing', async () => {
        withReads([{ TaskID: EXISTING_TASK }], [{ ID: EXISTING_TASK }]);
        const out = await run();
        const review = out.Tasks.find((t) => t.Kind === 'OrderReview');
        expect(review?.TaskID).toBe(EXISTING_TASK);
        expect(review?.AlreadyExisted, 'found, not raised').toBe(true);
    });

    /** The whole point of the issue: the close panel said plenty, none of it useful. */
    it('says nothing on the close panel', async () => {
        withReads([{ TaskID: EXISTING_TASK }], [{ ID: EXISTING_TASK }]);
        const out = await run();
        expect(out.Issues).toEqual([]);
        expect(out.Success).toBe(true);
    });
});

/**
 * THE PRIMARY TARGET MOVES BETWEEN CLOSES, so the lookup asks about all of them.
 *
 * The contract task points at the contract when there is one and falls back to the deal when there
 * is not, so a first close that ran before the contract existed links the DEAL. Asking only about
 * the primary would miss that task on the re-close and raise the duplicate anyway.
 */
describe('a task linked to a secondary target', () => {
    it('is still found when the primary is something else', async () => {
        // The link exists only on the DEAL entity; the order-review primary is the ORDER.
        withReads([{ TaskID: EXISTING_TASK }], [{ ID: EXISTING_TASK }], undefined, 'e-deal');
        const out = await run();
        expect(createTask).not.toHaveBeenCalled();
        expect(out.Tasks.find((t) => t.Kind === 'OrderReview')?.AlreadyExisted).toBe(true);
    });

    it('asks about every target in one read, not one per target', async () => {
        withReads([{ TaskID: EXISTING_TASK }], [{ ID: EXISTING_TASK }]);
        await run();
        const linkReads = runView.mock.calls.filter((c) => c[0]?.EntityName === E_TASK_LINK);
        expect(linkReads.length, 'two targets must still cost one link read').toBe(1);
        expect(linkReads[0][0].ExtraFilter, 'both targets in the filter').toContain(' OR ');
    });
});

describe('a first close, with no task on the order yet', () => {
    it('creates one, flagged as newly raised', async () => {
        withReads([], []);
        createTask.mockResolvedValue({ ID: 'new-task' });
        const out = await run();
        expect(createTask).toHaveBeenCalledTimes(1);
        expect(out.Tasks.find((t) => t.Kind === 'OrderReview')?.AlreadyExisted).toBe(false);
    });

    /** A link to the order exists, but for some OTHER kind of task. That must not suppress this one. */
    it('creates one when the record carries only a different type of task', async () => {
        withReads([{ TaskID: 'some-other-task' }], []);
        createTask.mockResolvedValue({ ID: 'new-task' });
        await run();
        expect(createTask).toHaveBeenCalledTimes(1);
    });
});

/**
 * A LOOKUP THAT FAILS CREATES THE TASK. Not knowing costs a duplicate row in a queue someone closes;
 * refusing would cost finance the task entirely. That is the opposite trade from the confirm veto
 * next door, and deliberately so.
 */
describe('when the lookup cannot be read', () => {
    it('still creates the task when the links read fails', async () => {
        withReads([], [], 'links');
        createTask.mockResolvedValue({ ID: 'new-task' });
        await run();
        expect(createTask).toHaveBeenCalledTimes(1);
    });

    it('still creates the task when the tasks read fails', async () => {
        withReads([{ TaskID: EXISTING_TASK }], [], 'tasks');
        createTask.mockResolvedValue({ ID: 'new-task' });
        await run();
        expect(createTask).toHaveBeenCalledTimes(1);
    });
});

/**
 * NO SQL ON THE CLOSE PANEL. Tasks' own failure text carries the entity's `CompleteMessage`, which
 * carries the failing statement. Interpolating the thrown error put a `DECLARE @ID_...` dump in front
 * of whoever closed the deal.
 */
describe('when creating the task genuinely fails', () => {
    const SQL = 'Error executing SQL Error: Requests can only be made in the LoggedIn state, not the '
        + 'SentClientRequest state Query: DECLARE @ID_abc UNIQUEIDENTIFIER, @Name_abc NVARCHAR(255)';
    const thrown = () => new Error(`Failed to create task "Review order": ${SQL}`);

    it('keeps the database error off the panel', async () => {
        withReads([], []);
        createTask.mockRejectedValue(thrown());
        const out = await run();
        const text = out.Issues.join(' ');
        expect(text).not.toContain('DECLARE');
        expect(text).not.toContain('SentClientRequest');
        expect(text).not.toContain('Query:');
    });

    it('still says what did not happen, and that the close is fine', async () => {
        withReads([], []);
        createTask.mockRejectedValue(thrown());
        const out = await run();
        const text = out.Issues.join(' ');
        expect(text).toContain('could not be created');
        expect(text, 'a rep needs to know the close itself held').toContain('close itself is unaffected');
        expect(out.Success).toBe(false);
    });
});
