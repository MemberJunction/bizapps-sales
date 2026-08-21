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
import {
    CloseWonTaskService,
    CloseDealOperation,
    ResolveTaskTypeColumn,
    type CloseWonTaskInput,
} from '@mj-biz-apps/sales-core-entities-server';
import type { SalesCloseDealOutput, mjBizAppsSalesPipelineEntity } from '@mj-biz-apps/sales-entities';
import type { mjBizAppsTasksTaskTypeEntity } from '@mj-biz-apps/tasks-entities';

import { InRolledBackTransaction, ProviderOf, TxOne } from '../fixture.js';

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
 * THE SEEDED TASK-TYPE ROWS, BY ID — deliberately a DIFFERENT route than the service takes.
 *
 * The service resolves these by `Code` (falling back to `Name` on a host that predates bizapps-tasks
 * PR #42). If these checks resolved them the same way they would only prove the lookup agrees with
 * itself. Naming the primary keys makes this an independent oracle: `metadata/task-types/` fixes
 * these UUIDs, so a check can assert the service found THE row sales seeds rather than merely a row.
 *
 * This is the one place a fixed UUID is the right answer rather than the thing being retired.
 */
const ID_ORDER_REVIEW = '87ACA0BD-2FF6-493D-99B0-469D41825D1C';
const ID_CONTRACT_PROCESSING = '890C23F2-39D6-4075-8BA7-EC742A2D1CA8';

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
async function dealOnPolicy(
    ctx: Ctx,
    createsContract: boolean,
): Promise<{ DealID: string; PipelineID: string; CompanyID: string }> {
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
    return {
        DealID: String(deals[0]['ID']),
        PipelineID: pipelineID,
        CompanyID: String(deals[0]['CompanyID']),
    };
}

/** The service input every check starts from. Each one overrides only what it is testing. */
async function baseInput(ctx: Ctx, createsContract: boolean): Promise<CloseWonTaskInput> {
    /**
     * NO SHARED FIXTURE. `ResolveSalesFixture` still resolves `Deal Line Types`, which the embedded-order
     * rework dropped, so it throws on any database that has caught up. This bundle only ever needed one
     * field from it — the selling company — and the DEAL already carries that. Taking it from the deal is
     * both less coupled and more correct: the order has to belong to the same company as the deal.
     */
    const { DealID, PipelineID, CompanyID } = await dealOnPolicy(ctx, createsContract);
    const orderID = await anyID(ctx, E_ORDER, `CompanyID = '${CompanyID}'`, 'order');

    const roleID = await anyID(ctx, E_TASK_ROLE, 'ID IS NOT NULL', 'task role');
    const personID = await anyID(ctx, E_PEOPLE, 'ID IS NOT NULL', 'person');

    return {
        DealID,
        OrderID: orderID,
        PipelineID,
        Assignee: { EntityName: E_PEOPLE, RecordID: personID, RoleID: roleID },
    };
}

/**
 * Rename a seeded task type so neither the `Code` nor the `Name` lookup can find it.
 *
 * Both are changed because the service prefers `Code` where the column exists and falls back to `Name`
 * where it does not; touching only one would leave this check passing on one host shape and silently
 * doing nothing on the other.
 */
async function hideTaskType(ctx: Ctx, id: string): Promise<void> {
    const md = new Metadata();
    const row = await md.GetEntityObject<mjBizAppsTasksTaskTypeEntity>(E_TASK_TYPE, ctx.User);
    Assert(await row.Load(id), `setup: the seeded task type ${id} is not in this database`);
    row.Set('Name', `hidden-by-WT6-${id}`);
    if (row.Fields.some((f) => f.Name === 'Code')) {
        row.Set('Code', `HIDDEN_BY_WT6`);
    }
    Assert(await row.Save(), `setup: could not rename the task type — ${row.LatestResult?.CompleteMessage}`);
}

const service = new CloseWonTaskService();


/** Raw SQL inside the check's transaction. `ExecuteSQL` is on the DATABASE provider, not on IMetadataProvider. */
async function execSql(ctx: Ctx, sql: string, why: string): Promise<void> {
    const p = ProviderOf(ctx) as unknown as {
        ExecuteSQL: (
            sql: string,
            params: Record<string, unknown>,
            options: { isMutation: boolean; description: string },
            user: unknown,
        ) => Promise<unknown>;
    };
    await p.ExecuteSQL(sql, {}, { isMutation: true, description: why }, ctx.User);
}

/**
 * Drives a real close-won on a contract-creating pipeline and hands back what it produced.
 *
 * `stripOrder` is the whole reason this exists. Every other check in this bundle takes its deal from a
 * fixture that has ALREADY been saved once, so the deal arrives carrying an order — which is not the
 * shape production hands the close. A seeded, legacy or imported deal has `OrderID = NULL` until
 * something saves it, and that is the case the close got wrong.
 */
async function closeWonOnContractPipeline(
    ctx: Ctx,
    opts: { stripOrder: boolean },
): Promise<{ dealID: string; out: SalesCloseDealOutput; contractID: string | null }> {
    const pipelines = await rows(ctx, 'MJ_BizApps_Sales: Pipelines', 'IsActive = 1');
    const contractPipe = pipelines.find((pl) => {
        const rawPolicy = pl['CloseWonPolicy'];
        if (typeof rawPolicy !== 'string' || !rawPolicy) return false;
        try { return (JSON.parse(rawPolicy) as { CreateContract?: boolean }).CreateContract === true; }
        catch { return false; }
    });
    Assert(!!contractPipe, 'setup: no active pipeline whose policy has CreateContract = true');
    const pipelineID = String(contractPipe!['ID']);

    const openStatuses = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1');
    const openIDs = openStatuses.map((r) => String(r['ID']).toLowerCase());
    const candidates = await rows(ctx, E_DEAL, `PipelineID = '${pipelineID}' AND OrderID IS NOT NULL`);
    const deal = candidates.find((d) => openIDs.includes(String(d['DealStatusTypeID']).toLowerCase()));
    Assert(!!deal, 'setup: no OPEN deal on the contract pipeline carrying an order');
    const dealID = String(deal!['ID']);

    if (opts.stripOrder) {
        // The pre-provisioning shape: saved, and pointing at no order. Same technique as save-deal.SD24,
        // because there is no other way to reach the state a legacy row is already in.
        await execSql(
            ctx,
            `UPDATE __mj_BizAppsSales.Deal SET OrderID = NULL WHERE ID = '${dealID}'`,
            'WT13: simulate a deal that predates order provisioning',
        );
    }

    const wonRows = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsWon = 1 AND IsActive = 1');
    Assert(wonRows.length > 0, 'setup: no WON status on this host');

    const personID = await anyID(ctx, E_PEOPLE, 'ID IS NOT NULL', 'person');
    const md = new Metadata();
    const pipe = await md.GetEntityObject<mjBizAppsSalesPipelineEntity>('MJ_BizApps_Sales: Pipelines', ctx.User);
    Assert(await pipe.Load(pipelineID), 'setup: the pipeline could not be loaded');
    const basePolicy = JSON.parse(String(pipe.Get('CloseWonPolicy') ?? '{}')) as Record<string, unknown>;
    basePolicy.CloseWonTasks = { AssigneeEntityName: E_PEOPLE, AssigneeRecordID: personID };
    pipe.Set('CloseWonPolicy', JSON.stringify(basePolicy));
    Assert(await pipe.Save(), `setup: the policy could not be written — ${pipe.LatestResult?.CompleteMessage}`);

    const op = new CloseDealOperation();
    const rawOut = await op.Execute(
        { DealID: dealID, DealStatusTypeID: String(wonRows[0]['ID']) },
        { provider: ProviderOf(ctx), user: ctx.User },
    );
    const out = (rawOut as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!out, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(rawOut).slice(0, 300)}`);
    Assert(out!.Success, `the close failed — ${JSON.stringify(out!.Issues).slice(0, 400)}`);

    const stamped = await TxOne<{ ContractID: string | null }>(
        ctx, `SELECT ContractID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
    );
    return { dealID, out: out!, contractID: stamped.ContractID };
}

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
                /**
                 * A STRONGER CLAIM THAN THE ONE THIS USED TO MAKE. It asserted the task carried the type
                 * it was HANDED, which proved only that the service did not tamper with an argument. The
                 * service now CHOOSES, so the check has to prove it chose correctly — and it does that
                 * against the seeded primary key, which the service never sees.
                 */
                AssertEqual(
                    String(task['TypeID']).toLowerCase(),
                    ID_ORDER_REVIEW.toLowerCase(),
                    'the task must carry the ORDER_REVIEW type this repo seeds — resolved by code, not configured',
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
                /**
                 * MAKE THE SEED UNRESOLVABLE, which is what this failure now IS.
                 *
                 * Deleting a configuration key no longer expresses anything: the type is not configured,
                 * it is seeded. The equivalent real-world break is a database the metadata was never
                 * pushed to — so the row is renamed out from under the lookup, inside the transaction,
                 * and rolled back with everything else. Renamed rather than deleted because a TaskType
                 * with tasks against it cannot be deleted, and that is not the failure being modelled.
                 */
                await hideTaskType(ctx, ID_CONTRACT_PROCESSING);

                const out = await service.CreateCloseWonTasks(input, ProviderOf(ctx), ctx.User);
                Assert(out.Success === false, 'a policy that owes a contract task must not report success without one');
                AssertEqual(out.Tasks.length, 1, 'the order-review task must still have been created');
                AssertEqual(out.Tasks[0].Kind, 'OrderReview', 'and it is the order review');
                Assert(
                    out.Issues.some((i) => i.includes('CONTRACT_PROCESSING') || i.includes('Contract Processing')),
                    `the refusal must name the type it could not find — got ${JSON.stringify(out.Issues)}`,
                );
                Assert(
                    out.Issues.some((i) => i.includes('mj sync push')),
                    'and it must say where the row comes from, which a missing-configuration message could not',
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
    {
        Id: 'close-won-tasks.WT10',
        Name: 'WT10: closing a deal as WON raises the tasks through Sales.CloseDeal, end to end',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE WIRING ITSELF, not the service in isolation. WT1-WT9 prove the service; this proves
                 * that a real close reaches it, that the configuration route works end to end, and that
                 * the tasks land inside the close transaction.
                 *
                 * Everything vocabulary-shaped is still resolved by FLAG or ID: the pipeline by its
                 * CreateContract flag, the won status by IsWon, and the task types by taking two distinct
                 * active rows. The check asserts the tasks carry the types CONFIGURED, never which types
                 * they are -- the same discipline as WT1.
                 */
                requireTasks(ctx);

                // A closeable deal: open, on a contract-creating pipeline, and carrying its order.
                const pipelines = await rows(ctx, 'MJ_BizApps_Sales: Pipelines', 'IsActive = 1');
                const contractPipe = pipelines.find((pl) => {
                    const raw = pl['CloseWonPolicy'];
                    if (typeof raw !== 'string' || !raw) return false;
                    try { return (JSON.parse(raw) as { CreateContract?: boolean }).CreateContract === true; }
                    catch { return false; }
                });
                Assert(!!contractPipe, 'setup: no active pipeline whose policy has CreateContract = true');
                const pipelineID = String(contractPipe!['ID']);

                const openStatuses = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1');
                Assert(openStatuses.length > 0, 'setup: no open deal status');
                const openIDs = openStatuses.map((r) => String(r['ID']).toLowerCase());

                const candidates = await rows(ctx, E_DEAL, `PipelineID = '${pipelineID}' AND OrderID IS NOT NULL`);
                const deal = candidates.find((d) => openIDs.includes(String(d['DealStatusTypeID']).toLowerCase()));
                Assert(
                    !!deal,
                    'setup: no OPEN deal on the contract pipeline that carries an order. The order is embedded '
                        + 'at deal creation, so a host whose deals predate that has nothing to close here.',
                );
                const dealID = String(deal!['ID']);
                const orderID = String(deal!['OrderID']);

                const wonRows = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsWon = 1 AND IsActive = 1');
                Assert(wonRows.length > 0, 'setup: no WON status on this host');
                const wonStatusID = String(wonRows[0]['ID']);

                /**
                 * NOTHING TO CHOOSE ANY MORE. This used to grab two arbitrary active types and hand their
                 * IDs to the policy, because any two distinct types proved the plumbing carried what it
                 * was given. The types are now sales-owned rows resolved by code, so the claim is
                 * sharper: the close must land the two rows THIS REPO SEEDS, and the check knows which
                 * those are without asking the service.
                 */
                const seeded = await rows(
                    ctx, E_TASK_TYPE, `ID IN ('${ID_ORDER_REVIEW}', '${ID_CONTRACT_PROCESSING}')`,
                );
                AssertEqual(
                    seeded.length,
                    2,
                    'setup: this database is missing the seeded task types — run `mj sync push --dir metadata`',
                );
                const personID = await anyID(ctx, E_PEOPLE, 'ID IS NOT NULL', 'person');

                // Configure the policy the way a deployment would. Rolled back with everything else.
                const md = new Metadata();
                const pipe = await md.GetEntityObject<mjBizAppsSalesPipelineEntity>('MJ_BizApps_Sales: Pipelines', ctx.User);
                Assert(await pipe.Load(pipelineID), 'setup: the pipeline could not be loaded');
                const basePolicy = JSON.parse(String(pipe.Get('CloseWonPolicy') ?? '{}')) as Record<string, unknown>;
                // Only the assignee remains configurable; the type keys are gone from the policy.
                basePolicy.CloseWonTasks = {
                    AssigneeEntityName: E_PEOPLE,
                    AssigneeRecordID: personID,
                };
                pipe.Set('CloseWonPolicy', JSON.stringify(basePolicy));
                Assert(await pipe.Save(), `setup: the policy could not be written — ${pipe.LatestResult?.CompleteMessage}`);

                // THE CLOSE.
                const op = new CloseDealOperation();
                const raw = await op.Execute(
                    { DealID: dealID, DealStatusTypeID: wonStatusID },
                    { provider: ProviderOf(ctx), user: ctx.User },
                );
                const out = (raw as { Output?: SalesCloseDealOutput })?.Output;
                Assert(!!out, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(raw).slice(0, 300)}`);
                Assert(out!.Success, `the close failed — ${JSON.stringify(out!.Issues).slice(0, 400)}`);

                // THE ORDER-REVIEW TASK, found by its LINK to the order rather than by name.
                const orderEntityID = entityID(ctx, E_ORDER);
                const links = await rows(
                    ctx, E_TASK_LINK, `EntityID = '${orderEntityID}' AND RecordID = '${orderID}'`,
                );
                AssertEqual(links.length, 1, 'the close must leave exactly one task linked to the order');

                const [task] = await rows(ctx, E_TASK, `ID = '${String(links[0]['TaskID'])}'`);
                Assert(!!task, 'the link points at no task');
                AssertEqual(
                    String(task['TypeID']).toLowerCase(),
                    ID_ORDER_REVIEW.toLowerCase(),
                    'and it must carry the seeded ORDER_REVIEW type, resolved by the close with no policy help',
                );

                const assigns = await rows(ctx, E_TASK_ASSIGNMENT, `TaskID = '${String(links[0]['TaskID'])}'`);
                AssertEqual(assigns.length, 1, 'the task must be routed to the configured assignee');

                // A contract-creating policy also owes the contract task.
                const contractTasks = await rows(ctx, E_TASK, `TypeID = '${ID_CONTRACT_PROCESSING}'`);
                Assert(contractTasks.length >= 1, 'a contract-creating policy must also raise the contract task');

                // Fully configured means nothing to complain about.
                AssertEqual(
                    out!.Issues.length,
                    0,
                    `a fully configured close should report no issues — got ${JSON.stringify(out!.Issues)}`,
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT11',
        Name: 'WT11: a LOST close raises NO tasks — the gate is the IsWon flag, not the word "closed"',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * S-US7's third criterion, which had no check until the story audit went looking.
                 *
                 * WT1-WT10 all prove what a WON close creates. Nothing proved what a LOST close does NOT
                 * create, and "no tasks are created" was resting on reading `if (target.IsWon)` at
                 * `CloseDealOperation.ts:338`. That line is correct — but an unasserted negative is
                 * exactly the kind of thing a later refactor moves a brace through, and the failure is
                 * silent: finance gets an order-review task for a deal that was lost, works it, and finds
                 * nothing to review.
                 *
                 * THE GATE IS A FLAG, WHICH IS WHY THIS CHECK RESOLVES BY FLAG TOO. The status is found by
                 * `IsLost = 1`, never by a name, so a deployment that calls its losing status "Walked
                 * Away" is covered by the same assertion.
                 */
                requireTasks(ctx);

                const openStatuses = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1');
                Assert(openStatuses.length > 0, 'setup: no open deal status');
                const openIDs = openStatuses.map((r) => String(r['ID']).toLowerCase());

                const candidates = await rows(ctx, E_DEAL, 'OrderID IS NOT NULL');
                const deal = candidates.find((d) => openIDs.includes(String(d['DealStatusTypeID']).toLowerCase()));
                Assert(!!deal, 'setup: no OPEN deal carrying an order to close');
                const dealID = String(deal!['ID']);
                const orderID = String(deal!['OrderID']);

                const lostRows = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsLost = 1 AND IsActive = 1');
                Assert(lostRows.length > 0, 'setup: no LOST status on this host');
                const lostStatusID = String(lostRows[0]['ID']);

                // A loss reason is mandatory (close-deal.CD8), so this has to supply one or the close is
                // refused for the wrong reason and the check passes while proving nothing.
                const reasonID = await anyID(
                    ctx, 'MJ_BizApps_Sales: Loss Reasons', 'IsActive = 1 AND RequiresNotes = 0', 'loss reason',
                );

                const before = (await rows(ctx, E_TASK, '1 = 1')).length;

                const op = new CloseDealOperation();
                const raw = await op.Execute(
                    { DealID: dealID, DealStatusTypeID: lostStatusID, LossReasonID: reasonID },
                    { provider: ProviderOf(ctx), user: ctx.User },
                );
                const out = (raw as { Output?: SalesCloseDealOutput })?.Output;
                Assert(!!out, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(raw).slice(0, 300)}`);
                Assert(out!.Success, `the lost close failed — ${JSON.stringify(out!.Issues).slice(0, 400)}`);
                Assert(out!.IsLost, 'the target status carries IsLost, so the close must report it');

                AssertEqual(
                    (await rows(ctx, E_TASK, '1 = 1')).length,
                    before,
                    'a LOST close must create no tasks at all',
                );

                /**
                 * AND NOTHING POINTS AT THE ORDER. The count above would miss a task created and linked
                 * while another was deleted in the same close — unlikely, but the whole value of this
                 * check is in the negative, and a negative asserted one way is worth less than two.
                 */
                const orderEntityID = entityID(ctx, E_ORDER);
                const links = await rows(
                    ctx, E_TASK_LINK, `EntityID = '${orderEntityID}' AND RecordID = '${orderID}'`,
                );
                AssertEqual(links.length, 0, 'and nothing is linked to the lost deal\'s order');
            }),
    },
    {
        Id: 'close-won-tasks.WT12',
        /**
         * WT12, NOT WT11, and the renumber is the whole point of this comment.
         *
         * Another session added a different `close-won-tasks.WT11` -- "a LOST close raises NO tasks" --
         * five lines from here, and it is already merged. Two checks sharing one `Id` is the failure mode
         * git is least able to help with: both hunks apply, there is no conflict marker and no compile
         * error, and the registry silently ends up with a duplicate key.
         */
        Name: 'WT12: the lookup uses Code where the column exists, and Name only where it does not',
        RequiresMutation: false,
        Fn: async (ctx) => {
            requireTasks(ctx);
            const provider = ProviderOf(ctx);

            /**
             * THE PROBE MUST AGREE WITH REALITY, asserted in both directions rather than pinned to `Code`.
             *
             * Pinning it would make this check fail on the pre-migration host we hand to somebody else --
             * where the FALLBACK is the correct behaviour, not a defect. So the claim is that the probe
             * reports whatever the metadata actually offers: `Code` on a migrated host, `Name` on one that
             * predates bizapps-tasks PR #42. A probe that answered `Name` on a host that HAS the column
             * would be the real bug, and it is the one this catches.
             */
            const info = provider.Entities.find((e) => e.Name === E_TASK_TYPE);
            Assert(!!info, `setup: '${E_TASK_TYPE}' is not registered on this host`);
            const metadataHasCode = info!.Fields?.some((f) => f.Name === 'Code') === true;

            AssertEqual(
                ResolveTaskTypeColumn(provider),
                metadataHasCode ? 'Code' : 'Name',
                'the lookup column must follow what EntityField metadata offers — RunView builds its select '
                    + 'from those rows, so probing anything else could disagree with the query',
            );

            if (!metadataHasCode) {
                /** A pre-#42 host. The fallback is correct here; nothing further to assert. */
                return;
            }

            /**
             * ON A MIGRATED HOST, PROVE THE CODES ARE REALLY THERE AND READABLE BY CODE. The service
             * resolves by filtering on `Code`, so a column present but unpopulated would resolve nothing
             * and every task would go uncreated with only an Issue to show for it.
             */
            for (const [code, id] of [
                ['ORDER_REVIEW', ID_ORDER_REVIEW],
                ['CONTRACT_PROCESSING', ID_CONTRACT_PROCESSING],
            ] as const) {
                const found = await rows(ctx, E_TASK_TYPE, `Code = '${code}'`);
                AssertEqual(found.length, 1, `exactly one task type carries Code '${code}'`);
                AssertEqual(
                    String(found[0]['ID']).toLowerCase(),
                    id.toLowerCase(),
                    `and it is the row this repo seeds — the Code and the fixed UUID must name the same row`,
                );
            }
        },
    },
    {
        Id: 'close-won-tasks.WT13',
        Name: 'WT13: a deal with NO ORDER YET still gets its order-review task, linked to the order the close created',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE DEFECT THIS EXISTS FOR, AND WHY TEN CHECKS MISSED IT.
                 *
                 * Order provisioning moved into `DealEntityServer.Save()` this round. The close's task
                 * call sat twenty lines EARLIER and read `deal.OrderID`. So for any deal that did not
                 * already carry an order — every seeded, legacy and imported one — the service saw an
                 * empty OrderID, reported "The deal has no order, so no order-review task was created"
                 * as a WARNING ON A SUCCESSFUL CLOSE, raised nothing, and then `Save()` created the
                 * order a moment later. Finance got no work item and the warning said the opposite of
                 * what had just happened.
                 *
                 * WT1-WT12 could not see it because they all take their deal from a fixture that has
                 * already been saved once, so it arrives WITH an order. That is not the shape production
                 * hands the close. `stripOrder` reproduces the real one.
                 *
                 * ── HOW TO MAKE THIS FAIL ──
                 * Move the `if (target.IsWon)` task block back above `await deal.Save()`. This check goes
                 * red and every other check in the bundle stays green — which is exactly what happened.
                 */
                requireTasks(ctx);
                const { dealID, out } = await closeWonOnContractPipeline(ctx, { stripOrder: true });

                /**
                 * THE WARNING MUST NOT BE THERE. Asserted before the task itself, because this is the
                 * half that lied: a close that reports "no order" while creating one is worse than a
                 * close that quietly does nothing, since the message sends whoever reads it looking in
                 * the wrong place.
                 */
                const noOrderWarnings = out.Issues.filter((i) => /has no order/i.test(i.Message ?? ''));
                AssertEqual(
                    noOrderWarnings.length,
                    0,
                    'the close must not claim the deal has no order — provisioning happens inside the '
                        + `save, so by the time tasks run there is one. Got: ${JSON.stringify(noOrderWarnings)}`,
                );

                // The order the close provisioned, read back from the deal rather than assumed.
                const after = await TxOne<{ OrderID: string | null }>(
                    ctx, `SELECT OrderID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
                );
                Assert(!!after.OrderID, 'the close must have provisioned an order on the way through');

                const orderEntityID = entityID(ctx, E_ORDER);
                const links = await rows(
                    ctx, E_TASK_LINK, `EntityID = '${orderEntityID}' AND RecordID = '${after.OrderID}'`,
                );
                AssertEqual(
                    links.length,
                    1,
                    'exactly one task must be linked to that order — finance reviews the ORDER, and a '
                        + 'deal with no order at close time is the commonest deal there is',
                );

                const [task] = await rows(ctx, E_TASK, `ID = '${String(links[0]['TaskID'])}'`);
                AssertEqual(
                    String(task['TypeID']).toLowerCase(),
                    ID_ORDER_REVIEW.toLowerCase(),
                    'and it carries the seeded ORDER_REVIEW type',
                );
            }),
    },
    {
        Id: 'close-won-tasks.WT14',
        Name: 'WT14: the contract-processing task links the CONTRACT, not the deal',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * `CloseWonTaskService` has always known how to link the contract — `if (input.ContractID)`
                 * — and the close never passed it. So that branch was UNREACHABLE from production and its
                 * "contracts is not installed" fallback was dead code. Every contract-processing task
                 * pointed at the deal instead of the agreement it exists to process, and nothing reported
                 * it, because the branch that would have reported it is the one that never ran.
                 *
                 * WT4 asserts BOTH tasks are raised and WT5 asserts the fallback to the deal when there is
                 * no contract YET — so between them they were satisfied by the broken behaviour. Nothing
                 * asserted the case where a contract DOES exist. That is the gap.
                 *
                 * ── HOW TO MAKE THIS FAIL ──
                 * Delete `ContractID: deal.ContractID ?? undefined` from the task input literal in
                 * `CloseDealOperation`. This check goes red; WT4 and WT5 stay green.
                 */
                requireTasks(ctx);
                const { dealID, contractID } = await closeWonOnContractPipeline(ctx, { stripOrder: false });

                Assert(
                    !!contractID,
                    'setup: the close must have created a contract, or there is nothing for the task to '
                        + 'link to and this check would pass vacuously',
                );

                const contractTasks = await rows(ctx, E_TASK, `TypeID = '${ID_CONTRACT_PROCESSING}'`);
                Assert(contractTasks.length >= 1, 'a contract-creating policy must raise the contract task');

                const contractEntityID = entityID(ctx, E_CONTRACT);
                const dealEntityID = entityID(ctx, E_DEAL);
                const taskIDs = contractTasks.map((t) => `'${String(t['ID'])}'`).join(',');
                const links = await rows(ctx, E_TASK_LINK, `TaskID IN (${taskIDs})`);

                const toContract = links.filter(
                    (l) => String(l['EntityID']).toLowerCase() === contractEntityID.toLowerCase()
                        && String(l['RecordID']).toLowerCase() === String(contractID).toLowerCase(),
                );
                AssertEqual(
                    toContract.length,
                    1,
                    'the contract-processing task must link the CONTRACT it exists to process. Linking the '
                        + 'deal instead gives finance a work item that opens the wrong record.',
                );

                const toDeal = links.filter(
                    (l) => String(l['EntityID']).toLowerCase() === dealEntityID.toLowerCase()
                        && String(l['RecordID']).toLowerCase() === dealID.toLowerCase(),
                );
                AssertEqual(
                    toDeal.length,
                    0,
                    'and it must NOT fall back to the deal once a contract exists — that fallback is for '
                        + 'the no-contract-yet case (WT5), not for every close',
                );
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
