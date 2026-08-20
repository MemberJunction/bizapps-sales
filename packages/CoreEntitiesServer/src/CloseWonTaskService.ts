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
 * ── IT IS NOT WIRED INTO THE CLOSE ──────────────────────────────────────────────────────────────────
 *
 * Deliberately. `Sales.CloseDeal` is mid-rework for the embedded-order redesign, and wiring a new call
 * into a file being restructured is how two changes become one debugging session. The caller passes IDs;
 * this service creates records. Wiring lands after that rework.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    LogError,
    Metadata,
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
     * `TaskType` IDs. Supplied, never looked up by name — see the note at the top of this file.
     *
     * OPTIONAL because they come from configuration (`CloseWonPolicy.CloseWonTasks`) and a deployment
     * may not have set them yet. Absent means the task is not created and an issue says so — inventing
     * a type would put finance's work under a label nobody filters on.
     */
    OrderReviewTaskTypeID?: string;
    /** Required only when the policy raises a contract task. */
    ContractTaskTypeID?: string;
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
    OrderReviewTaskTypeID?: string | null;
    ContractTaskTypeID?: string | null;
    /** The assignee's entity NAME — in practice `'MJ_BizApps_Common: People'`. */
    AssigneeEntityName?: string | null;
    /** The assignee record. NULL by default: an unconfigured deployment routes nothing. */
    AssigneeRecordID?: string | null;
    /** Which `TaskRole` the assignee holds. Optional — `TaskAssignment.RoleID` is nullable. */
    AssigneeRoleID?: string | null;
}

/**
 * Reads the task configuration out of a `CloseWonPolicy`, tolerating every absent shape.
 *
 * Exported so the close operation can map policy to service input in one line rather than reaching
 * into the JSON itself — the shape belongs with the service that consumes it.
 */
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
        if (input.OrderID && !input.OrderReviewTaskTypeID) {
            result.Issues.push(
                'No order-review task type is configured on the pipeline\'s CloseWonPolicy '
                    + '(CloseWonTasks.OrderReviewTaskTypeID), so the order-review task was not created.',
            );
            result.Success = false;
        }
        const orderReview = (input.OrderID && input.OrderReviewTaskTypeID) ? await this.raise(
            'OrderReview',
            {
                Name: `Review order for deal ${input.DealID}`,
                TypeID: input.OrderReviewTaskTypeID,
                Description:
                    'Review the order for accuracy, correct it if needed, then advance it. Advancing is '
                    + 'the confirm that locks the order, books the journal entries and triggers invoicing.',
            },
            { EntityName: 'MJ_BizApps_Orders: Order Headers', RecordID: input.OrderID },
            input,
            provider,
            contextUser,
            result,
        ) : null;
        if (orderReview) {
            result.Tasks.push(orderReview);
        }

        if (await this.policyRaisesContractTask(input.PipelineID, contextUser, result)) {
            if (!input.ContractTaskTypeID) {
                result.Issues.push(
                    'The pipeline policy raises a contract-processing task, but no ContractTaskTypeID was '
                        + 'supplied, so it was not created.',
                );
                result.Success = false;
            } else {
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
                        Name: `Process contract for deal ${input.DealID}`,
                        TypeID: input.ContractTaskTypeID,
                        Description:
                            'Attach the executed PDF, confirm the agreement version against the signed '
                            + 'document, record the executed/effective/end dates, validate whether the '
                            + 'template was modified and capture any deviations, then move the contract to '
                            + 'its active status.',
                    },
                    target,
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
    private async raise(
        kind: CloseWonTaskKind,
        task: { Name: string; TypeID: string; Description: string },
        target: CloseWonTaskTarget,
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

        const linked = await this.link(taskID, target, provider, contextUser, result, kind);
        if (!linked) {
            result.Success = false;
        }

        const assignmentID = await this.route(taskID, input, contextUser, result, kind);
        if (!assignmentID) {
            result.Success = false;
        }

        return {
            Kind: kind,
            TaskID: taskID,
            LinkedEntityName: target.EntityName,
            LinkedRecordID: target.RecordID,
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

        const md = new Metadata();
        const link = await md.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(E_TASK_LINK, contextUser);
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
        const md = new Metadata();
        const assigneeEntity = md.Entities.find((e) => e.Name === input.Assignee!.EntityName);
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
