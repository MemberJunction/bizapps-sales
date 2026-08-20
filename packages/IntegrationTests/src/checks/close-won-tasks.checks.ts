/**
 * @fileoverview `close-won-tasks` — WT1–WT6. The finance tasks a won deal raises (S-US2 #34, S-US3 #35).
 *
 * Every assertion reads what TASKS wrote, through tasks' own entities, rather than trusting the result
 * object the service returned. A service that reports `Success: true` and writes nothing is the failure
 * these are for.
 *
 * ── WHY THE TASK TYPE IS SEEDED BY THE CHECK, NOT LOOKED UP BY NAME ─────────────────────────────────
 *
 * `TaskType` carries no `Code` and no behaviour flag — only `Name` — so there is no vocabulary-safe way
 * to ask for "the order-review type". The service takes the ID as input for exactly that reason, and
 * these checks mirror it: each one DISCOVERS an arbitrary active type and asserts the task came back
 * carrying **the type it was handed**. That is the testable claim. Asserting a particular type would be
 * asserting a seed that does not exist yet.
 *
 * ⚠️ **REQUIRES bizapps-tasks**, and refuses to run without it rather than passing vacuously — the same
 * discipline `close-won-contract` uses.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView, type DatabaseProviderBase } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { CloseWonTaskService, type CloseWonTaskInput } from '@mj-biz-apps/sales-core-entities-server';

import { InRolledBackTransaction, ProviderOf, ResolveSalesFixture, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_TASK = 'MJ_BizApps_Tasks: Tasks';
const E_TASK_LINK = 'MJ_BizApps_Tasks: Task Links';
const E_TASK_ASSIGNMENT = 'MJ_BizApps_Tasks: Task Assignments';
const E_TASK_TYPE = 'MJ_BizApps_Tasks: Task Types';
const E_TASK_ROLE = 'MJ_BizApps_Tasks: Task Roles';
const E_PEOPLE = 'MJ_BizApps_Common: People';
const E_ORDER = 'MJ_BizApps_Orders: Order Headers';
const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/**
 * Refuses the run when tasks is absent, instead of quietly passing.
 *
 * This bundle is gated on `requires: "tasks"`, so reaching it at all means the app was resolved — but a
 * resolved package whose entities never registered would otherwise fail deep inside a save.
 */
function requireTasks(ctx: Ctx): void {
    Assert(
        !!ProviderOf(ctx).Entities.find((e) => e.Name === E_TASK),
        'bizapps-tasks entities are NOT registered on this host, so these checks cannot prove anything. '
            + 'Run this bundle only against a stack that includes tasks. (Reporting a pass here would be a '
            + 'vacuous one.)',
    );
}

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** One row's ID from an entity, chosen by a non-name rule so the fixture cannot drift onto a label. */
async function anyID(ctx: Ctx, entity: string, filter: string, what: string): Promise<string> {
    const found = await rows(ctx, entity, filter);
    Assert(found.length > 0, `setup: no ${what} on this host (${entity} where ${filter})`);
    return String(found[0]['ID']);
}

/** The entity-registry ID for a name — what `TaskLink.EntityID` and `TaskAssignment.AssigneeEntityID` hold. */
function entityID(ctx: Ctx, name: string): string {
    const e = ProviderOf(ctx).Entities.find((x) => x.Name === name);
    Assert(!!e, `setup: entity '${name}' is not registered on this host`);
    return e!.ID;
}

/** A deal on a pipeline whose policy carries the given `CreateContract` flag — by FLAG, never by name. */
async function dealOnPolicy(ctx: Ctx, createsContract: boolean): Promise<{ DealID: string; PipelineID: string }> {
    const pipelines = await rows(ctx, 'MJ_BizApps_Sales: Pipelines', 'IsActive = 1');
    const match = pipelines.find((p) => {
        const raw = p['CloseWonPolicy'];
        if (typeof raw !== 'string' || !raw) return createsContract === false;
        try {
            return (JSON.parse(raw) as { CreateContract?: boolean }).CreateContract === createsContract;
        } catch {
            return false;
        }
    });
    Assert(!!match, `setup: no active pipeline whose policy has CreateContract = ${createsContract}`);
    const pipelineID = String(match!['ID']);

    const deals = await rows(ctx, E_DEAL, `PipelineID = '${pipelineID}'`);
    Assert(deals.length > 0, `setup: no deal on the pipeline with CreateContract = ${createsContract}`);
    return { DealID: String(deals[0]['ID']), PipelineID: pipelineID };
}

/** The service input every check starts from. Each one overrides only what it is testing. */
async function baseInput(ctx: Ctx, createsContract: boolean): Promise<CloseWonTaskInput> {
    const f = await ResolveSalesFixture(ctx);
    const { DealID, PipelineID } = await dealOnPolicy(ctx, createsContract);
    const orderID = await anyID(ctx, E_ORDER, `CompanyID = '${f.PipelineCompanyID}'`, 'order');
    const typeID = await anyID(ctx, E_TASK_TYPE, 'IsActive = 1', 'active task type');
    const roleID = await anyID(ctx, E_TASK_ROLE, 'ID IS NOT NULL', 'task role');
    const personID = await anyID(ctx, E_PEOPLE, 'ID IS NOT NULL', 'person');

    return {
        DealID,
        OrderID: orderID,
        PipelineID,
        OrderReviewTaskTypeID: typeID,
        ContractTaskTypeID: typeID,
        Assignee: { EntityName: E_PEOPLE, RecordID: personID, RoleID: roleID },
    };
}

const service = new CloseWonTaskService();

export const CloseWonTasksChecks: NamedCheck[] = [
    {
        Id: 'close-won-tasks.WT1',
        Name: 'WT1: an order-review task is created, typed as asked, and linked to the ORDER',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireTasks(ctx);
                const input = await baseInput(ctx, false);
                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);

                Assert(out.Success, `the service reported failure — ${out.Issues.join(' | ')}`);
                const review = out.Tasks.find((t) => t.Kind === 'OrderReview');
                Assert(!!review, 'no order-review task was reported');

                // Read the ROW, not the result object: a service can report an ID it never wrote.
                const [task] = await rows(ctx, E_TASK, `ID = '${review!.TaskID}'`);
                Assert(!!task, 'the reported task ID does not resolve to a row');
                AssertEqual(
                    String(task['TypeID']).toLowerCase(),
                    input.OrderReviewTaskTypeID.toLowerCase(),
                    'the task must carry the type it was HANDED — the service must not choose one',
                );

                const links = await rows(ctx, E_TASK_LINK, `TaskID = '${review!.TaskID}'`);
                AssertEqual(links.length, 1, 'exactly one link');
                AssertEqual(
                    String(links[0]['EntityID']).toLowerCase(),
                    entityID(ctx, E_ORDER).toLowerCase(),
                    'the link must point at the ORDER entity — this task is how finance finds the order',
                );
                AssertEqual(
                    String(links[0]['RecordID']).toLowerCase(),
                    input.OrderID.toLowerCase(),
                    'and at the deal\'s own order',
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT2',
        Name: 'WT2: the order-review task is ROUTED — an assignment exists with the role it was given',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireTasks(ctx);
                const input = await baseInput(ctx, false);
                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                Assert(out.Success, `the service reported failure — ${out.Issues.join(' | ')}`);

                const review = out.Tasks.find((t) => t.Kind === 'OrderReview')!;
                const assigns = await rows(ctx, E_TASK_ASSIGNMENT, `TaskID = '${review.TaskID}'`);
                AssertEqual(assigns.length, 1, 'exactly one assignment — a task routed twice is routed to nobody');
                AssertEqual(
                    String(assigns[0]['AssigneeEntityID']).toLowerCase(),
                    entityID(ctx, E_PEOPLE).toLowerCase(),
                    'the assignee must be a Person — that is the shape tasks itself uses',
                );
                AssertEqual(
                    String(assigns[0]['AssigneeRecordID']).toLowerCase(),
                    input.Assignee.RecordID.toLowerCase(),
                    'and the person it was handed',
                );
                AssertEqual(
                    String(assigns[0]['RoleID']).toLowerCase(),
                    String(input.Assignee.RoleID).toLowerCase(),
                    'carrying the role it was handed, not one the service picked',
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT3',
        Name: 'WT3: a policy that creates NO contract raises ONLY the order-review task',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE D2C SHAPE, selected by the policy FLAG rather than by the pipeline's name. A test
                 * that looked up `Name = 'D2C'` would keep passing after a rename while asserting nothing.
                 */
                requireTasks(ctx);
                const input = await baseInput(ctx, false);
                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);

                Assert(out.Success, `the service reported failure — ${out.Issues.join(' | ')}`);
                AssertEqual(out.Tasks.length, 1, 'exactly one task on a non-contract policy');
                AssertEqual(out.Tasks[0].Kind, 'OrderReview', 'and it is the order review');
            }),
    },
    {
        Id: 'close-won-tasks.WT4',
        Name: 'WT4: a contract-creating POLICY raises BOTH tasks, linked to the best available target',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireTasks(ctx);
                const input = await baseInput(ctx, true);
                /**
                 * A stand-in contract ID. The contract itself is a different story's output; this bundle
                 * is about the TASKS, so what matters is where the link lands and whether the result says
                 * so honestly.
                 */
                input.ContractID = '11111111-2222-4333-8444-555555555555';

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                AssertEqual(out.Tasks.length, 2, `both tasks — ${out.Issues.join(' | ')}`);

                const contractTask = out.Tasks.find((t) => t.Kind === 'ContractProcessing');
                Assert(!!contractTask, 'no contract-processing task was reported');

                /**
                 * HOST-AWARE, like the rest of this suite. With contracts installed the link belongs on
                 * the contract; without it there is no contracts entity to point at, and the task must
                 * fall back to the deal AND say so rather than ending up with no link at all. Asserting
                 * only the first would make this check unrunnable on the common host; asserting only the
                 * second would stop testing the real target the day contracts arrives.
                 */
                const contractsInstalled = !!ProviderOf(ctx).Entities.find((e) => e.Name === E_CONTRACT);
                const expectedTarget = contractsInstalled ? input.ContractID! : input.DealID;

                AssertEqual(
                    contractTask!.LinkedEntityName,
                    contractsInstalled ? E_CONTRACT : E_DEAL,
                    'the result must report the target it actually used',
                );
                if (!contractsInstalled) {
                    Assert(
                        out.Issues.some((i) => i.includes('bizapps-contracts is not installed')),
                        `a relink must be reported, never silent — got ${JSON.stringify(out.Issues)}`,
                    );
                }

                const links = await rows(ctx, E_TASK_LINK, `TaskID = '${contractTask!.TaskID}'`);
                AssertEqual(links.length, 1, 'the contract task must be linked to SOMETHING — never stranded');
                AssertEqual(
                    String(links[0]['RecordID']).toLowerCase(),
                    expectedTarget.toLowerCase(),
                    'and the row must agree with what the result reported',
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT5',
        Name: 'WT5: with no contract yet, the contract task falls back to the DEAL rather than going missing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * Contract creation is a separate story and may not have run. A task nobody can navigate
                 * to is worse than one hanging off the deal, so the fallback is deliberate — and the
                 * result object has to SAY which end it landed on, or the caller cannot tell.
                 */
                requireTasks(ctx);
                const input = await baseInput(ctx, true);
                delete input.ContractID;

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                const contractTask = out.Tasks.find((t) => t.Kind === 'ContractProcessing');
                Assert(!!contractTask, 'the contract task must still be raised');
                AssertEqual(
                    contractTask!.LinkedEntityName,
                    E_DEAL,
                    'the result must report the DEAL as the link target it actually used',
                );

                const links = await rows(ctx, E_TASK_LINK, `TaskID = '${contractTask!.TaskID}'`);
                AssertEqual(
                    String(links[0]['RecordID']).toLowerCase(),
                    input.DealID.toLowerCase(),
                    'and the row must agree with the report',
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT6',
        Name: 'WT6: a missing contract task type is REFUSED with a reason, and the order review still lands',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * PARTIAL FAILURE IS THE INTERESTING CASE. The close that eventually calls this needs the
                 * order-review task even when the contract half cannot be built, and it needs to be told
                 * why — an all-or-nothing throw would lose the task that did succeed.
                 */
                requireTasks(ctx);
                const input = await baseInput(ctx, true);
                delete input.ContractTaskTypeID;

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                Assert(out.Success === false, 'a policy that owes a contract task must not report success without one');
                AssertEqual(out.Tasks.length, 1, 'the order-review task must still have been created');
                AssertEqual(out.Tasks[0].Kind, 'OrderReview', 'and it is the order review');
                Assert(
                    out.Issues.some((i) => i.includes('ContractTaskTypeID')),
                    `the refusal must name what was missing — got ${JSON.stringify(out.Issues)}`,
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT7',
        Name: 'WT7: with no finance assignee configured, the task is created but UNROUTED and says so',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ITEM 4'S RULE, PINNED. Nothing models "finance" as a group and TaskAssignment needs a
                 * concrete record, so the assignee is deployment configuration. When it is unset the
                 * honest outcome is an unrouted task plus an issue naming the key — NOT a guessed person,
                 * which would look routed while nobody was actually looking at it.
                 */
                requireTasks(ctx);
                const input = await baseInput(ctx, false);
                delete input.Assignee;

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                AssertEqual(out.Tasks.length, 1, 'the task must still be created');
                const review = out.Tasks[0];
                AssertEqual(review.AssignmentID, null, 'and reported as unrouted');

                const assigns = await rows(ctx, E_TASK_ASSIGNMENT, `TaskID = '${review.TaskID}'`);
                AssertEqual(assigns.length, 0, 'no assignment row may be invented');
                Assert(
                    out.Issues.some((i) => i.includes('AssigneeRecordID')),
                    `the issue must name the missing config key — got ${JSON.stringify(out.Issues)}`,
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT8',
        Name: 'WT8: a deal with no order raises NO order-review task, and says why',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * The order is embedded on the deal from creation, so an empty OrderID means something
                 * upstream did not happen. A task linked to nothing is a work item finance opens to find
                 * an empty page — worse than no task, because it looks handled.
                 */
                requireTasks(ctx);
                const input = await baseInput(ctx, false);
                input.OrderID = '';

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                Assert(out.Success === false, 'a deal with no order must not report success');
                AssertEqual(out.Tasks.length, 0, 'and must create no task at all');
                Assert(
                    out.Issues.some((i) => i.includes('no order')),
                    `the refusal must explain itself — got ${JSON.stringify(out.Issues)}`,
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT9',
        Name: 'WT9: task writes JOIN the transaction of the caller — a rolled-back scope leaves nothing behind',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE UNWRITTEN INVARIANT THIS FEATURE RESTS ON: one provider per process.
                 *
                 * The close writes its deal inside a transaction and then asks this service for tasks.
                 * `TaskOrchestrationService` writes through the global `Metadata.Provider` and accepts no
                 * injected provider — which sounds like it cannot join that transaction, and was briefly
                 * believed to mean a rolled-back close would strand orphan tasks. It does not: in a server
                 * process the global IS the provider the close opened its transaction on, so the writes
                 * join it. Injection is not what decides membership; the connection is.
                 *
                 * That makes the guarantee depend on something nothing enforces. The day a second
                 * `setupSQLServerClient` appears, or a background worker brings its own connection, task
                 * writes land outside the caller's transaction and a rolled-back close silently leaves
                 * work items pointing at a deal that was never closed. Nothing would fail — that is why
                 * this check exists.
                 *
                 * Both halves are asserted: the IDENTITY (which is the invariant) and the BEHAVIOUR (which
                 * is what the invariant buys). `BeginEntityTransaction` joins the ambient transaction as a
                 * savepoint, so the inner rollback is observable from inside the harness's outer one.
                 */
                requireTasks(ctx);
                const provider = ProviderOf(ctx);

                Assert(
                    Metadata.Provider === provider,
                    'the global Metadata.Provider is NOT the provider holding this transaction — task '
                        + 'writes would land outside the transaction of the caller and survive its rollback',
                );

                const db = provider as unknown as DatabaseProviderBase;
                Assert(typeof db.BeginEntityTransaction === 'function', 'the provider cannot nest a scope');

                const before = await TxOne<{ N: number }>(ctx, 'SELECT COUNT(*) AS N FROM __mj_BizAppsTasks.Task');

                const input = await baseInput(ctx, false);
                const scope = await db.BeginEntityTransaction();
                const out = await service.CreateCloseWonTasks(input, provider, ctx.User);
                Assert(out.Success, `the service reported failure — ${out.Issues.join(' | ')}`);
                const taskID = out.Tasks[0].TaskID;

                const during = await TxOne<{ N: number }>(
                    ctx, `SELECT COUNT(*) AS N FROM __mj_BizAppsTasks.Task WHERE ID = '${taskID}'`,
                );
                AssertEqual(Number(during.N), 1, 'the task must be visible inside the scope that wrote it');

                await scope.Rollback();

                const survived = await TxOne<{ N: number }>(
                    ctx, `SELECT COUNT(*) AS N FROM __mj_BizAppsTasks.Task WHERE ID = '${taskID}'`,
                );
                AssertEqual(
                    Number(survived.N),
                    0,
                    'the task must NOT survive the rollback — an orphan task points finance at a deal that '
                        + 'was never closed',
                );

                const after = await TxOne<{ N: number }>(ctx, 'SELECT COUNT(*) AS N FROM __mj_BizAppsTasks.Task');
                AssertEqual(Number(after.N), Number(before.N), 'and the table must be back where it started');
            }),
    },
];

for (const check of CloseWonTasksChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-tasks', {
    Setup: async () => {
        /* every check creates its own tasks and rolls back */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
