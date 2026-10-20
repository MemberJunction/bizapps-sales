import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * THE ORDER-REVIEW TASK A WON DEAL RAISES CAN BE SWITCHED OFF, PER PIPELINE (bc-aidp-next-golive#320 §5).
 *
 * Every won deal raises ORDER_REVIEW against its order (S-US2). On a host where orders reviews by
 * trigger, an order a deal created confirms without review, and orders raises its own review task when
 * one is due, so sales' task asks finance to review an order nobody needs to. A pipeline's policy can
 * now say `CloseWonTasks.RaiseOrderReviewTask: false`. Absent keeps the task, so every other install
 * behaves as before; the contract-processing task is unaffected either way.
 *
 * `RunView` is stubbed at the module boundary, as in the routing suite, and the tasks services are
 * replaced on the instance. Only the database and the tasks app are stand-ins.
 */
const runView = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: () => undefined,
        LogStatus: () => undefined,
        RunView: class { public RunView = runView; },
    };
});

const { CloseWonTaskService, RaisesOrderReviewTask, ReadCloseWonTaskConfig } = await import('../CloseWonTaskService.js');
type Input = import('../CloseWonTaskService.js').CloseWonTaskInput;

const USER = { ID: 'user-1' } as never;
const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const ORDER = 'oooooooo-0000-4000-8000-000000000001';
const PIPELINE = 'pppppppp-0000-4000-8000-000000000001';

afterEach(() => runView.mockReset());

describe('reading the switch from a policy', () => {
    it.each([
        ['an absent CloseWonTasks', {}],
        ['an absent key', { CloseWonTasks: { DueInDays: 5 } }],
        ['true', { CloseWonTasks: { RaiseOrderReviewTask: true } }],
        ['null', { CloseWonTasks: { RaiseOrderReviewTask: null } }],
        ['the string "false", which is not the boolean', { CloseWonTasks: { RaiseOrderReviewTask: 'false' } }],
    ])('raises the task for %s', (_label, policy) => {
        expect(RaisesOrderReviewTask(ReadCloseWonTaskConfig(policy))).toBe(true);
    });

    it('skips the task only for the boolean false', () => {
        expect(RaisesOrderReviewTask(ReadCloseWonTaskConfig({ CloseWonTasks: { RaiseOrderReviewTask: false } }))).toBe(false);
    });

    it('raises the task when there is no policy at all', () => {
        expect(RaisesOrderReviewTask(ReadCloseWonTaskConfig(null))).toBe(true);
        expect(RaisesOrderReviewTask(undefined)).toBe(true);
    });

    it('reads the shipped pipeline policy JSON shape', () => {
        const shipped = JSON.parse(
            '{"CreateContract":false,"CloseWonTasks":{"AssigneeEntityName":"MJ_BizApps_Common: People","AssigneeRecordID":null,"DueInDays":5,"RaiseOrderReviewTask":false}}',
        ) as unknown;
        expect(RaisesOrderReviewTask(ReadCloseWonTaskConfig(shipped))).toBe(false);
    });
});

/** A service whose tasks app and database answer, and which records what it was asked to create. */
function harness(opts: { createContract: boolean; taskTypeReadFails?: boolean }) {
    const created: { Name: string; TypeID: string }[] = [];
    const instance = Object.create(CloseWonTaskService.prototype) as InstanceType<typeof CloseWonTaskService>;
    Object.defineProperty(instance, 'orchestration', {
        value: {
            CreateTask: vi.fn(async (task: { Name: string; TypeID: string }) => {
                created.push(task);
                return { ID: `task-${created.length}` };
            }),
        },
    });
    Object.defineProperty(instance, 'assignments', { value: { assignToTask: vi.fn() } });

    runView.mockImplementation(async (args: { EntityName: string; ExtraFilter: string }) => {
        if (args.EntityName === 'MJ_BizApps_Sales: Pipelines') {
            return { Success: true, Results: [{ CloseWonPolicy: JSON.stringify({ CreateContract: opts.createContract }) }] };
        }
        if (args.EntityName === 'MJ_BizApps_Tasks: Task Types') {
            if (opts.taskTypeReadFails) return { Success: false, ErrorMessage: 'task types are down' };
            const code = /'([^']+)'/.exec(args.ExtraFilter)?.[1];
            return { Success: true, Results: [{ ID: `type-${code}` }] };
        }
        return { Success: true, Results: [] };
    });

    const provider = {
        Entities: [
            { Name: 'MJ_BizApps_Tasks: Task Types', ID: 'e-tt', Fields: [{ Name: 'Code' }] },
            { Name: 'MJ_BizApps_Tasks: Task Links', ID: 'e-tl' },
            { Name: 'MJ_BizApps_Orders: Order Headers', ID: 'e-oh' },
            { Name: 'MJ_BizApps_Sales: Deals', ID: 'e-deal' },
        ],
        GetEntityObject: vi.fn(async () => ({
            NewRecord: () => undefined,
            Save: async () => true,
            LatestResult: null,
        })),
    } as never;
    return { instance, created, provider };
}

function input(overrides: Partial<Input> = {}): Input {
    return { DealID: DEAL, DealName: 'Acme renewal', OrderID: ORDER, PipelineID: PIPELINE, ...overrides };
}

function taskTypeReads(): string[] {
    return runView.mock.calls
        .map((c) => c[0] as { EntityName: string; ExtraFilter: string })
        .filter((a) => a.EntityName === 'MJ_BizApps_Tasks: Task Types')
        .map((a) => a.ExtraFilter);
}

describe('closing a won deal with the order-review task switched off', () => {
    it('raises no order-review task, and does not look its type up', async () => {
        const h = harness({ createContract: false });
        const result = await h.instance.CreateCloseWonTasks(input({ RaiseOrderReviewTask: false }), h.provider, USER);
        expect(result.Tasks.map((t) => t.Kind)).toEqual([]);
        expect(h.created).toEqual([]);
        expect(taskTypeReads()).toEqual([]);
    });

    it('reports nothing, since nothing was due', async () => {
        const h = harness({ createContract: false });
        const result = await h.instance.CreateCloseWonTasks(input({ RaiseOrderReviewTask: false }), h.provider, USER);
        expect(result.Success).toBe(true);
        expect(result.Issues).toEqual([]);
    });

    it('does not report a missing order as a task it could not raise', async () => {
        const h = harness({ createContract: false });
        const result = await h.instance.CreateCloseWonTasks(
            input({ OrderID: '', RaiseOrderReviewTask: false }),
            h.provider,
            USER,
        );
        expect(result.Issues.join(' ')).not.toContain('no order-review task was created');
        expect(result.Success).toBe(true);
    });

    it('still raises the contract-processing task when the pipeline creates a contract', async () => {
        const h = harness({ createContract: true });
        const result = await h.instance.CreateCloseWonTasks(input({ RaiseOrderReviewTask: false }), h.provider, USER);
        expect(result.Tasks.map((t) => t.Kind)).toEqual(['ContractProcessing']);
        expect(h.created.map((t) => t.TypeID)).toEqual(['type-CONTRACT_PROCESSING']);
    });
});

describe('closing a won deal with the switch left alone', () => {
    it('raises the order-review task, as every install always has', async () => {
        const h = harness({ createContract: false });
        const result = await h.instance.CreateCloseWonTasks(input(), h.provider, USER);
        expect(result.Tasks.map((t) => t.Kind)).toEqual(['OrderReview']);
        expect(h.created.map((t) => t.TypeID)).toEqual(['type-ORDER_REVIEW']);
    });

    it('raises it when the switch is explicitly on', async () => {
        const h = harness({ createContract: true });
        const result = await h.instance.CreateCloseWonTasks(input({ RaiseOrderReviewTask: true }), h.provider, USER);
        expect(result.Tasks.map((t) => t.Kind)).toEqual(['OrderReview', 'ContractProcessing']);
    });

    it('still reports a missing order, because a task was due and could not be raised', async () => {
        const h = harness({ createContract: false });
        const result = await h.instance.CreateCloseWonTasks(input({ OrderID: '' }), h.provider, USER);
        expect(result.Success).toBe(false);
        expect(result.Issues.join(' ')).toContain('no order-review task was created');
    });

    it('still reports a task-type read that fails', async () => {
        const h = harness({ createContract: false, taskTypeReadFails: true });
        const result = await h.instance.CreateCloseWonTasks(input(), h.provider, USER);
        expect(result.Success).toBe(false);
        expect(result.Issues.join(' ')).toContain('task types are down');
    });
});
