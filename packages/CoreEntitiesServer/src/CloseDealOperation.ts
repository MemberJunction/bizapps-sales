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
    type OrdersOrderHandoffInput,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
    type SalesCloseIssue,
    type SalesCloseRoutingResult,
    type SalesCloseWonPolicy,
    type SalesReopenDealInput,
    type SalesReopenDealOutput,
    type mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

import { DealEntityServer } from './DealEntityServer.js';
import { LiveOrdersSeam, OrdersIsInstalled } from './LiveOrdersSeam.js';
import { ContractsIsInstalled, LiveContractsSeam } from './LiveContractsSeam.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';
const DEAL_TYPE_ENTITY = 'MJ_BizApps_Sales: Deal Types';
const LOSS_REASON_ENTITY = 'MJ_BizApps_Sales: Loss Reasons';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';
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
    // DEAD, both of them, and kept only so the shipped default still satisfies the generated input
    // type. `OneTimeLinesTo` steered one-time lines to the Order route and `OrderState` set the status
    // of the order that route created; close-won creates no order now, so nothing reads either. They
    // stay in `sales-close-deal.input.ts` because that is a published remote-operation contract and
    // narrowing it is its own decision -- but a deployment setting them is configuring nothing.
    OneTimeLinesTo: 'None',
    OrderState: 'Draft',
};

function issue(Section: SalesCloseIssue['Section'], Message: string, Field: string | null = null): SalesCloseIssue {
    return { Section, Field, Severity: 'error', Message };
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
     * THE TWO DOWNSTREAMS ARE RESOLVED INDEPENDENTLY, which is the whole point.
     *
     * All four combinations are real deployments: neither sibling, orders only, contracts only, or
     * both. A single seam that assumed they arrive together would make the contract path depend on
     * orders being installed, which is not true of any of them. So orders' half comes from
     * `LiveOrdersSeam` when orders is registered, contracts' half from `LiveContractsSeam` when
     * contracts is, and either falls back to the stub on its own.
     */
    const contracts = ContractsIsInstalled()
        ? new LiveContractsSeam(user, provider)
        : new StubDownstreamSeam();

    return OrdersIsInstalled() ? new LiveOrdersSeam(user, provider, contracts) : new StubOrdersWithContracts(contracts);
}

/**
 * Stub orders, live (or stub) contracts.
 *
 * Needed because the contract path must work on a host that has contracts and NOT orders — a
 * subscription-only deployment. Without this, `resolveSeam` would hand back the all-stub seam the
 * moment orders was absent and silently disable a contract route that was perfectly available.
 */
class StubOrdersWithContracts extends StubDownstreamSeam {
    public constructor(
        private readonly contracts: Pick<IDownstreamSeam, 'CreateContractFromDeal' | 'RenewContractTerm'>,
    ) {
        super();
    }

    public override CreateContractFromDeal(
        input: ContractsCreateFromDealSeamInput,
    ): Promise<ContractsSeamResult> {
        return this.contracts.CreateContractFromDeal(input);
    }

    public override RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        return this.contracts.RenewContractTerm(input);
    }
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

            const stageEvent = await this.stampClose(deal, input, target, routing, provider, user);

            if (!(await deal.Save())) {
                throw new Error(
                    `the deal could not be saved: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }

            await db.CommitTransaction();
            transactionOpen = false;

            return {
                Success: true,
                Issues: [],
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
    private async stampClose(
        deal: DealEntityServer,
        input: SalesCloseDealInput,
        target: StatusFlags,
        routing: SalesCloseRoutingResult[],
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<string> {
        const event = await provider.GetEntityObject<mjBizAppsSalesDealStageEventEntity>(STAGE_EVENT_ENTITY, user);
        event.NewRecord();
        event.DealID = deal.ID;
        event.FromStageID = deal.PipelineStageID;
        event.ToStageID = input.ClosingStageID ?? deal.PipelineStageID;
        event.FromDealStatusTypeID = deal.DealStatusTypeID;
        event.ToDealStatusTypeID = target.ID;
        event.ChangedByUserID = user.ID;
        event.ChangedAt = new Date();
        event.AmountAtTransition = deal.Amount;
        event.ProbabilityAtTransition = deal.Probability;
        event.Notes = this.routingNote(routing, input.Notes);

        if (!(await event.Save())) {
            throw new Error(
                `the stage event could not be written: ${event.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
        }

        // Everything stored is UTC — getUTC*, never local-time getters, for anything persisted.
        const now = new Date();
        deal.DealStatusTypeID = target.ID;
        if (input.ClosingStageID) {
            deal.PipelineStageID = input.ClosingStageID;
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

        return event.ID;
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
            AutoRenew: deal.AutoRenew,
            AnnualIncreasePctOverride: deal.AnnualIncreasePctOverride,
            CancellationNoticeDaysOverride: deal.CancellationNoticeDaysOverride,
            ExecutionDate: deal.ExecutionDate ? String(deal.ExecutionDate) : null,
            StartDate: deal.StartDate ? String(deal.StartDate) : null,
            // The buying party, so contracts can stamp the customer without looking back at the deal.
            AccountID: deal.AccountID,
            PrimaryContactID: deal.PrimaryContactID,
            // NOT SET. `CloseWonPolicy` carries no billing frequency, and it is generated code — so
            // rather than invent one here, the seam applies its own default and contracts owns the
            // vocabulary. Add it to the policy first if a deployment needs to vary it.
            //
            // NO LINES, and that is the design rather than a gap. S-US2's contract is a header:
            // customer, selling company, primary contact, the type's stored defaults, the active
            // template, a minted number, the typed linked pair, and TemplateModified. Line items were
            // the redundancy this whole rework removes -- only OrderLine survives -- so contracts'
            // own ContractTermLineItem retirement is the other half of it, on their side.
            Lines: [],
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

            const event = await provider.GetEntityObject<mjBizAppsSalesDealStageEventEntity>(
                STAGE_EVENT_ENTITY,
                user,
            );
            event.NewRecord();
            event.DealID = deal.ID;
            event.FromStageID = deal.PipelineStageID;
            event.ToStageID = input.StageID ?? deal.PipelineStageID;
            event.FromDealStatusTypeID = deal.DealStatusTypeID;
            event.ToDealStatusTypeID = target.ID;
            event.ChangedByUserID = user.ID;
            event.ChangedAt = new Date();
            event.AmountAtTransition = deal.Amount;
            event.ProbabilityAtTransition = deal.Probability;
            event.Notes = `REOPENED: ${input.Reason.trim()}`;

            if (!(await event.Save())) {
                throw new Error(
                    `the reopen event could not be written: ${event.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }

            deal.DealStatusTypeID = target.ID;
            if (input.StageID) {
                deal.PipelineStageID = input.StageID;
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

            return { Success: true, Issues: [], Unlocked: true, DealStageEventID: event.ID };
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
