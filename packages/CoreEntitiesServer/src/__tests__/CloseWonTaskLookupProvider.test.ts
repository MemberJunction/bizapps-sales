import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * THE DUPLICATE-TASK LOOKUP READS ON THE CLOSE'S OWN CONNECTION.
 *
 * `Sales.CloseDeal` raises its tasks inside one transaction. When the contract task is checked for a
 * duplicate, the order-review task and its links are already written there and not committed. A read
 * on the global provider's connection waited on those locks until the 30 s request timeout, so every
 * Close Won that raised both tasks stalled 30 s and the browser saw a GraphQL 504 while the close
 * still committed. These record which provider each `RunView` was built with, per entity read.
 */

const runView = vi.fn();
const constructedWith: { provider: unknown; entity?: string }[] = [];
const createTask = vi.fn(async () => ({ ID: 'task-new' }));

vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: () => undefined,
        LogStatus: () => undefined,
        RunView: class {
            private readonly record: { provider: unknown; entity?: string };
            constructor(provider?: unknown) {
                this.record = { provider };
                constructedWith.push(this.record);
            }
            public RunView = async (params: { EntityName: string }, user: unknown) => {
                this.record.entity = params.EntityName;
                return runView(params, user);
            };
        },
    };
});
vi.mock('@mj-biz-apps/tasks-core', () => ({
    TaskOrchestrationService: class { public CreateTask = createTask; },
    TaskAssignmentService: class { public assignToTask = async () => ({ ID: 'assignment-1' }); },
}));

const { CloseWonTaskService } = await import('../CloseWonTaskService.js');

const E_TASK_TYPE = 'MJ_BizApps_Tasks: Task Types';
const E_TASK_LINK = 'MJ_BizApps_Tasks: Task Links';
const E_TASK = 'MJ_BizApps_Tasks: Tasks';
const USER = { ID: 'user-1' } as never;

/** The close's transaction provider: the object `CloseDealOperation` hands the service. */
const provider = {
    Entities: [
        { Name: E_TASK_TYPE, ID: 'e-tasktype', Fields: [{ Name: 'Code' }] },
        { Name: 'MJ_BizApps_Orders: Order Headers', ID: 'e-order', Fields: [] },
        { Name: 'MJ_BizApps_Sales: Deals', ID: 'e-deal', Fields: [] },
        { Name: 'MJ_BizApps_Contracts: Contracts', ID: 'e-contract', Fields: [] },
        { Name: E_TASK_LINK, ID: 'e-tasklink', Fields: [] },
    ],
    GetEntityObject: async () => ({ NewRecord: () => undefined, Save: async () => true, ID: 'link-1' }),
};

const input = {
    DealID: 'dddddddd-0000-4000-8000-000000000001',
    DealName: 'ZZ TEST deal',
    OrderID: 'oooooooo-0000-4000-8000-000000000001',
    CreateContract: true,
    ContractID: 'cccccccc-0000-4000-8000-000000000001',
    DueAt: new Date('2026-11-05T00:00:00Z'),
} as never;

/** One prior link, so the lookup makes both of its reads. */
function withReads(): void {
    runView.mockImplementation(async ({ EntityName }: { EntityName: string }) => {
        if (EntityName === E_TASK_TYPE) return { Success: true, Results: [{ ID: 'type-1' }] };
        if (EntityName === E_TASK_LINK) return { Success: true, Results: [{ TaskID: 'other-task' }] };
        if (EntityName === E_TASK) return { Success: true, Results: [] };
        return { Success: true, Results: [] };
    });
}

afterEach(() => {
    runView.mockReset();
    createTask.mockClear();
    constructedWith.length = 0;
});

describe('the duplicate-task lookup inside a close', () => {
    it('reads task links through the injected provider', async () => {
        withReads();
        await new CloseWonTaskService().CreateCloseWonTasks(input, provider as never, USER);
        const linkReads = constructedWith.filter((r) => r.entity === E_TASK_LINK);
        expect(linkReads.length, 'one link read per task raised').toBeGreaterThanOrEqual(2);
        for (const read of linkReads) {
            expect(read.provider, 'not the global provider').toBe(provider);
        }
    });

    it('reads tasks through the injected provider', async () => {
        withReads();
        await new CloseWonTaskService().CreateCloseWonTasks(input, provider as never, USER);
        const taskReads = constructedWith.filter((r) => r.entity === E_TASK);
        expect(taskReads.length).toBeGreaterThanOrEqual(2);
        for (const read of taskReads) {
            expect(read.provider, 'not the global provider').toBe(provider);
        }
    });

    it('still raises both tasks when neither exists', async () => {
        withReads();
        await new CloseWonTaskService().CreateCloseWonTasks(input, provider as never, USER);
        expect(createTask).toHaveBeenCalledTimes(2);
    });
});
