/**
 * @fileoverview `Sales.SaveDeal` — the server half of browser-side deal entry.
 *
 * The client mutates a `DealDraft`, serializes it with `ToSaveInput()`, and calls this. This file
 * rehydrates that payload into a real `DealEntityServer` tree and saves it, which puts the write on the
 * SAME path an Action or an agent would take — so every rule enforced in the entity subclass applies
 * here too, for free.
 *
 * WHY REHYDRATION RATHER THAN A BULK WRITE. It would be faster to build the SQL directly. It would also
 * be a second implementation of "what it means to save a deal", and the second one is the one that
 * eventually disagrees with the first. Going through the entity objects means validation, the owner
 * stamp, and later the close lock all happen without this file knowing they exist.
 *
 * PRICES NOTHING. Every figure it accepts is either an INPUT to the pricing engine
 * (`RequestedDiscountPct`, `OverrideUnitPrice`) or a transcription of a signed document
 * (`AnnualGrossFees`, `DiscountAmount`, `Total`). The four `Resolved*` columns are not writable through
 * this operation at all — they come only from an `Orders.PreviewOrder` response, and accepting them
 * here would be the hole through which locally computed money enters the app.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    BaseRemotableOperation,
    DatabaseProviderBase,
    IMetadataProvider,
    IRunViewProvider,
    LogError,
    UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    SalesSaveDealOperation as SalesSaveDealOperationBase,
    type SalesDealIssue,
    type SalesDealLineInput,
    type SalesDealPaymentScheduleInput,
    type SalesSaveDealInput,
    type SalesSaveDealOutput,
    type mjBizAppsSalesDealLineEntity,
    type mjBizAppsSalesDealPaymentScheduleEntity,
    type mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

import { DealEntityServer } from './DealEntityServer.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';
const STAGE_EVENT_ENTITY = 'MJ_BizApps_Sales: Deal Stage Events';

/** Header fields copied straight through. Listed rather than spread so an unexpected key cannot ride in. */
const HEADER_FIELDS = [
    'Name',
    'PipelineID',
    'PipelineStageID',
    'DealTypeID',
    'DealStatusTypeID',
    'AccountID',
    'PrimaryContactID',
    'BillingContactID',
    'Amount',
    'CurrencyID',
    'TermMonths',
    'EstimatedProjectWeeks',
    'ExecutionDate',
    'StartDate',
    'ExpectedCloseDate',
    'Probability',
    'ForecastCategoryTypeID',
    'LeadSourceTypeID',
    'AutoRenew',
    'AnnualIncreasePctOverride',
    'CancellationNoticeDaysOverride',
    'PaymentMethod',
    'ContractVariances',
    'Description',
    'NextStep',
    'NextStepDate',
] as const;

/** Line fields copied straight through. Note the absence of every `Resolved*` column — see the header. */
const LINE_FIELDS = [
    'ProductID',
    'ProductName',
    'DealLineTypeID',
    'Quantity',
    'RequestedDiscountPct',
    'OverrideUnitPrice',
    'AnnualGrossFees',
    'DiscountAmount',
    'Total',
    'TermMonths',
    'ServicePeriodStart',
    'ServicePeriodEnd',
    'Description',
] as const;

const SCHEDULE_FIELDS = ['PaymentDate', 'Amount', 'Description'] as const;

function issue(Section: SalesDealIssue['Section'], Message: string, Field: string | null = null): SalesDealIssue {
    return { Section, Field, ClientKey: null, Severity: 'error', Message };
}

/**
 * Assigns a subset of fields from a plain payload onto an entity.
 *
 * `undefined` is SKIPPED and `null` is APPLIED, and the difference matters: omitting a key means "leave
 * this alone" while sending null means "clear it". Collapsing the two would make a partial update wipe
 * every field the caller did not mention.
 */
function assignFields<T extends object>(target: BaseEntity, source: T, fields: readonly string[]): void {
    const bag = source as unknown as Record<string, unknown>;
    const entity = target as unknown as Record<string, unknown>;
    for (const field of fields) {
        if (bag[field] !== undefined) {
            entity[field] = bag[field];
        }
    }
}

@RegisterClass(BaseRemotableOperation, 'Sales.SaveDeal')
export class SaveDealOperation extends SalesSaveDealOperationBase {
    protected async InternalExecute(
        input: SalesSaveDealInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesSaveDealOutput> {
        const empty: SalesSaveDealOutput = {
            Success: false,
            Created: false,
            Issues: [],
            Lines: [],
            PaymentSchedule: [],
        };

        if (!input?.Name?.trim()) {
            return { ...empty, Issues: [issue('party', 'A deal needs a name.', 'Name')] };
        }
        if (!input.PipelineID) {
            return { ...empty, Issues: [issue('party', 'A deal needs a pipeline.', 'PipelineID')] };
        }

        const db = provider as unknown as DatabaseProviderBase;
        let transactionOpen = false;

        try {
            const deal = await provider.GetEntityObject<DealEntityServer>(DEAL_ENTITY, user);
            const created = !input.ID;

            if (created) {
                deal.NewRecord();
            } else if (!(await deal.Load(input.ID as string))) {
                return { ...empty, Issues: [issue('party', `Deal ${input.ID} was not found.`, 'ID')] };
            }

            // The PERSISTED stage, captured before the payload overwrites it. This is the only moment it
            // is still readable, and it is what makes the transition detectable at all.
            const priorStageID = created ? null : (deal.PipelineStageID ?? null);
            const priorStatusID = created ? null : (deal.DealStatusTypeID ?? null);
            const priorAmount = created ? null : (deal.Amount ?? null);
            const priorProbability = created ? null : (deal.Probability ?? null);

            assignFields(deal, input, HEADER_FIELDS);

            // CompanyID must equal the pipeline's company — a CHECK cannot reach across the FK to
            // compare them, so it is resolved here rather than trusted from the client. An explicitly
            // supplied value is ignored in favour of the pipeline's, because the pipeline is the only
            // source that can be right.
            const companyID = await this.resolvePipelineCompany(input.PipelineID, provider, user);
            if (!companyID) {
                return {
                    ...empty,
                    Issues: [issue('party', 'That pipeline could not be read, so the selling company is unknown.', 'PipelineID')],
                };
            }
            deal.CompanyID = companyID;

            // Children are attached BEFORE Save(), because Save() is the transaction: the header and
            // every child land together or not at all.
            if (input.Lines !== undefined) {
                await this.applyLines(deal, input.Lines, provider, user);
            }
            if (input.PaymentSchedule !== undefined) {
                await this.applySchedule(deal, input.PaymentSchedule, provider, user);
            }

            // A stage transition has to land with its provenance row or not at all — a moved deal with no
            // event is a hole in an append-only log, and an event for a move that failed is worse. So the
            // save and the append share ONE explicit transaction. Nesting is fine: `DealEntityServer.Save`
            // opens its own inside this one as a savepoint, which the integration suite already relies on.
            const stageChanged = !created && (deal.PipelineStageID ?? null) !== priorStageID;

            await db.BeginTransaction();
            transactionOpen = true;

            if (!(await deal.Save())) {
                const message = deal.LatestResult?.CompleteMessage ?? 'unknown error';
                await db.RollbackTransaction();
                transactionOpen = false;
                return {
                    ...empty,
                    Issues: [issue('party', `The deal could not be saved: ${message}`)],
                };
            }

            if (stageChanged) {
                await this.appendStageEvent(
                    deal,
                    { StageID: priorStageID, StatusID: priorStatusID, Amount: priorAmount, Probability: priorProbability },
                    provider,
                    user,
                );
            }

            await db.CommitTransaction();
            transactionOpen = false;

            // The owner is expressed as INTENT and materialized as a DealTeamMember row, from which the
            // denormalized Deal.OwnerEmployeeID stamp is derived. It runs after the save because the
            // team row needs a persisted DealID.
            if (input.OwnerEmployeeID) {
                await deal.SetOwner(input.OwnerEmployeeID, user);
                if (!(await deal.Save())) {
                    return {
                        ...empty,
                        DealID: deal.ID,
                        Created: created,
                        Issues: [issue('party', 'The deal saved, but the owner stamp could not be written.', 'OwnerEmployeeID')],
                    };
                }
            }

            return {
                Success: true,
                DealID: deal.ID,
                DealNumber: deal.DealNumber ?? null,
                Created: created,
                Issues: [],
                Lines: deal.Lines.map((line, i) => ({
                    ClientKey: input.Lines?.[i]?.ClientKey ?? null,
                    ID: line.ID,
                    DisplayOrder: line.DisplayOrder,
                })),
                PaymentSchedule: deal.PaymentSchedule.map((row, i) => ({
                    ClientKey: input.PaymentSchedule?.[i]?.ClientKey ?? null,
                    ID: row.ID,
                    DisplayOrder: row.DisplayOrder,
                })),
            };
        } catch (err) {
            if (transactionOpen) {
                try {
                    await db.RollbackTransaction();
                } catch (rollbackErr) {
                    LogError(`Sales.SaveDeal: rollback failed: ${rollbackErr}`);
                }
            }
            LogError(`Sales.SaveDeal failed: ${err}`);
            return { ...empty, Issues: [issue('party', `The deal could not be saved: ${err}`)] };
        }
    }

    /**
     * Append the `DealStageEvent` for a stage transition.
     *
     * APPEND-ONLY, and it stamps `AmountAtTransition` / `ProbabilityAtTransition` from the values the deal
     * carried as it left the old stage. Without those stamps, "what did we think this was worth when it
     * moved" is unanswerable the moment an amount changes — which is the whole reason the table exists.
     *
     * The stamps come from the PRIOR values, not the new ones. A board drag applies the target stage's
     * probability default, so reading `deal.Probability` here would record the number the deal acquired by
     * arriving rather than the one it held on the way out, and every velocity report built on it would be
     * quietly wrong.
     *
     * Note what is NOT here: no close, no routing, no downstream call. A stage change is a stage change.
     * Closing is `Sales.CloseDeal` and stays an explicit act.
     */
    private async appendStageEvent(
        deal: DealEntityServer,
        prior: { StageID: string | null; StatusID: string | null; Amount: number | null; Probability: number | null },
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<void> {
        const event = await provider.GetEntityObject<mjBizAppsSalesDealStageEventEntity>(STAGE_EVENT_ENTITY, user);
        event.NewRecord();
        event.DealID = deal.ID;
        event.FromStageID = prior.StageID;
        event.ToStageID = deal.PipelineStageID;
        event.FromDealStatusTypeID = prior.StatusID;
        event.ToDealStatusTypeID = deal.DealStatusTypeID;
        event.ChangedByUserID = user.ID;
        event.ChangedAt = new Date();
        event.AmountAtTransition = prior.Amount;
        event.ProbabilityAtTransition = prior.Probability;

        if (!(await event.Save())) {
            // Thrown, not returned: the caller's transaction must roll the deal move back with it.
            throw new Error(
                `the stage event could not be written: ${event.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
        }
    }

    /** The pipeline owns the selling company. NOT NULL on Pipeline, so a successful read always has one. */
    private async resolvePipelineCompany(
        pipelineID: string,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<string | null> {
        const view = provider as unknown as IRunViewProvider;
        const result = await view.RunView(
            {
                EntityName: PIPELINE_ENTITY,
                ExtraFilter: `ID = '${pipelineID}'`,
                ResultType: 'simple',
                Fields: ['CompanyID'],
            },
            user,
        );
        if (!result.Success) {
            LogError(`Sales.SaveDeal: pipeline lookup failed: ${result.ErrorMessage}`);
            return null;
        }
        const row = (result.Results ?? [])[0] as { CompanyID?: string } | undefined;
        return row?.CompanyID ?? null;
    }

    /**
     * Reconciles the submitted lines against what is stored.
     *
     * The array is the COMPLETE DESIRED SET: a stored line whose ID is absent from it is removed. That
     * is what lets a workspace holding the whole tree just send its current state, with no delta
     * bookkeeping in the browser — and `RemoveLine` queues the deletion so it happens inside the same
     * transaction as the inserts.
     */
    private async applyLines(
        deal: DealEntityServer,
        lines: SalesDealLineInput[],
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<void> {
        await deal.LoadLines(user);

        const keep = new Set(lines.map((l) => l.ID).filter((id): id is string => !!id));
        for (let i = deal.Lines.length - 1; i >= 0; i--) {
            if (!keep.has(deal.Lines[i].ID)) {
                deal.RemoveLine(i);
            }
        }

        const byID = new Map<string, mjBizAppsSalesDealLineEntity>(deal.Lines.map((l) => [l.ID, l]));
        const ordered: mjBizAppsSalesDealLineEntity[] = [];

        for (const incoming of lines) {
            let entity = incoming.ID ? byID.get(incoming.ID) : undefined;
            if (!entity) {
                entity = await deal.CreateLine(user);
            }
            assignFields(entity, incoming, LINE_FIELDS);
            ordered.push(entity);
        }

        // Rebuild the collection in the caller's order — the array's order is what DisplayOrder is
        // derived from on save, so submitted order is the authority on how lines read.
        this.reorder(deal.Lines, ordered);
    }

    /** Identical semantics to {@link applyLines}. */
    private async applySchedule(
        deal: DealEntityServer,
        rows: SalesDealPaymentScheduleInput[],
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<void> {
        await deal.LoadPaymentSchedule(user);

        const keep = new Set(rows.map((r) => r.ID).filter((id): id is string => !!id));
        for (let i = deal.PaymentSchedule.length - 1; i >= 0; i--) {
            if (!keep.has(deal.PaymentSchedule[i].ID)) {
                deal.RemoveScheduleRow(i);
            }
        }

        const byID = new Map<string, mjBizAppsSalesDealPaymentScheduleEntity>(
            deal.PaymentSchedule.map((r) => [r.ID, r]),
        );
        const ordered: mjBizAppsSalesDealPaymentScheduleEntity[] = [];

        for (const incoming of rows) {
            let entity = incoming.ID ? byID.get(incoming.ID) : undefined;
            if (!entity) {
                entity = await deal.CreateScheduleRow(user);
            }
            assignFields(entity, incoming, SCHEDULE_FIELDS);
            ordered.push(entity);
        }

        this.reorder(deal.PaymentSchedule, ordered);
    }

    /**
     * Rewrites a collection in place to match `ordered`. In place because the getters expose the live
     * arrays the entity's `Save()` walks; replacing them would leave `Save()` writing the old order.
     */
    private reorder<T>(live: T[], ordered: T[]): void {
        live.length = 0;
        live.push(...ordered);
    }
}
