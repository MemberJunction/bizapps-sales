import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A CLOSE-WON TASK IS NEVER ROUTED TO SOMEBODY WHO IS NOT THERE (bc-aidp-next-golive#326).
 *
 * `TaskAssignment.AssigneeRecordID` is polymorphic, so it carries no foreign key and the database
 * cannot refuse an assignment pointing at nobody. On QA that is exactly what shipped: the seeded
 * policy named a People id no migration creates, and fourteen tasks read as assigned while no queue
 * held them. A task routed to a ghost is WORSE than an unrouted one, because an unrouted one says so.
 *
 * Three states are pinned here rather than two. "Not there" refuses to route and explains itself.
 * "Could not tell" — a failed or throwing read — still routes, because a transient database problem
 * must not quietly stop routing a deployment that is configured correctly; that would trade this
 * defect for a worse one. Only the Issue is new in that case.
 *
 * `RunView` is stubbed at the module boundary because the service constructs its own, the same way
 * the sibling veto's tests do. Only the database is replaced.
 */
const runView = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, LogError: () => undefined, RunView: class { public RunView = runView; } };
});

const { CloseWonTaskService } = await import('../CloseWonTaskService.js');

const PEOPLE = 'MJ_BizApps_Common: People';
const PEOPLE_ENTITY_ID = 'e0000000-0000-4000-8000-000000000001';
/** The id the seeded policy actually carried. Not in People on QA. */
const GHOST = 'C0111111-0000-4000-A000-000000000004';
const REAL = 'c0000000-0000-4000-8000-000000000009';
const TASK = 'a0000000-0000-4000-8000-000000000001';
const USER = { ID: 'user-1' } as never;

afterEach(() => {
    runView.mockReset();
});

type Opts = {
    recordID?: string | null;
    exists?: boolean;
    readFails?: boolean;
    readThrows?: boolean;
    entityRegistered?: boolean;
};

function harness(opts: Opts) {
    const assignToTask = vi.fn(async () => ({ Get: () => 'assignment-1' }));
    const instance = Object.create(CloseWonTaskService.prototype) as Record<string, never>;
    Object.defineProperty(instance, 'assignments', { value: { assignToTask }, writable: true });

    runView.mockImplementation(async () => {
        if (opts.readThrows) throw new Error('connection reset');
        if (opts.readFails) return { Success: false, ErrorMessage: 'connection reset' };
        return { Success: true, TotalRowCount: opts.exists ? 1 : 0 };
    });

    const provider = {
        Entities: opts.entityRegistered === false ? [] : [{ Name: PEOPLE, ID: PEOPLE_ENTITY_ID }],
    };
    const result = { Success: true, Tasks: [], Issues: [] as string[] };
    const input = {
        Assignee:
            opts.recordID === null
                ? undefined
                : { EntityName: PEOPLE, RecordID: opts.recordID ?? GHOST },
        AssignedByPersonID: 'p1',
    };
    return { instance, assignToTask, provider, result, input };
}

async function route(h: ReturnType<typeof harness>): Promise<string | null> {
    const fn = (h.instance as unknown as Record<string, (...a: unknown[]) => Promise<string | null>>).route;
    return await fn.call(h.instance, TASK, h.input, h.provider, USER, h.result, 'OrderReview');
}

describe('routing a close-won task to its configured assignee', () => {
    it('routes when the assignee is a real record', async () => {
        const h = harness({ recordID: REAL, exists: true });
        expect(await route(h)).toBe('assignment-1');
        expect(h.assignToTask).toHaveBeenCalledTimes(1);
        expect(h.result.Issues).toEqual([]);
    });

    it('passes the entity resolved from the INJECTED provider, not a guess', async () => {
        const h = harness({ recordID: REAL, exists: true });
        await route(h);
        expect(h.assignToTask.mock.calls[0][0]).toMatchObject({
            taskID: TASK,
            assigneeEntityID: PEOPLE_ENTITY_ID,
            assigneeRecordID: REAL,
        });
    });

    it('REFUSES to route to a record that is not there, and says which one', async () => {
        const h = harness({ recordID: GHOST, exists: false });
        expect(await route(h)).toBeNull();
        expect(h.assignToTask).not.toHaveBeenCalled();
        const issue = h.result.Issues.join(' ');
        expect(issue).toContain(GHOST);
        expect(issue).toContain(PEOPLE);
        expect(issue).toContain('CloseWonTasks.AssigneeRecordID');
    });

    it('asks the database about existence rather than loading the person', async () => {
        const h = harness({ recordID: GHOST, exists: false });
        await route(h);
        expect(runView.mock.calls[0][0]).toMatchObject({
            EntityName: PEOPLE,
            ResultType: 'count_only',
        });
    });

    it('still routes when the check FAILS, and records that it could not tell', async () => {
        const h = harness({ recordID: REAL, readFails: true });
        expect(await route(h)).toBe('assignment-1');
        expect(h.assignToTask).toHaveBeenCalledTimes(1);
        expect(h.result.Issues.join(' ')).toContain('could not be verified');
    });

    it('still routes when the check THROWS, and records that it could not tell', async () => {
        const h = harness({ recordID: REAL, readThrows: true });
        expect(await route(h)).toBe('assignment-1');
        expect(h.assignToTask).toHaveBeenCalledTimes(1);
        expect(h.result.Issues.join(' ')).toContain('could not be verified');
    });

    it('does not look anything up when no assignee is configured', async () => {
        const h = harness({ recordID: null });
        expect(await route(h)).toBeNull();
        expect(runView).not.toHaveBeenCalled();
        expect(h.assignToTask).not.toHaveBeenCalled();
        expect(h.result.Issues.join(' ')).toContain('CloseWonTasks.AssigneeRecordID');
    });

    it('does not look anything up when the entity is not registered on this host', async () => {
        const h = harness({ recordID: REAL, entityRegistered: false });
        expect(await route(h)).toBeNull();
        expect(runView).not.toHaveBeenCalled();
        expect(h.assignToTask).not.toHaveBeenCalled();
        expect(h.result.Issues.join(' ')).toContain('is not registered on this host');
    });

    it('escapes a quote in the configured id rather than building broken SQL', async () => {
        const h = harness({ recordID: "abc' OR 1=1 --", exists: false });
        await route(h);
        expect(runView.mock.calls[0][0].ExtraFilter).toContain("abc'' OR 1=1 --");
    });
});
