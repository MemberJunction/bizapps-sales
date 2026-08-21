/**
 * @fileoverview `Sales.CloseDeal` and `Sales.ReopenDeal` — master plan §7.
 *
 * ONE TRANSACTION, ALL-OR-NONE. A partial close — contract created, order missing, lock applied — is
 * the exact failure the transaction exists to prevent (§7.2). Everything below happens inside a single
 * provider transaction, and any throw rolls the whole thing back.
 *
 * ── THE PATH IS RESOLVED FROM FLAGS, NEVER NAMES ────────────────────────────────────────────────
 *
 * The operation is called `CloseDeal`, not `WinDeal`, on purpose. It reads `IsWon` / `IsLost` /
 * `LocksDeal` off the target `DealStatusType` row and branches on those. Nothing here compares a
 * status name, a pipeline name, or the strings "B2B" / "D2C" — a deployment renames those freely and a
 * rename must not change what a close does. Routing comes from `Pipeline.CloseWonPolicy`, which is
 * config-as-data, and from nowhere else. The CI vocabulary grep enforces this.
 *
 * ── SALES STILL COMPUTES NO MONEY ───────────────────────────────────────────────────────────────
 *
 * The close routes lines and passes intent. It does not price them, total them, or apply a discount.
 * Every figure comes back from orders, and while the downstream is stubbed no figure exists at all —
 * which is honest rather than convenient.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseRemotableOperation,
    DatabaseProviderBase,
    IMetadataProvider,
    IRunViewProvider,
    LogError,
    RunView,
    UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    SalesCloseDealOperation as SalesCloseDealOperationBase,
    SalesReopenDealOperation as SalesReopenDealOperationBase,
    StubDownstreamSeam,
    type ContractsCreateFromDealSeamInput,
    type ContractsRenewTermSeamInput,
    type ContractsSeamResult,
    type IDownstreamSeam,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
    type SalesCloseIssue,
    type SalesCloseRoutingResult,
    type SalesCloseWonPolicy,
    type SalesReopenDealInput,
    type SalesReopenDealOutput,
} from '@mj-biz-apps/sales-entities';

import { DealEntityServer } from './DealEntityServer.js';
import { OrdersIsInstalled } from './orders-availability.js';
import { ContractsIsInstalled, LiveContractsSeam } from './LiveContractsSeam.js';
import { CloseWonTaskDueAt, CloseWonTaskService, ReadCloseWonTaskConfig } from './CloseWonTaskService.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';
const DEAL_TYPE_ENTITY = 'MJ_BizApps_Sales: Deal Types';
const LOSS_REASON_ENTITY = 'MJ_BizApps_Sales: Loss Reasons';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';
// Read to resolve a closing stage by the FLAG its status carries -- see closingStageForOutcome.
const STAGE_ENTITY = 'MJ_BizApps_Sales: Pipeline Stages';
/**
 * READ, never written. This operation stopped writing to the stage log — it declares the transition and
 * `DealEntityServer` appends the one row it owes (see `DeclareTransition`). It reads the log because the
 * log is where the answer to "what stage was this deal in before it closed" already lives.
 */
const STAGE_EVENT_ENTITY = 'MJ_BizApps_Sales: Deal Stage Events';

/** The behaviour flags a close reads off the target status. Never its name. */
interface StatusFlags {
    ID: string;
    IsWon: boolean;
    IsLost: boolean;
    IsClosed: boolean;
    LocksDeal: boolean;
}

/** Defaults applied when a pipeline's policy is silent on a key. */
const POLICY_DEFAULTS: SalesCloseWonPolicy = {
    CreateContract: false,
    SubscriptionLinesTo: 'None',
    // `OrderState` IS GONE FROM THE POLICY ENTIRELY, and not because it was merely unread.
    //
    // A close-time key could only ever speak at one moment, and only about a won close. The stage is
    // where the answer belongs: `PipelineStage.OrderStatusOnEntry` says what entering ANY stage means
    // for the order -- won, lost, or halfway -- and it is one source of truth rather than a policy key
    // that agreed with the stage table by luck. Ruled by Andrew, `docs/DECISIONS.md` D-OS1. Removed
    // from the published input contract in the same commit, because two spellings of the same idea is
    // the problem being solved.
    //
    // `OneTimeLinesTo` is still DEAD but still here: it steered one-time lines to the Order route,
    // which no longer exists. Narrowing the published contract is its own decision and Andrew has not
    // made it -- see `DECISIONS-NEEDED.md` DN-11. A deployment setting it is configuring nothing.
    OneTimeLinesTo: 'None',
};

function issue(Section: SalesCloseIssue['Section'], Message: string, Field: string | null = null): SalesCloseIssue {
    return { Section, Field, Severity: 'error', Message };
}

/**
 * The deal's order-status warnings, as Issues — the channel D-OS1's rule 3 needs.
 *
 * A stage change that asks the order for a status orders refuses must not fail the operation, so the
 * refusal cannot be an error. It also must not be silent, or the one case S-US8 GUARANTEES will happen —
 * a reopened lost deal whose order is Voided — reads as a clean reopen that quietly did half the job.
 *
 * `Severity: 'warning'` is already in the published union, so this needs no contract change.
 */
function orderStatusIssues(deal: DealEntityServer): SalesCloseIssue[] {
    return deal.OrderStatusWarnings.map((Message) => ({
        Section: 'deal' as const,
        Field: 'PipelineStageID',
        Severity: 'warning' as const,
        Message,
    }));
}

/**
 * The seam the close flow calls downstream.
 *
 * A module-level default rather than a constructor argument because remote operations are built by the
 * ClassFactory with no arguments. {@link SetDownstreamSeam} is how a test — or a future real
 * implementation — replaces it.
 */
let downstreamSeam: IDownstreamSeam = new StubDownstreamSeam();
/** Set once a caller overrides the seam explicitly, so auto-selection stops second-guessing them. */
let seamWasSetExplicitly = false;

/** Swap the downstream implementation. Returns the previous one so a test can restore it. */
export function SetDownstreamSeam(seam: IDownstreamSeam): IDownstreamSeam {
    const previous = downstreamSeam;
    downstreamSeam = seam;
    seamWasSetExplicitly = true;
    return previous;
}

export function GetDownstreamSeam(): IDownstreamSeam {
    return downstreamSeam;
}

/**
 * Undo {@link SetDownstreamSeam} and return to DEPLOYMENT-BASED selection.
 *
 * Needed because `SetDownstreamSeam` latches: it records that a caller took control, so auto-selection
 * stops second-guessing them. A test that installs a fake and then merely sets the old value back would
 * leave that latch on, and every later check in the process would keep using whatever it restored —
 * silently, and only on hosts where the live seam would otherwise have been chosen.
 */
export function ResetDownstreamSeam(): void {
    downstreamSeam = new StubDownstreamSeam();
    seamWasSetExplicitly = false;
}

/**
 * Choose the seam for THIS execution.
 *
 * Deployment decides, not configuration: if orders' entities are registered, the live handoff is used;
 * if they are not — sales installed standalone, which is supported — the stub records the intent and
 * reports `Executed: false`. An explicit {@link SetDownstreamSeam} always wins, because a test that
 * installed a fake must not have it silently replaced by the real thing.
 *
 * Built per call rather than cached because it closes over the acting user, and a seam that reused the
 * first caller's identity would write orders' records as the wrong person.
 */
function resolveSeam(user: UserInfo, provider: IMetadataProvider): IDownstreamSeam {
    if (seamWasSetExplicitly) {
        return downstreamSeam;
    }

    /**
     * ── THERE IS ONLY ONE LIVE DOWNSTREAM LEFT, SO THERE IS ONLY ONE THING TO RESOLVE ───────────────
     *
     * This used to compose two halves: an orders seam wrapping a contracts seam, plus a stub-orders
     * variant for a contracts-without-orders host. All of that existed because close-won CREATED the
     * order a won deal earned. It does not any more — the order is embedded on the deal from creation —
     * so `LiveOrdersSeam` lost its two real methods and ended as a 128-line pass-through that forwarded
     * the contract calls to the seam it had been handed. Wrapping a seam in a class that only forwards to
     * it is not composition; it is a layer to read past. Both it and `StubOrdersWithContracts` are gone.
     *
     * The independence the old comment defended is preserved and is now simply true by construction:
     * contracts resolves on its own flag and orders is not consulted here at all. A host with contracts
     * and no orders gets the live contracts seam, which is exactly what `StubOrdersWithContracts` was
     * built to arrange.
     *
     * `OrdersIsInstalled()` still matters to the close — it decides whether an orders-dependent route is
     * available — and now lives in `orders-availability.js`, because it answers a question about the HOST
     * rather than about a seam.
     */
    return ContractsIsInstalled() ? new LiveContractsSeam(user, provider) : new StubDownstreamSeam();
}


@RegisterClass(BaseRemotableOperation, 'Sales.CloseDeal')
export class CloseDealOperation extends SalesCloseDealOperationBase {
    protected async InternalExecute(
        input: SalesCloseDealInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesCloseDealOutput> {
        const empty: SalesCloseDealOutput = {
            Success: false,
            Issues: [],
            IsWon: false,
            IsLost: false,
            Locked: false,
            Routing: [],
            WasPreview: input?.PreviewOnly === true,
        };

        if (!input?.DealID) {
            return { ...empty, Issues: [issue('deal', 'A deal is required.', 'DealID')] };
        }
        if (!input.DealStatusTypeID) {
            return { ...empty, Issues: [issue('deal', 'A target status is required.', 'DealStatusTypeID')] };
        }

        const db = provider as unknown as DatabaseProviderBase;
        let transactionOpen = false;

        try {
            // ── 1. Load the deal and resolve the target status FLAGS ──────────────
            const deal = await provider.GetEntityObject<DealEntityServer>(DEAL_ENTITY, user);
            if (!(await deal.Load(input.DealID))) {
                return { ...empty, Issues: [issue('deal', `Deal ${input.DealID} was not found.`, 'DealID')] };
            }

            const target = await this.loadStatusFlags(input.DealStatusTypeID, provider, user);
            if (!target) {
                return {
                    ...empty,
                    Issues: [issue('deal', `Status ${input.DealStatusTypeID} was not found.`, 'DealStatusTypeID')],
                };
            }

            // Already locked? Refuse before doing anything — reopening is the sanctioned path.
            const current = deal.DealStatusTypeID
                ? await this.loadStatusFlags(deal.DealStatusTypeID, provider, user)
                : null;
            if (current?.LocksDeal) {
                return {
                    ...empty,
                    Issues: [
                        issue(
                            'deal',
                            'This deal is already closed and locked. Reopen it through Sales.ReopenDeal first.',
                        ),
                    ],
                };
            }

            // ── 2. Validate what this particular close requires ───────────────────
            const validation = await this.validate(deal, input, target, provider, user);
            if (validation.length) {
                return { ...empty, IsWon: target.IsWon, IsLost: target.IsLost, Issues: validation };
            }

            // ── 3. Resolve the effective policy, and route ────────────────────────
            // A LOST deal routes nowhere: §7.2 step 2 writes the stage event, locks, and is done.
            const policy = target.IsWon
                ? await this.resolvePolicy(deal, input, provider, user)
                : { ...POLICY_DEFAULTS };

            const routing: SalesCloseRoutingResult[] = target.IsWon
                ? await this.planRouting(deal, policy, provider, user)
                : [];

            /**
             * THE UNROUTABLE-LINE REFUSAL (KI-14) WAS HERE, and it is gone with the table it guarded.
             *
             * It refused a close when a line carried a product NAME with no `ProductID`, because both
             * builders coerced that to `ProductID: ''` and an empty string against a `uniqueidentifier`
             * failed inside the sibling's save — after the status had been written. Deal won, nothing
             * downstream.
             *
             * That shape cannot be constructed any more. `OrderLine.ProductID` is `NOT NULL` with a real
             * FK to the catalogue, so a line without a product does not exist to be refused. Recorded as
             * deliberate in docs/DECISIONS.md D-DL1 rather than left to be noticed missing.
             *
             * The HubSpot half of KI-14 survives as an IMPORT concern: a deal imported with a product
             * name and no catalogue ID now fails when the importer tries to write the order line, which
             * is the right place for it to fail.
             */

            if (input.PreviewOnly) {
                // Nothing written, nothing locked — the caller just wanted to see the consequences.
                return {
                    Success: true,
                    Issues: [],
                    IsWon: target.IsWon,
                    IsLost: target.IsLost,
                    Locked: false,
                    EffectivePolicy: policy,
                    Routing: routing,
                    WasPreview: true,
                };
            }

            // ── 4. Execute: one transaction, all-or-none ──────────────────────────
            await db.BeginTransaction();
            transactionOpen = true;

            for (const plan of routing) {
                await this.execute(plan, deal, policy, provider, user);
            }

            /**
             * THE FINANCE TASKS A WON DEAL OWES (S-US2 #34, S-US3 #35).
             *
             * INSIDE the transaction, deliberately and on evidence. `TaskOrchestrationService` writes
             * through the global `Metadata.Provider`, which in a server process is the SAME provider this
             * operation opened its transaction on — so the writes join it and a rolled-back close takes
             * the tasks with it. Measured rather than assumed: a probe that created a task inside an
             * ambient transaction and rolled back found the row gone, and the integration suite has
             * created hundreds of task rows inside rolled-back checks without leaving one behind.
             *
             * Its issues are folded in as WARNINGS, not errors. The deal really did close and its
             * provenance is written; an unconfigured task type or a missing finance assignee is a
             * deployment gap to surface, not a reason to refuse a close that has already succeeded.
             * `Section: 'deal'` because the issue vocabulary has no tasks section — worth adding when
             * the surface exists to badge it.
             */
            const taskIssues: SalesCloseIssue[] = [];

            /**
             * The stage this close lands in, resolved BEFORE the stamp because `stampClose` is
             * synchronous and this needs two reads. `input.ClosingStageID` wins when supplied.
             */
            const derivedClosingStageID = input.ClosingStageID
                ? null
                : await this.closingStageForOutcome(deal.PipelineID, target, provider, user);

            this.stampClose(deal, input, target, routing, user, derivedClosingStageID);

            if (!(await deal.Save())) {
                throw new Error(
                    `the deal could not be saved: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }

            // The save appended the close's `DealStageEvent` — one row, whether or not the stage moved.
            // Read AFTER it for the same reason `OrderID` is: the row does not exist until then.
            const stageEvent = deal.LastStageEventID;

            /**
             * ── THE TASKS RUN **AFTER** THE SAVE, AND THAT IS THE FIX RATHER THAN A TIDY-UP ──────────
             *
             * This block used to sit twenty lines earlier, before `deal.Save()`, and it read
             * `deal.OrderID`. That was correct until provisioning MOVED INTO `Save()` this round. After
             * that move, closing any deal that did not already carry an order — every seeded, legacy and
             * imported deal — read an EMPTY OrderID, so the service reported
             *
             *     "The deal has no order, so no order-review task was created…"
             *
             * as a warning on a SUCCESSFUL close, raised no order-review task, and then `Save()` created
             * the order a moment later. Finance got nothing, and the warning stated the opposite of what
             * had just happened. Two rules that were each right on their own, in the wrong order.
             *
             * Reading after the save is the smaller of the two available fixes: provisioning explicitly
             * beforehand would put a second caller in the business of knowing when an order is due, which
             * is exactly what moving it into `Save()` was for.
             *
             * STILL INSIDE THE TRANSACTION. `CommitTransaction` is below, so the tasks remain
             * all-or-none with the close — `close-won-tasks.WT9` is the check that pins that.
             *
             * ── AND `ContractID` IS PASSED, WHICH IT NEVER WAS ──────────────────────────────────────
             *
             * `executeRoute` sets `deal.ContractID` in the routing loop that runs before this, so the
             * value has been available all along and the input literal simply omitted it. The service's
             * `if (input.ContractID)` branch was therefore UNREACHABLE from production, and its
             * "contracts is not installed" fallback was dead code. Every contract-processing task linked
             * the DEAL instead of the contract it exists to process, and nothing reported it, because the
             * branch that would have reported it is the one that never ran.
             */
            if (target.IsWon) {
                const cfg = ReadCloseWonTaskConfig(policy);
                const taskResult = await new CloseWonTaskService().CreateCloseWonTasks(
                    {
                        DealID: deal.ID,
                        // Read AFTER the save: provisioning happens inside it. See the note above.
                        OrderID: String(deal.OrderID ?? ''),
                        PipelineID: deal.PipelineID,
                        // Set by the routing loop above. Omitting it is what made the contract task link
                        // the deal, and made the service's own fallback message unreachable.
                        ContractID: deal.ContractID ?? undefined,
                        /**
                         * ── A DUE DATE, WHICH THESE TASKS HAVE NEVER HAD ────────────────────────
                         *
                         * `CloseWonTaskService` accepts `DueAt` and passes it straight to tasks'
                         * `CreateTask`; this operation simply never supplied one. So every task the app
                         * has ever raised carried a NULL due date, and everything downstream that reads
                         * one was inert for our tasks: `Task.DueAt`, `IsOverdue`, the Overdue KPI and the
                         * `OnOverdue` hook all already exist in tasks and all had nothing to act on.
                         *
                         * Nothing to build there — only to populate. Dated from the close itself rather
                         * than from `new Date()` so the task's clock and the deal's provenance agree, and
                         * so a close replayed inside a transaction is deterministic.
                         */
                        DueAt: CloseWonTaskDueAt(deal.ClosedAt ?? new Date(), cfg.DueInDays),
                        // No task-type IDs: the service resolves both by Code from rows this repo
                        // seeds. What the policy still carries is the part that varies — the assignee.
                        Assignee: cfg.AssigneeRecordID
                            ? {
                                  EntityName: cfg.AssigneeEntityName ?? 'MJ_BizApps_Common: People',
                                  RecordID: cfg.AssigneeRecordID,
                                  RoleID: cfg.AssigneeRoleID ?? undefined,
                              }
                            : undefined,
                    },
                    provider,
                    user,
                );
                for (const message of taskResult.Issues) {
                    taskIssues.push({ Section: 'deal', Field: null, Severity: 'warning', Message: message });
                }
            }

            await db.CommitTransaction();
            transactionOpen = false;

            return {
                Success: true,
                /**
                 * TWO SOURCES OF NON-FATAL WARNINGS, ONE FIELD, AND A STATED ORDER.
                 *
                 * Both arrived independently: the close creates finance's tasks (S-US2/S-US3) and can
                 * also move the deal into a CLOSING stage whose `OrderStatusOnEntry` names an order
                 * status — `Voided` on a lost stage (S-US7). Either can decline without failing the
                 * close: a task type that will not resolve, or orders refusing `Voided -> Quoted` on a
                 * reopened lost deal, which S-US8 says WILL happen.
                 *
                 * Each side of the merge assigned this field alone, so taking either textually would
                 * have SILENTLY DROPPED the other's warnings — a close that quietly did half its
                 * downstream work and reported success. Concatenated deliberately instead, in the order
                 * the work actually happened: the tasks are created above, and the order status is
                 * written inside `deal.Save()` a few lines further down. So a reader of the array reads
                 * the close in sequence, which is the only ordering that means anything here.
                 */
                Issues: [...taskIssues, ...orderStatusIssues(deal)],
                IsWon: target.IsWon,
                IsLost: target.IsLost,
                Locked: target.LocksDeal,
                EffectivePolicy: policy,
                Routing: routing,
                DealStageEventID: stageEvent,
                ClosedAt: deal.ClosedAt ? String(deal.ClosedAt) : null,
                WasPreview: false,
            };
        } catch (err) {
            if (transactionOpen) {
                try {
                    await (provider as unknown as DatabaseProviderBase).RollbackTransaction();
                } catch (rollbackErr) {
                    LogError(`Sales.CloseDeal: rollback failed: ${rollbackErr}`);
                }
            }
            LogError(`Sales.CloseDeal failed: ${err}`);
            return { ...empty, Issues: [issue('deal', `The deal could not be closed: ${err}`)] };
        }
    }

    /* ── Validation (§7.2 step 1–2) ─────────────────────────────────────────── */

    /**
     * What this close requires before it may proceed.
     *
     * The loss-reason rule is the app's ONLY mandatory field and the friction is deliberate: loss
     * reasons are the highest-value and most consistently-skipped data in any CRM (§7.2).
     */
    private async validate(
        deal: DealEntityServer,
        input: SalesCloseDealInput,
        target: StatusFlags,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesCloseIssue[]> {
        const issues: SalesCloseIssue[] = [];

        if (target.IsLost) {
            const lossReasonID = input.LossReasonID ?? deal.LossReasonID;
            if (!lossReasonID) {
                issues.push(issue('deal', 'A loss reason is required to close a deal as lost.', 'LossReasonID'));
            } else {
                // Some reasons demand an explanation — the flag says which, never the reason's name.
                const view = provider as unknown as IRunViewProvider;
                const r = await view.RunView(
                    {
                        EntityName: LOSS_REASON_ENTITY,
                        ExtraFilter: `ID = '${lossReasonID}'`,
                        ResultType: 'simple',
                        Fields: ['RequiresNotes'],
                    },
                    user,
                );
                const row = (r.Results ?? [])[0] as { RequiresNotes?: boolean } | undefined;
                const notes = input.LossNotes ?? deal.LossNotes;
                if (r.Success && row?.RequiresNotes === true && !notes?.trim()) {
                    issues.push(issue('deal', 'This loss reason requires notes explaining the loss.', 'LossNotes'));
                }
            }
        }

        if (target.IsWon && !deal.AccountID) {
            issues.push(issue('party', 'A won deal must be attached to a customer.', 'AccountID'));
        }

        return issues;
    }

    /* ── Policy (§7.1) ──────────────────────────────────────────────────────── */

    /**
     * Pipeline default, with the caller's overrides merged over it (§7.1, D-CF6).
     *
     * A malformed policy is a WARNING-shaped failure that falls back to defaults rather than throwing:
     * a pipeline with unparseable JSON should not make its deals uncloseable, and the effective policy
     * is returned to the caller so the fallback is visible rather than silent.
     */
    private async resolvePolicy(
        deal: DealEntityServer,
        input: SalesCloseDealInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesCloseWonPolicy> {
        let fromPipeline: SalesCloseWonPolicy = {};

        const view = provider as unknown as IRunViewProvider;
        const r = await view.RunView(
            {
                EntityName: PIPELINE_ENTITY,
                ExtraFilter: `ID = '${deal.PipelineID}'`,
                ResultType: 'simple',
                Fields: ['CloseWonPolicy'],
            },
            user,
        );
        const raw = ((r.Results ?? [])[0] as { CloseWonPolicy?: string } | undefined)?.CloseWonPolicy;
        if (r.Success && raw) {
            try {
                fromPipeline = JSON.parse(raw) as SalesCloseWonPolicy;
            } catch {
                LogError(`Sales.CloseDeal: pipeline ${deal.PipelineID} has unparseable CloseWonPolicy; using defaults`);
            }
        }

        return { ...POLICY_DEFAULTS, ...fromPipeline, ...(input.PolicyOverrides ?? {}) };
    }

    /* ── Routing (§7.2 steps 4–5) ───────────────────────────────────────────── */

    /**
     * What the policy says should happen, before anything is attempted.
     *
     * ── THERE IS NO LONGER AN ORDER ROUTE, AND THAT IS THE POINT ──
     *
     * Close-won used to create the order. It no longer does: the order is an EMBEDDED RECORD created
     * with the deal and carrying its lines from the start (S-US4), so by the time a deal closes the
     * order already exists. S-US5 is explicit that Closed Won leaves its status ALONE and editable, so
     * finance can review and correct before the Confirm that locks it and triggers invoicing.
     *
     * So close-won no longer counts lines at all — there are none on the deal to count. What it plans
     * is the CONTRACT (B2B only), and the still-unbuilt Subscription materialization.
     */
    private async planRouting(
        deal: DealEntityServer,
        policy: SalesCloseWonPolicy,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesCloseRoutingResult[]> {
        const plans: SalesCloseRoutingResult[] = [];

        if (policy.CreateContract === true) {
            // LineCount 0, and not a placeholder: S-US2's contract is a header — customer, company,
            // contact, type defaults, template, number, the linked pair and TemplateModified. It has no
            // line items, which is the same consolidation that retired DealLine.
            plans.push({ Target: 'Contract', Planned: true, Executed: false, LineCount: 0 });
        }
        if (policy.SubscriptionLinesTo === 'Subscription') {
            plans.push({
                Target: 'Subscription',
                Planned: true,
                Executed: false,
                LineCount: 0,
                Reason:
                    'Subscription materialization needs orders\' Subscription.BillingMode (C0), which does ' +
                    'not exist yet.',
            });
        }
        return plans;
    }

    /** Attempt one planned route through the seam, recording honestly whether it executed. */
    private async execute(
        plan: SalesCloseRoutingResult,
        deal: DealEntityServer,
        policy: SalesCloseWonPolicy,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<void> {
        const seam = resolveSeam(user, provider);

        if (plan.Target === 'Contract') {
            // A renewal takes a different door: RenewTerm against the contract being renewed, not a
            // new agreement. Decided by DealType.RequiresRenewalSource — a flag, not a type name.
            const isRenewal = await this.dealTypeRequiresRenewalSource(deal.DealTypeID, provider, user);
            const result = isRenewal
                ? await seam.RenewContractTerm({
                      ContractID: deal.RenewsContractID ?? '',
                      DealID: deal.ID,
                      TermMonths: policy.TermMonths ?? deal.TermMonths ?? null,
                  })
                : await seam.CreateContractFromDeal(await this.buildContractInput(deal, policy, provider, user));

            plan.Executed = result.Success === true;
            plan.RecordID = result.ContractID ?? null;
            plan.Reason = result.Success ? null : result.Message ?? 'not executed';
            if (result.Success && result.ContractID) {
                // §7.2 step 4: stamp the agreement onto the deal.
                deal.ContractID = result.ContractID;
            }
            return;
        }


        // Subscription materialization has no seam at all yet; the plan already carries its reason.
        plan.Executed = false;
    }

    /**
     * The stage a close should land in, when the caller did not name one.
     *
     * ── THE MIRROR OF `priorStageFromCloseEvent`, AND THE OTHER HALF OF DN-18 ───────────────────────
     *
     * `CD18` proves a reopen restores the stage the deal came from. It could not help a deal closed
     * through the browser, because `DealWorkspaceComponent.ConfirmClose()` sends no `ClosingStageID` — so
     * no browser-driven close ever moved the stage, every close event recorded
     * `FromStageID === ToStageID`, and the reopen correctly derived the stage the deal was already in.
     * The mechanism was right and the UI could not reach it. `71-lost-and-reopen` is the spec that names
     * this.
     *
     * Fixed in the OPERATION rather than in `ConfirmClose`, for the fourth time and the same reason: an
     * agent, an importer and an API caller all close deals too, and a rule the app owns belongs on the
     * write path. `input.ClosingStageID` stays an override.
     *
     * ── CHOSEN BY FLAG, WHICH IS THE ONLY WAY THIS CAN WORK ────────────────────────────────────────
     *
     * The stage on the deal's OWN pipeline whose declared `DealStatusType` matches the outcome being
     * recorded — `IsWon` for a won close, `IsLost` for a lost one. Never a name: a pipeline is free to
     * call its winning stage "Signed", "Booked" or anything else, and §3 is what makes that a label.
     *
     * Returns null rather than guessing when the pipeline declares no such stage. A deal on a pipeline
     * with no losing stage closes as lost without moving, exactly as it did before this existed — the
     * close is never blocked by the absence of somewhere to put it.
     *
     * ── AND IT LEANS ON TWO GUARDS THAT ARE NOW LOAD-BEARING ───────────────────────────────────────
     *
     * Moving into a stage that declares a LOCKING status is only safe because `applyStageDefaults` refuses
     * to derive a locking status (`SD35`), so the stage cannot close the deal a second time; and the
     * closing status stays authoritative because a declared transition suppresses stage defaults entirely
     * (`CD17`). Both are mutant-proven. Without them this change would double-close every deal it touched.
     */
    private async closingStageForOutcome(
        pipelineID: string | null,
        target: StatusFlags,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<string | null> {
        if (!pipelineID || (!target.IsWon && !target.IsLost)) {
            return null;   // an outcome that is neither won nor lost names no stage
        }
        const view = provider as unknown as IRunViewProvider;
        const statuses = await view.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: target.IsWon ? 'IsWon = 1' : 'IsLost = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            user,
        );
        if (!statuses.Success) {
            return null;
        }
        const ids = (statuses.Results ?? []).map((r) => String((r as { ID: string }).ID)).filter(Boolean);
        if (ids.length === 0) {
            return null;
        }

        const quoted = ids.map((id) => `'${id}'`).join(', ');
        const stages = await view.RunView(
            {
                EntityName: STAGE_ENTITY,
                ExtraFilter:
                    `PipelineID = '${pipelineID}' AND IsActive = 1 AND DealStatusTypeID IN (${quoted})`,
                OrderBy: 'DisplayOrder ASC',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            user,
        );
        if (!stages.Success) {
            return null;
        }
        const row = (stages.Results ?? [])[0] as { ID?: string } | undefined;
        return row?.ID ? String(row.ID) : null;
    }

    /* ── The close stamp (§7.2 step 6) ──────────────────────────────────────── */

    /**
     * Append the provenance row and stamp the deal.
     *
     * `DealStageEvent` is APPEND-ONLY and stamps `AmountAtTransition` / `ProbabilityAtTransition`,
     * because "what did we think this was worth when we closed it" is unanswerable later once amounts
     * change. The routing outcome goes into `Notes` — which is what preserves the intent of a close
     * whose downstream was stubbed (D-CF1).
     *
     * §7 also calls for writing an `Activity` here. The Activity spine does not exist in common or MJ
     * core, so that step is skipped and recorded in CLOSE-FLOW-DECISIONS.md D-CF5 rather than faked.
     */
    private stampClose(
        deal: DealEntityServer,
        input: SalesCloseDealInput,
        target: StatusFlags,
        routing: SalesCloseRoutingResult[],
        user: UserInfo,
        derivedClosingStageID: string | null,
    ): void {
        /**
         * ── DECLARED, NOT WRITTEN. THIS METHOD USED TO APPEND THE ROW ITSELF ────────────────────────
         *
         * It built a `DealStageEvent` here and then set `deal.PipelineStageID` below — so `Save()` saw a
         * stage change and appended a SECOND row for the same close. Every close that passed a
         * `ClosingStageID` doubled its own provenance, and `CD4` was blind to it because it never passes
         * one.
         *
         * `DeclareTransition` hands the entity the one thing it could not derive — the routing note — and
         * leaves the writing to the single writer, which also suppresses the stage defaults so a close's
         * probability is not re-derived from the stage it lands in. The `From`/`To` stamps come out the
         * same, because the entity reads them from `OldValue`, which is what this method read too.
         *
         * The event id is no longer available here: it exists only once the save has appended the row.
         * The caller reads `deal.LastStageEventID` afterwards.
         */
        deal.DeclareTransition('Close', this.routingNote(routing, input.Notes));

        // Everything stored is UTC — getUTC*, never local-time getters, for anything persisted.
        const now = new Date();
        deal.DealStatusTypeID = target.ID;
        // Derived when the caller named no stage -- see closingStageForOutcome. This is what gives a
        // browser-driven close a stage to move into, and therefore gives the reopen something to restore.
        const closingStage = input.ClosingStageID ?? derivedClosingStageID;
        if (closingStage) {
            deal.PipelineStageID = closingStage;
        }
        if (input.LossReasonID) {
            deal.LossReasonID = input.LossReasonID;
        }
        if (input.LossNotes) {
            deal.LossNotes = input.LossNotes;
        }
        deal.ClosedAt = now;
        deal.ClosedByUserID = user.ID;
        // ActualCloseDate is a DATE, not a datetime: truncate at UTC midnight so a deal closed at
        // 23:00 UTC does not land in tomorrow's period for a reader in another timezone.
        deal.ActualCloseDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
    }

    /** A human-readable record of what the policy routed, and what actually happened. */
    private routingNote(routing: SalesCloseRoutingResult[], callerNote?: string | null): string {
        const parts: string[] = [];
        if (callerNote?.trim()) {
            parts.push(callerNote.trim());
        }
        if (routing.length === 0) {
            parts.push('Closed. Policy routed nothing downstream.');
        } else {
            for (const r of routing) {
                parts.push(
                    r.Executed
                        ? `${r.Target}: created ${r.RecordID ?? '(no id)'} (${r.LineCount} line(s)).`
                        : `${r.Target}: PLANNED but not executed (${r.LineCount} line(s)) — ${r.Reason ?? 'no reason given'}`,
                );
            }
        }
        return parts.join(' ');
    }

    /* ── Helpers ────────────────────────────────────────────────────────────── */

    private async loadStatusFlags(
        statusID: string,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<StatusFlags | null> {
        const view = provider as unknown as IRunViewProvider;
        const r = await view.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID = '${statusID}'`,
                ResultType: 'simple',
                Fields: ['ID', 'IsWon', 'IsLost', 'IsClosed', 'LocksDeal'],
            },
            user,
        );
        if (!r.Success) {
            return null;
        }
        const row = (r.Results ?? [])[0] as Record<string, unknown> | undefined;
        if (!row) {
            return null;
        }
        return {
            ID: String(row.ID),
            IsWon: row.IsWon === true,
            IsLost: row.IsLost === true,
            IsClosed: row.IsClosed === true,
            LocksDeal: row.LocksDeal === true,
        };
    }

    /** Split by the type's `IsRecurring` FLAG. A join, so one read rather than one per line. */
    private async dealTypeRequiresRenewalSource(
        dealTypeID: string | null,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<boolean> {
        if (!dealTypeID) {
            return false;
        }
        const view = provider as unknown as IRunViewProvider;
        const r = await view.RunView(
            {
                EntityName: DEAL_TYPE_ENTITY,
                ExtraFilter: `ID = '${dealTypeID}'`,
                ResultType: 'simple',
                Fields: ['RequiresRenewalSource'],
            },
            user,
        );
        const row = (r.Results ?? [])[0] as { RequiresRenewalSource?: boolean } | undefined;
        return r.Success && row?.RequiresRenewalSource === true;
    }

    private async buildContractInput(
        deal: DealEntityServer,
        policy: SalesCloseWonPolicy,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<ContractsCreateFromDealSeamInput> {
        return {
            DealID: deal.ID,
            CompanyID: deal.CompanyID,
            ContractTypeCode: policy.ContractTypeCode ?? null,
            TermMonths: policy.TermMonths ?? deal.TermMonths ?? null,
            // The AD's red-lines travel with the agreement — a contract that silently dropped them
            // would send a human reviewer in blind.
            ContractVariances: deal.ContractVariances,
            // And the flag that says whether there ARE any, which is the thing finance's review keys
            // on. Reported even when the variances field is blank: the two answer different questions.
            StandardAgreementModified: deal.StandardAgreementModified,
            AutoRenew: deal.AutoRenew,
            AnnualIncreasePctOverride: deal.AnnualIncreasePctOverride,
            CancellationNoticeDaysOverride: deal.CancellationNoticeDaysOverride,
            /**
             * STATED, BUT NOT STAMPED ONTO THE CONTRACT — and the split is deliberate.
             *
             * These are facts about the DEAL, so this method reports them faithfully. What the seam
             * does with them is the seam's business, and today it does nothing: v2 derives a
             * contract's lifecycle from its dates, so an `EffectiveDate` on a contract nobody has
             * approved yet would make it read as live and in force. `LiveContractsSeam` records the
             * reasoning in full; the point here is that a reader of this method should not conclude
             * these land on the agreement.
             */
            ExecutionDate: deal.ExecutionDate ? String(deal.ExecutionDate) : null,
            StartDate: deal.StartDate ? String(deal.StartDate) : null,
            // The buying party, so contracts can stamp the customer without looking back at the deal.
            AccountID: deal.AccountID,
            PrimaryContactID: deal.PrimaryContactID,
            /**
             * NO `BillingFrequency`, NO `CommittedAmount`, NO `Lines` — all three now have nowhere to
             * go rather than merely being unset.
             *
             * The 2026-08-18 contracts rebuild deleted `ContractTerm` and `ContractLine` outright: v2's
             * contract IS the header. Billing frequency and the committed amount were TERM columns and
             * line items were the redundancy the rework removed, so the earlier note here — that the
             * seam would apply its own billing-frequency default and that contracts' line retirement
             * was "the other half of it, on their side" — describes a schema that no longer exists.
             * Their half landed; this is ours.
             */
        };
    }
}

/**
 * `Sales.ReopenDeal` — the only sanctioned exit from the close lock (§7.3).
 *
 * Writes its own `DealStageEvent` first, so the fact that a close HAPPENED survives the close being
 * undone. Provenance is append-only: reopening adds to the record rather than erasing it.
 */
@RegisterClass(BaseRemotableOperation, 'Sales.ReopenDeal')
export class ReopenDealOperation extends SalesReopenDealOperationBase {
    protected async InternalExecute(
        input: SalesReopenDealInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesReopenDealOutput> {
        const empty: SalesReopenDealOutput = { Success: false, Issues: [], Unlocked: false };

        if (!input?.DealID) {
            return { ...empty, Issues: [issue('deal', 'A deal is required.', 'DealID')] };
        }
        // §7.3 makes this mandatory: undoing a lock has to be explainable.
        if (!input.Reason?.trim()) {
            return { ...empty, Issues: [issue('deal', 'A reason is required to reopen a closed deal.', 'Reason')] };
        }

        const db = provider as unknown as DatabaseProviderBase;
        let transactionOpen = false;

        try {
            const deal = await provider.GetEntityObject<DealEntityServer>(DEAL_ENTITY, user);
            if (!(await deal.Load(input.DealID))) {
                return { ...empty, Issues: [issue('deal', `Deal ${input.DealID} was not found.`, 'DealID')] };
            }

            const target = input.DealStatusTypeID
                ? await this.resolveTarget(input.DealStatusTypeID, provider, user)
                : await this.firstOpenStatus(provider, user);

            if (!target) {
                return {
                    ...empty,
                    Issues: [
                        issue(
                            'deal',
                            'No open status is available to reopen into. Seed a DealStatusType with IsOpen = 1.',
                            'DealStatusTypeID',
                        ),
                    ],
                };
            }
            if (target.LocksDeal) {
                return {
                    ...empty,
                    Issues: [issue('deal', 'Cannot reopen into a status that locks the deal.', 'DealStatusTypeID')],
                };
            }

            await db.BeginTransaction();
            transactionOpen = true;

            /**
             * ── SAME MECHANISM AS THE CLOSE, AND FOR A THIRD REASON BESIDES THE DUPLICATE ROW ────────
             *
             * This hand-wrote its event and then moved the stage, so a reopen that named a `StageID` got
             * two rows exactly as the close did. It also invoked the stage-DEFAULTS writer without meaning
             * to: the save re-derived `Probability` from the arriving stage, AFTER the event above had
             * stamped the value being left behind. The reopen's own provenance row disagreed with the deal
             * it described, and nothing was comparing the two.
             *
             * A declared transition answers both — one row, and the defaults writer stands down because
             * the probability on a reopened deal is a human's judgement, not the pipeline's default.
             */
            deal.DeclareTransition('Reopen', `REOPENED: ${input.Reason.trim()}`);

            deal.DealStatusTypeID = target.ID;

            /**
             * THE PRIOR STAGE, DERIVED WHEN THE CALLER DID NOT NAME ONE — DN-18.
             *
             * `input.StageID` stays an override: a caller who knows where the deal should land says so.
             * Absent that, the close event says where it came from, and restoring it is what makes
             * `OrderStatusOnEntry` fire so the order is asked to come back. A status-only close left the
             * stage where it was, so this resolves to the stage the deal is already in and nothing fires.
             */
            const landingStage = input.StageID ?? (await this.priorStageFromCloseEvent(deal.ID, provider, user));
            if (landingStage) {
                deal.PipelineStageID = landingStage;
            }
            // The close stamps describe a close that is no longer in effect; clearing them keeps every
            // rollup that tests `ClosedAt IS NOT NULL` honest. The event above preserves the history
            // (CLOSE-FLOW-DECISIONS.md D-CF8).
            deal.ClosedAt = null;
            deal.ClosedByUserID = null;
            deal.ActualCloseDate = null;

            // The save has to write the very row the lock protects, so it runs with the lock suspended
            // — scoped to this call and self-restoring.
            const saved = await deal.BeginReopen(() => deal.Save());
            if (!saved) {
                throw new Error(`the deal could not be saved: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
            }

            await db.CommitTransaction();
            transactionOpen = false;

            // The reopen SUCCEEDED even when the order refused to come back with it. That is the
            // designed outcome, not a tolerated one: S-US8's reopen enters a stage asking for `Quoted`
            // while the order sits at `Voided`, which orders treats as terminal. The deal reopens and
            // says what did not happen.
            return {
                Success: true,
                Issues: orderStatusIssues(deal),
                Unlocked: true,
                // Appended by the save under the declaration above, so read from the deal afterwards.
                DealStageEventID: deal.LastStageEventID,
            };
        } catch (err) {
            if (transactionOpen) {
                try {
                    await (provider as unknown as DatabaseProviderBase).RollbackTransaction();
                } catch (rollbackErr) {
                    LogError(`Sales.ReopenDeal: rollback failed: ${rollbackErr}`);
                }
            }
            LogError(`Sales.ReopenDeal failed: ${err}`);
            return { ...empty, Issues: [issue('deal', `The deal could not be reopened: ${err}`)] };
        }
    }

    private async resolveTarget(
        statusID: string,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<{ ID: string; LocksDeal: boolean } | null> {
        const view = provider as unknown as IRunViewProvider;
        const r = await view.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID = '${statusID}'`,
                ResultType: 'simple',
                Fields: ['ID', 'LocksDeal'],
            },
            user,
        );
        const row = (r.Results ?? [])[0] as { ID: string; LocksDeal?: boolean } | undefined;
        return r.Success && row ? { ID: String(row.ID), LocksDeal: row.LocksDeal === true } : null;
    }

    /**
     * The stage a deal was in before it was closed, from the append-only log.
     *
     * ── WHY THE OPERATION DERIVES THIS AND THE WORKSPACE DOES NOT SUPPLY IT ─────────────────────────
     *
     * DN-18. The story says a reopened deal returns to its prior stage; `DealStageEvent.FromStageID`
     * records exactly that, and `input.StageID` already existed. The only missing piece was that nobody
     * sent it — so nothing ever re-entered a stage, `OrderStatusOnEntry` never fired, and a reopened deal
     * sat pointing at a `Voided` order with nothing on screen saying so.
     *
     * Deriving it HERE rather than in the workspace keeps `input.StageID` an override instead of a
     * requirement, and means an agent, an importer and an API caller get the same restoration a rep does.
     * That is the same write-path principle as the deal number, the company stamp, the owner stamp and the
     * embedded order: if the rule is the app's, the server owns it.
     *
     * ── WHICH EVENT, AND BY FLAG RATHER THAN BY NAME ────────────────────────────────────────────────
     *
     * The most recent event whose `ToDealStatusTypeID` carries `LocksDeal` — the closing transition. Read
     * as a set of status ids first because `RunView` cannot join, and selected by the flag so a pipeline
     * calling its winning stage "Signed" and its status "Booked" is unaffected (§3).
     *
     * A deal closed more than once has several such events; `ChangedAt DESC` takes the last one, which is
     * the close being undone.
     *
     * ── THE TWO CASES THAT MAKE THIS CORRECT RATHER THAN CONVENIENT ─────────────────────────────────
     *
     *   · **A stage-moving close** stamped `FromStageID` = the stage before the close and `ToStageID` = the
     *     closing stage. Restoring `FromStageID` moves the stage back, so the order-status writer fires
     *     through the existing mechanism and the order follows — or refuses, and says so.
     *   · **A status-only close** (no `ClosingStageID`) never moved the stage, so the event holds
     *     `FromStageID === ToStageID`. Restoring it assigns the stage the deal is already in, the writer's
     *     own comparison finds no move, and NOTHING fires. There is nothing to restore and nothing
     *     happens — which is the behaviour that has to hold for this to be safe, and it holds without a
     *     special case.
     *
     * Returns null when there is no close event to read — a deal closed by SQL, an import that wrote no
     * provenance, or a log that was never written. The reopen then leaves the stage alone rather than
     * guessing, which is the same answer as "the caller sent no StageID" and needs no extra branch.
     */
    private async priorStageFromCloseEvent(
        dealID: string,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<string | null> {
        const view = provider as unknown as IRunViewProvider;

        const locking = await view.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: 'LocksDeal = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            user,
        );
        if (!locking.Success) {
            return null;
        }
        const ids = (locking.Results ?? [])
            .map((r) => String((r as { ID: string }).ID))
            .filter(Boolean);
        if (ids.length === 0) {
            return null;   // nothing in this host's vocabulary locks a deal, so nothing closed it
        }

        const quoted = ids.map((id) => `'${id}'`).join(', ');
        const events = await view.RunView(
            {
                EntityName: STAGE_EVENT_ENTITY,
                ExtraFilter: `DealID = '${dealID}' AND ToDealStatusTypeID IN (${quoted})`,
                OrderBy: 'ChangedAt DESC',
                ResultType: 'simple',
                Fields: ['FromStageID', 'ChangedAt'],
            },
            user,
        );
        if (!events.Success) {
            return null;
        }
        const row = (events.Results ?? [])[0] as { FromStageID?: string | null } | undefined;
        const from = row?.FromStageID;
        return from ? String(from) : null;
    }

    /** The default landing status — chosen by the `IsOpen` FLAG, never by a status name. */
    private async firstOpenStatus(
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<{ ID: string; LocksDeal: boolean } | null> {
        const view = provider as unknown as IRunViewProvider;
        const r = await view.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: 'IsOpen = 1 AND IsActive = 1',
                OrderBy: 'DisplayRank ASC',
                ResultType: 'simple',
                Fields: ['ID', 'LocksDeal'],
            },
            user,
        );
        const row = (r.Results ?? [])[0] as { ID: string; LocksDeal?: boolean } | undefined;
        return r.Success && row ? { ID: String(row.ID), LocksDeal: row.LocksDeal === true } : null;
    }
}
