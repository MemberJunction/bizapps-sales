/**
 * @fileoverview The finance tasks a won deal raises — S-US2 (#34) and S-US3 (#35).
 *
 * On Closed Won both pipelines raise an **order-review** task against the deal's embedded order, and a
 * B2B deal additionally raises a **contract-processing** task. Finance reviews the order, corrects it and
 * advances it; that advance is what triggers invoicing, so the task is the control on money leaving the
 * building — not a reminder.
 *
 * ── WHAT THIS SERVICE DOES NOT DECIDE ───────────────────────────────────────────────────────────────
 *
 * It does not decide WHICH task type, WHICH role, or WHO finance is. Every one of those is a row in
 * somebody's table, and this app's second rule is that vocabulary is data: the engine branches on flags,
 * never on names. `TaskType` and `TaskRole` carry **no `Code` and no behaviour flag** — only `Name` — so
 * there is no vocabulary-safe way to look up "the order-review type" from in here. Asking the caller for
 * the IDs is the honest resolution: it keeps the name comparison out of the engine entirely rather than
 * hiding one behind a helper.
 *
 * The one thing it does decide is whether the contract task is raised, and that comes from the pipeline's
 * `CloseWonPolicy.CreateContract` **flag** — the same policy the close operation already reads. A B2B
 * pipeline is not "the one called B2B"; it is the one whose policy says it creates a contract.
 *
 * ── IT IS WIRED INTO THE CLOSE ──────────────────────────────────────────────────────────────────
 *
 * `CloseDealOperation` calls `CreateCloseWonTasks` inside its `IsWon` branch, after the save and the
 * routing loop, passing the deal, the order provisioned during the save, the pipeline, and the
 * `ContractID` the contract seam minted.
 *
 * This header used to say the opposite, and said so correctly at the time: the service was written
 * while `Sales.CloseDeal` was mid-rework for the embedded-order redesign, and was deliberately left
 * unwired until that landed. Both halves are done now. A header still claiming otherwise would tell
 * the next reader this feature is inert when it is the live path.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    LogError,
    LogStatus,
    RunView,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import { TaskAssignmentService, TaskOrchestrationService } from '@mj-biz-apps/tasks-core';
import type { mjBizAppsTasksTaskLinkEntity } from '@mj-biz-apps/tasks-entities';

const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_TASK_LINK = 'MJ_BizApps_Tasks: Task Links';
const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_TASK_TYPE = 'MJ_BizApps_Tasks: Task Types';

/**
 * The two task types sales owns, addressed by CODE.
 *
 * These are not configuration and no deployment varies them. The rows live in this repo, under
 * `metadata/task-types/`, on Amith's ruling that tasks owns the SHAPE while the app that raises a
 * kind of work owns the ROW -- so a code is simply this service naming its own vocabulary.
 *
 * -- WHY A CODE AND NOT AN ID --
 *
 * These used to arrive as UUIDs on `Pipeline.CloseWonPolicy`, which was the best available handle
 * before bizapps-tasks PR #42 added `TaskType.Code` (NOT NULL, UNIQUE) on 2026-08-20. It made every
 * deployment restate a fact identical everywhere, and routed a fixed UUID through configuration to
 * reach code that only ever wanted the order-review one. Worse, a database missing the seed and a
 * policy missing the key were indistinguishable at this end.
 *
 * -- AND WHY THIS IS NOT A VOCABULARY COMPARISON --
 *
 * Nothing branches on these. They are looked up, they yield an ID, and no behaviour anywhere asks
 * which type a task has -- the contract task is still decided by `CloseWonPolicy.CreateContract`, a
 * flag. A code is a stable identifier that survives renaming the display Name, which is the property
 * a NAME comparison lacks and the whole reason the column exists.
 */
const CODE_ORDER_REVIEW = 'ORDER_REVIEW';
const CODE_CONTRACT_PROCESSING = 'CONTRACT_PROCESSING';

/**
 * The display Names paired with those codes, used ONLY by the pre-PR-#42 fallback in
 * `resolveTaskType`. Deliberately a lookup beside the codes rather than a string inline at the call
 * site: when the fallback is deleted, this goes with it and nothing is left holding a name.
 */
const TASK_TYPE_NAMES: Record<string, string> = {
    [CODE_ORDER_REVIEW]: 'Order Review',
    [CODE_CONTRACT_PROCESSING]: 'Contract Processing',
};

/** The record a task hangs off. Polymorphic, because `TaskLink` is. */
export interface CloseWonTaskTarget {
    /** The MJ entity NAME, e.g. `'MJ_BizApps_Orders: Order Headers'`. Resolved to an ID here. */
    EntityName: string;
    RecordID: string;
}

/** Who the task is routed to. `TaskAssignment` is polymorphic; in practice this is a Person. */
export interface CloseWonTaskAssignee {
    EntityName: string;
    RecordID: string;
    /**
     * The `TaskRole` this assignee holds — `Primary`, `Reviewer`, `Observer` as seeded.
     *
     * An ID, not a name, and optional because `TaskAssignment.RoleID` is nullable. Note this is a
     * RESPONSIBILITY role ("who owns this"), not an organisational one — nothing in tasks models
     * "finance/AR" as a group, which is why the assignee itself carries the routing.
     */
    RoleID?: string;
}

export interface CloseWonTaskInput {
    DealID: string;
    /**
     * The deal's NAME, for the task's own name.
     *
     * ── WHY THIS IS AN INPUT RATHER THAN A LOOKUP ───────────────────────────────────────────────────
     *
     * The task names interpolated `DealID`, so a finance work queue rendered as rows of hex — "Review
     * order for deal 3006D3FB-6C13-40ED-9E4C-…" — which is unreadable exactly where a human has to
     * choose what to work on next. The deal's name is what that row should say.
     *
     * Taken as an input because the caller already holds the deal entity; reading it back here would be a
     * second query for a value the close is looking at. Required rather than optional so the compiler
     * names every construction site instead of letting one quietly fall back to the id.
     */
    DealName: string;
    /** The deal's embedded order. The order-review task hangs off this. */
    OrderID: string;
    /** Read for its `CloseWonPolicy.CreateContract` flag — never for its name. */
    PipelineID: string;
    /**
     * The contract the B2B task hangs off, when one has been created.
     *
     * Optional because contract creation is its own story and may not have run. When it is absent the
     * contract task still gets raised and is linked to the DEAL instead — a task nobody can find is worse
     * than a task hanging off the wrong end of a relationship it can still be navigated from.
     */
    ContractID?: string;
    /**
     * NO TASK-TYPE IDs. They were here, and their removal is the point rather than a simplification.
     *
     * The service resolves both types itself, by `Code`, from rows this repo seeds. A caller cannot
     * substitute a different type, which is correct: which type is the order-review task has exactly
     * one answer and it is not a per-deal decision. See `CODE_ORDER_REVIEW` above.
     */
    /**
     * Who the task is routed to. OPTIONAL, and its absence is the interesting case.
     *
     * Nothing in tasks or common models "finance" as a group, and `TaskAssignment` needs a CONCRETE
     * record — pointing it at a role would never surface in anyone's task list, because nothing expands
     * a role-typed assignee. So the assignee is deployment configuration, and when it is unset the task
     * is still created and linked but left UNROUTED with an issue naming the missing key. A guessed
     * person is worse than an unassigned task: it looks routed and nobody is actually looking at it.
     */
    Assignee?: CloseWonTaskAssignee;
    AssignedByPersonID?: string;
    DueAt?: Date;
}

/** Which of the two tasks a result row describes. A discriminator in this code, not a row in a table. */
export type CloseWonTaskKind = 'OrderReview' | 'ContractProcessing';

export interface CloseWonTaskCreated {
    Kind: CloseWonTaskKind;
    TaskID: string;
    /** What the task was linked to, as it ended up — not as it was requested. */
    LinkedEntityName: string;
    LinkedRecordID: string;
    AssignmentID: string | null;
}

export interface CloseWonTaskResult {
    Success: boolean;
    Tasks: CloseWonTaskCreated[];
    /**
     * Why something did not happen, in the caller's terms.
     *
     * Structured rather than thrown, and shaped like `Sales.CloseDeal`'s issues, so the eventual wiring
     * can merge these into the close's own report instead of translating an exception.
     */
    Issues: string[];
}

/**
 * The subset of `CloseWonPolicy` this service reads. Deliberately not the whole type — it needs one flag,
 * and importing the full policy would couple the tasks half to every routing decision the close makes.
 */
/**
 * The close-won task configuration a deployment sets on `Pipeline.CloseWonPolicy`.
 *
 * It lives on the POLICY rather than in code for the same reason the contract decision does: these are
 * row IDs in somebody's table, they differ per deployment, and a pipeline is the thing that already
 * carries per-motion behaviour. Nothing here is looked up by name.
 */
export interface CloseWonTasksPolicyConfig {
    /**
     * The two task-type keys that used to live here are GONE, and a deployment still carrying them is
     * harmless: this reads only what it names, so a stale `OrderReviewTaskTypeID` in somebody policy
     * JSON is ignored rather than mis-honoured. What remains is the part that genuinely differs per
     * deployment -- WHO the work is routed to.
     */
    /** The assignee's entity NAME — in practice `'MJ_BizApps_Common: People'`. */
    AssigneeEntityName?: string | null;
    /** The assignee record. NULL by default: an unconfigured deployment routes nothing. */
    AssigneeRecordID?: string | null;
    /** Which `TaskRole` the assignee holds. Optional — `TaskAssignment.RoleID` is nullable. */
    AssigneeRoleID?: string | null;
    /**
     * How many days after the close the finance work is due. Omit to take {@link DEFAULT_DUE_IN_DAYS}.
     *
     * Per-deployment because it is a service-level commitment, not a rule: a team that reviews orders
     * same-day and one that batches weekly both want these tasks, on different clocks.
     *
     * A non-positive value is honoured — 0 means "due today" — but a non-finite or absent one falls back
     * to the default rather than producing an invalid date.
     */
    DueInDays?: number | null;
}

/**
 * Reads the task configuration out of a `CloseWonPolicy`, tolerating every absent shape.
 *
 * Exported so the close operation can map policy to service input in one line rather than reaching
 * into the JSON itself — the shape belongs with the service that consumes it.
 */
/**
 * WHICH COLUMN THE TASK-TYPE LOOKUP WILL USE ON THIS HOST.
 *
 * Exported so the choice can be ASSERTED rather than inferred. The fallback announces itself with a
 * `LogStatus`, and a log line is not an observable a check can fail on -- the same gap that let the
 * D-19 collation check stay green while the fix it guarded was reverted.
 *
 * Reads ENTITY METADATA, not the physical column: `RunView` builds its select from `EntityField` rows,
 * so a database that has the column while metadata does not would still fail a `Code` filter. Asking the
 * same source the query is built from is the only probe that cannot disagree with it.
 */
export function ResolveTaskTypeColumn(provider: IMetadataProvider): 'Code' | 'Name' {
    const info = provider.Entities.find((e) => e.Name === E_TASK_TYPE);
    return info?.Fields?.some((f) => f.Name === 'Code') === true ? 'Code' : 'Name';
}

/**
 * How long a close-won task gets by default.
 *
 * Five days rather than one or thirty: the order review gates the invoice, so it cannot sit for a month,
 * and finance is not on call, so it cannot be due in an hour. It is a default precisely because it is
 * arguable — `DueInDays` in the policy is how a deployment disagrees.
 */
export const DEFAULT_DUE_IN_DAYS = 5;

/**
 * The due date for work created by a close, in UTC.
 *
 * ── THE ARITHMETIC IS DELIBERATELY DONE THIS WAY, AND THERE IS A CAUTIONARY TALE ────────────────
 *
 * `Date.UTC` with an out-of-range day is the whole trick: `Date.UTC(2026, 0, 30 + 5)` is 4 February, and
 * month-end, month-length and year rollover are the platform's problem rather than this function's. The
 * alternative — adding milliseconds, or building a string — is where day arithmetic goes wrong.
 *
 * It goes wrong quietly. Orders' own `GetOverdueWorklistOperation` carried broken day arithmetic for
 * MONTHS: it reported an order one month overdue as **46,264 days** overdue, and nobody noticed, because
 * `DueDate` was NULL on every order in the system so the code path never ran on real data. That is the
 * same shape as the bug being fixed here — a due-date feature made inert by a null — and it is the reason
 * this returns a date at all rather than leaving the column empty and the feature untested.
 *
 * Truncated to UTC midnight, like `Deal.ActualCloseDate`: a due DATE is a day, and stamping 23:47 makes
 * "due today" depend on the reader's timezone.
 */
export function CloseWonTaskDueAt(closedAt: Date, dueInDays?: number | null): Date {
    const days = Number.isFinite(dueInDays) ? Number(dueInDays) : DEFAULT_DUE_IN_DAYS;
    return new Date(
        Date.UTC(closedAt.getUTCFullYear(), closedAt.getUTCMonth(), closedAt.getUTCDate() + days),
    );
}

export function ReadCloseWonTaskConfig(policy: unknown): CloseWonTasksPolicyConfig {
    const holder = policy as { CloseWonTasks?: CloseWonTasksPolicyConfig } | null | undefined;
    return holder?.CloseWonTasks ?? {};
}

interface PolicyCreateContract {
    CreateContract?: boolean;
}

export class CloseWonTaskService {
    private readonly orchestration = new TaskOrchestrationService();
    private readonly assignments = new TaskAssignmentService();

    /**
     * Raises the tasks a won deal owes, and reports what it raised.
     *
     * Order-review always; contract-processing when the pipeline's policy says so. Never throws for a
     * business reason — a caller mid-close wants a report it can fold into its own, not an exception that
     * loses the task it did manage to create.
     */
    public async CreateCloseWonTasks(
        input: CloseWonTaskInput,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<CloseWonTaskResult> {
        const result: CloseWonTaskResult = { Success: true, Tasks: [], Issues: [] };

        /**
         * NO ORDER, NO ORDER-REVIEW TASK. The order is embedded on the deal from creation, so an empty
         * OrderID means something upstream did not happen — and a task pointing at nothing is a work
         * item finance opens to find an empty page. Report it and create nothing.
         */
        if (!input.OrderID) {
            result.Issues.push(
                'The deal has no order, so no order-review task was created. The order is created with the '
                    + 'deal, so this means the deal predates that or its order was never written.',
            );
            result.Success = false;
        }
        const orderReviewTypeID = input.OrderID
            ? await this.resolveTaskType(CODE_ORDER_REVIEW, provider, contextUser, result)
            : null;
        const orderReview = (input.OrderID && orderReviewTypeID) ? await this.raise(
            'OrderReview',
            {
                Name: `Review order for ${input.DealName}`,
                TypeID: orderReviewTypeID,
                Description:
                    'Review the order for accuracy, correct it if needed, then advance it. Advancing is '
                    + 'the confirm that locks the order, books the journal entries and triggers invoicing.',
            },
            // The order is what this task is ABOUT; the deal is how a rep finds it.
            [
                { EntityName: 'MJ_BizApps_Orders: Order Headers', RecordID: input.OrderID },
                { EntityName: E_DEAL, RecordID: input.DealID },
            ],
            input,
            provider,
            contextUser,
            result,
        ) : null;
        if (orderReview) {
            result.Tasks.push(orderReview);
        }

        if (await this.policyRaisesContractTask(input.PipelineID, contextUser, result)) {
            const contractTypeID = await this.resolveTaskType(
                CODE_CONTRACT_PROCESSING,
                provider,
                contextUser,
                result,
            );
            if (contractTypeID) {
                /**
                 * THE FALLBACK IS DELIBERATE, not defensive padding, and it has TWO triggers.
                 *
                 * Contract creation is a separate story and may not have produced a row — and on a host
                 * without bizapps-contracts installed there is no contracts entity to point a link at,
                 * whatever ID the caller holds. Either way, linking to the deal keeps the task reachable
                 * from the thing that caused it. An UNLINKED task is the outcome worth avoiding: finance
                 * gets a work item with nothing to open, which is how a task becomes noise.
                 *
                 * The result object reports the target it actually used, and the second trigger also
                 * records an issue — a silent relink would look identical to a correct one.
                 */
                const contractsAvailable = !!provider.Entities.find((e) => e.Name === E_CONTRACT);
                let target: CloseWonTaskTarget = { EntityName: E_DEAL, RecordID: input.DealID };
                if (input.ContractID) {
                    if (contractsAvailable) {
                        target = { EntityName: E_CONTRACT, RecordID: input.ContractID };
                    } else {
                        result.Issues.push(
                            'A contract was supplied but bizapps-contracts is not installed on this host, so '
                                + 'the contract task was linked to the deal instead.',
                        );
                    }
                }

                const contractTask = await this.raise(
                    'ContractProcessing',
                    {
                        Name: `Process contract for ${input.DealName}`,
                        TypeID: contractTypeID,
                        Description:
                            'Attach the executed PDF, confirm the agreement version against the signed '
                            + 'document, record the executed/effective/end dates, validate whether the '
                            + 'template was modified and capture any deviations, then move the contract to '
                            + 'its active status.',
                    },
                    /**
                     * The contract (or the deal, per the fallback above) is what this task is ABOUT, and the
                     * deal is always appended so the work is reachable from it. When the fallback already
                     * chose the deal these collapse to one link -- `raise` de-duplicates rather than
                     * showing finance the same record twice.
                     */
                    [target, { EntityName: E_DEAL, RecordID: input.DealID }],
                    input,
                    provider,
                    contextUser,
                    result,
                );
                if (contractTask) {
                    result.Tasks.push(contractTask);
                }
            }
        }

        return result;
    }

    /* ── internals ───────────────────────────────────────────────────────────── */

    /** Creates one task, links it and routes it. Returns null when the task itself could not be created. */
    /**
     * The `TaskType` row for a code, or null with an issue explaining why not.
     *
     * -- THE PROBE, AND WHY IT IS NOT PADDING --
     *
     * `TaskType.Code` arrived in bizapps-tasks PR #42, merged 2026-08-20. A database migrated before
     * that does not have the column, and a filter naming a column that does not exist does not return
     * nothing -- it fails the whole query. Verified: neither local host has the migration applied.
     *
     * So this asks the metadata which identifier tasks actually offers. With `Code` present it matches
     * on `Code`, which is the point of the exercise. Without it, it matches on `Name` -- safe here in a
     * way it would not be in general, because these two rows are seeded by THIS repo under fixed UUIDs,
     * so their names are ours and change only when we change them.
     *
     * When every host has the column the `else` goes, and nothing else in this file moves.
     */
    private async resolveTaskType(
        code: string,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: CloseWonTaskResult,
    ): Promise<string | null> {
        const info = provider.Entities.find((e) => e.Name === E_TASK_TYPE);
        if (!info) {
            result.Issues.push(
                `bizapps-tasks is not installed on this host, so the ${code} task could not be created.`,
            );
            result.Success = false;
            return null;
        }

        const column = ResolveTaskTypeColumn(provider);
        const hasCode = column === 'Code';
        const value = hasCode ? code : TASK_TYPE_NAMES[code];
        if (!hasCode) {
            /**
             * LOGGED, NOT RAISED AS AN ISSUE -- and the distinction matters more than it looks.
             *
             * This was an Issue first, and WT10 caught what that actually meant: every close on an
             * unmigrated host reports two warnings about a pending migration to the person closing a
             * deal, who can do nothing about it. An issue list that is never empty is an issue list
             * nobody reads, and the close would have been training people to ignore it.
             *
             * It is a property of the HOST, not of this deal, so it goes where host facts go. The
             * fallback stays observable where it should be: WT1 and WT6 run against a database with no
             * Code column and assert the right type is still found.
             */
            LogStatus(
                `CloseWonTaskService: this host predates bizapps-tasks PR #42, so TaskType has no Code `
                    + `column and ${code} was matched on its Name. Apply the tasks migration.`,
            );
        }

        const r = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_TASK_TYPE,
                ExtraFilter: `${column} = '${String(value).replace(/'/g, "''")}'`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            contextUser,
        );
        if (!r?.Success) {
            result.Issues.push(`Could not read task types: ${r?.ErrorMessage ?? 'unknown error'}.`);
            result.Success = false;
            return null;
        }

        const id = (r.Results ?? [])[0]?.ID ?? null;
        if (!id) {
            /**
             * A MISSING SEED, NAMED AS SUCH. The old code could only say the configuration key was
             * unset, which was the same message whether a deployment had forgotten a policy field or
             * had never pushed the metadata at all. This says which, and where the row comes from.
             */
            result.Issues.push(
                `No task type with ${column} '${value}' exists, so that task was not created. The row is `
                    + `seeded from this repo: run \`mj sync push --dir metadata\` against this database.`,
            );
            result.Success = false;
        }
        return id;
    }
    private async raise(
        kind: CloseWonTaskKind,
        task: { Name: string; TypeID: string; Description: string },
        /**
         * Every record this task should be reachable from, PRIMARY FIRST.
         *
         * It used to be a single target, which is how both tasks ended up unreachable from the deal that
         * caused them: one pointed at the order header, the other at the contract, and neither at the
         * deal. From a deal you could not find the work its own close had raised — which is the first
         * navigation a rep tries.
         *
         * The primary is still what the result reports, so `LinkedEntityName` / `LinkedRecordID` keep
         * their meaning: the record this task is fundamentally ABOUT. The deal is an additional way in,
         * not a reclassification.
         */
        targets: readonly CloseWonTaskTarget[],
        input: CloseWonTaskInput,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: CloseWonTaskResult,
    ): Promise<CloseWonTaskCreated | null> {
        let taskID: string;
        try {
            // Through tasks' OWN orchestration service rather than a bare entity save: it is that app's
            // supported entry point, and going around it would mean re-deciding defaults it already owns.
            const created = await this.orchestration.CreateTask(
                {
                    Name: task.Name,
                    TypeID: task.TypeID,
                    Description: task.Description,
                    DueAt: input.DueAt,
                    CreatedByPersonID: input.AssignedByPersonID,
                },
                contextUser,
            );
            taskID = created.ID;
        } catch (err) {
            result.Issues.push(`The ${kind} task could not be created: ${String(err)}`);
            result.Success = false;
            return null;
        }

        /**
         * DE-DUPLICATED, because the contract task's own fallback already targets the deal when there is no
         * contract to point at. Linking the same record twice would put two identical rows in front of
         * finance and make the task look like two pieces of work.
         */
        const unique = targets.filter(
            (t, i) => targets.findIndex(
                (o) => o.EntityName === t.EntityName
                    && o.RecordID.toLowerCase() === t.RecordID.toLowerCase(),
            ) === i,
        );
        const primary = unique[0];

        /**
         * The PRIMARY link decides whether the task is usable at all; a secondary that fails leaves the
         * task reachable and is reported rather than fatal. `link` already pushes an issue for each
         * failure, so a partial outcome is visible without inventing a second channel for it.
         */
        let linked = false;
        for (const [index, t] of unique.entries()) {
            const ok = await this.link(taskID, t, provider, contextUser, result, kind);
            if (index === 0) {
                linked = ok;
            }
        }
        if (!linked) {
            result.Success = false;
        }

        const assignmentID = await this.route(taskID, input, provider, contextUser, result, kind);
        if (!assignmentID) {
            result.Success = false;
        }

        return {
            Kind: kind,
            TaskID: taskID,
            LinkedEntityName: primary.EntityName,
            LinkedRecordID: primary.RecordID,
            AssignmentID: assignmentID,
        };
    }

    /**
     * Hangs the task off its record.
     *
     * `TaskLink` is polymorphic — an `EntityID`/`RecordID` pair — so the entity has to be resolved from
     * metadata. An unresolvable name means the sibling app is not installed on this host, and that is
     * reported rather than thrown: the task exists and is still useful without the link.
     */
    private async link(
        taskID: string,
        target: CloseWonTaskTarget,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: CloseWonTaskResult,
        kind: CloseWonTaskKind,
    ): Promise<boolean> {
        const entity = provider.Entities.find((e) => e.Name === target.EntityName);
        if (!entity) {
            result.Issues.push(
                `The ${kind} task was created but could not be linked: entity '${target.EntityName}' is `
                    + 'not registered on this host.',
            );
            return false;
        }

        /**
         * THE INJECTED PROVIDER, NOT `new Metadata()` — and this was a real hole in the transaction
         * proof, not a style point.
         *
         * `WT9` shows task writes joining the caller's transaction, and it holds only where
         * `Metadata.Provider` IS the injected object. `fixture.ts` documents the counter-case: under
         * `mj test` the CLI installs its own instrumented cache first, so the global and the injected
         * provider are different objects. On such a host this insert landed on a different connection
         * and SURVIVED the close's rollback — a TaskLink left pointing at a deal that was never closed,
         * and WT9 would still have been green because it reads through the same global.
         *
         * `DealEntityServer` uses `this.ProviderToUse` throughout for exactly this reason; the pattern
         * was already in the repo.
         */
        const link = await provider.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(E_TASK_LINK, contextUser);
        link.NewRecord();
        link.TaskID = taskID;
        link.EntityID = entity.ID;
        link.RecordID = target.RecordID;
        if (!(await link.Save())) {
            const why = link.LatestResult?.CompleteMessage ?? 'unknown error';
            LogError(`CloseWonTaskService: link failed for task ${taskID}: ${why}`);
            result.Issues.push(`The ${kind} task was created but could not be linked: ${why}`);
            return false;
        }
        return true;
    }

    /** Routes the task to its assignee, through tasks' own service so the activity log gets its entry. */
    private async route(
        taskID: string,
        input: CloseWonTaskInput,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: CloseWonTaskResult,
        kind: CloseWonTaskKind,
    ): Promise<string | null> {
        if (!input.Assignee?.RecordID || !input.Assignee?.EntityName) {
            result.Issues.push(
                `The ${kind} task was created but NOT routed: no finance assignee is configured on the `
                    + 'pipeline\'s CloseWonPolicy (CloseWonTasks.AssigneeRecordID).',
            );
            return null;
        }
        /**
         * Also the injected provider. A read rather than a write, so the stakes are lower — but an
         * instrumented cache can carry a different entity registry, and resolving an EntityID from one
         * provider to write it through another is how an assignment ends up pointing at the wrong
         * entity on the one host where it matters.
         */
        const assigneeEntity = provider.Entities.find((e) => e.Name === input.Assignee!.EntityName);
        if (!assigneeEntity) {
            result.Issues.push(
                `The ${kind} task was created but could not be routed: entity `
                    + `'${input.Assignee!.EntityName}' is not registered on this host.`,
            );
            return null;
        }

        try {
            const assignment = await this.assignments.assignToTask(
                {
                    taskID,
                    assigneeEntityID: assigneeEntity.ID,
                    assigneeRecordID: input.Assignee!.RecordID,
                    roleID: input.Assignee!.RoleID,
                    assignedByPersonID: input.AssignedByPersonID,
                },
                contextUser,
            );
            return assignment.Get('ID') as string;
        } catch (err) {
            result.Issues.push(`The ${kind} task was created but could not be routed: ${String(err)}`);
            return null;
        }
    }

    /**
     * Whether this pipeline's policy raises a contract task.
     *
     * `CloseWonPolicy.CreateContract` is a FLAG on a JSON policy column — the same one the close operation
     * branches on. Reading the flag rather than the pipeline's name is what lets a deployment rename its
     * pipelines, or add a third, without touching this file.
     */
    private async policyRaisesContractTask(
        pipelineID: string,
        contextUser: UserInfo,
        result: CloseWonTaskResult,
    ): Promise<boolean> {
        const rv = new RunView();
        const view = await rv.RunView<{ CloseWonPolicy: string | null }>(
            {
                EntityName: E_PIPELINE,
                ExtraFilter: `ID = '${pipelineID}'`,
                ResultType: 'simple',
                Fields: ['CloseWonPolicy'],
            },
            contextUser,
        );
        if (!view.Success) {
            result.Issues.push(`The pipeline's policy could not be read: ${view.ErrorMessage}`);
            result.Success = false;
            return false;
        }

        const raw = (view.Results ?? [])[0]?.CloseWonPolicy;
        if (!raw) {
            // No policy is a legitimate state — it means the pipeline raises no contract, not an error.
            return false;
        }

        try {
            const policy = JSON.parse(raw) as PolicyCreateContract;
            return policy.CreateContract === true;
        } catch (err) {
            result.Issues.push(`The pipeline's CloseWonPolicy is not valid JSON: ${String(err)}`);
            result.Success = false;
            return false;
        }
    }
}
