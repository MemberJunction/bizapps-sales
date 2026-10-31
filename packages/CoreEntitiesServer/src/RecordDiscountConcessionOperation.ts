/**
 * @fileoverview `Sales.RecordDiscountConcession` — records a deal line's raised discount as the Price
 * concession orders' confirm gate holds on (golive#340).
 *
 * ── WHY THIS RUNS ON THE SERVER ─────────────────────────────────────────────────────────────────
 *
 * Orders' `OrderConcession` table requires the order, the concession's computed value and the user who
 * asked for it, and only orders' server subclass of the entity fills them: it values the concession,
 * stamps the requester and decides it against the requester's Sales Authority. That subclass is
 * registered on the server only. Created in the browser, the generated class ran instead, its
 * required-field validation failed before any request was sent, and the rep saw a refusal with no
 * reason. Creating the concession here lets orders' own rules run, so sales restates none of them.
 *
 * ── WHAT SALES STILL DOES NOT DO ────────────────────────────────────────────────────────────────
 *
 * It states the line, the reason category and the reason. It computes no value and makes no decision
 * (rule 1). Whether the concession awaits approval is read from whether orders stamped a decider, not
 * from the status's name (rule 2).
 *
 * ── A RAISED DISCOUNT REPLACES THE LINE'S EARLIER CONCESSION ────────────────────────────────────
 *
 * Orders values a line's Price concession at the line's whole discount, not at the increase, and its
 * share check sums every concession on the order that is not rejected. Left in place, the concession for
 * the line's earlier discount is counted twice: once on its own and once inside the new one. The new one
 * routes to a higher tier than it should, and the order cannot be confirmed even after it is approved.
 * So the earlier one is withdrawn first, as orders' own header says to ("withdraw a Pending one and
 * record again"). Orders' `Delete` decides which can go: a Pending one, or one approved on the
 * requester's own authority while the order is a draft. One an approver decided stays; the confirm gate
 * covers a line by its largest approved concession, so it does no harm. No status name is read here.
 *
 * The withdrawal and the new record share one transaction, which orders' approval-task writes join. A
 * refused new concession rolls the withdrawal back, so the line keeps the concession it had.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseRemotableOperation,
    DatabaseProviderBase,
    IMetadataProvider,
    IRunViewProvider,
    LogError,
    UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { mjBizAppsOrdersOrderConcessionEntity } from '@mj-biz-apps/orders-entities';
import {
    CONCESSION_REFUSED_WITHOUT_REASON,
    ORDER_CONCESSION_ENTITY,
    SalesRecordDiscountConcessionOperation as SalesRecordDiscountConcessionOperationBase,
    type DiscountReasonCategory,
    type SalesRecordDiscountConcessionInput,
    type SalesRecordDiscountConcessionOutput,
} from '@mj-biz-apps/sales-entities';

import { OrdersIsInstalled } from './orders-availability.js';

// The line ID goes into a RunView filter, and the rows that filter returns are deleted, so anything else
// is refused before the transaction opens.
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function refused(Message: string): SalesRecordDiscountConcessionOutput {
    return { Success: false, AwaitingApproval: false, ConcessionID: null, Message };
}

@RegisterClass(BaseRemotableOperation, 'Sales.RecordDiscountConcession')
export class RecordDiscountConcessionOperation extends SalesRecordDiscountConcessionOperationBase {
    protected async InternalExecute(
        input: SalesRecordDiscountConcessionInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesRecordDiscountConcessionOutput> {
        if (!input?.OrderLineID) return refused('A discount concession needs the saved line it is on.');
        if (!UUID.test(input.OrderLineID)) return refused('A discount concession needs the ID of a saved line.');
        const reason = input.Reason?.trim() ?? '';
        if (!reason) return refused('A discount needs a reason before it can be recorded.');
        if (!input.ReasonCategory) return refused('A discount needs a reason category before it can be recorded.');
        if (!OrdersIsInstalled()) return refused('Orders is not installed on this host, so the discount cannot be recorded.');

        const db = provider as unknown as DatabaseProviderBase;
        let transactionOpen = false;
        try {
            await db.BeginTransaction();
            transactionOpen = true;
            await this.withdrawSuperseded(input.OrderLineID, provider, user);
            const outcome = await this.record(input, reason, provider, user);
            if (outcome.Success) await db.CommitTransaction();
            else await db.RollbackTransaction();
            transactionOpen = false;
            return outcome;
        } catch (err) {
            if (transactionOpen) await this.rollbackQuietly(db);
            const message = err instanceof Error ? err.message : String(err);
            LogError(`Sales.RecordDiscountConcession failed for order line ${input.OrderLineID}: ${message}`);
            return refused(message);
        }
    }

    /**
     * Withdraws the line's earlier line-price concessions: every Price or Scope one on the line that names
     * no term (an amount change names the term it lowers, and is a different concession). Orders' `Delete`
     * refuses one an approver decided; that one is left in place, and the refusal is logged, not returned.
     */
    private async withdrawSuperseded(orderLineID: string, provider: IMetadataProvider, user: UserInfo): Promise<void> {
        const result = await (provider as unknown as IRunViewProvider).RunView<mjBizAppsOrdersOrderConcessionEntity>(
            {
                EntityName: ORDER_CONCESSION_ENTITY,
                ExtraFilter: `OrderLineID = '${orderLineID}' AND DeliveryForm IN ('Price', 'Scope') AND SubscriptionTermID IS NULL`,
                ResultType: 'entity_object',
            },
            user,
        );
        if (!result.Success) throw new Error(`The line's earlier concessions could not be read: ${result.ErrorMessage}`);
        for (const earlier of result.Results ?? []) {
            if (!(await earlier.Delete())) {
                LogError(
                    `Sales.RecordDiscountConcession kept concession ${earlier.ID} on order line ${orderLineID}: ` +
                        (earlier.LatestResult?.CompleteMessage?.trim() || 'orders gave no reason'),
                );
            }
        }
    }

    private async record(
        input: SalesRecordDiscountConcessionInput,
        reason: string,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesRecordDiscountConcessionOutput> {
        const concession = await provider.GetEntityObject<mjBizAppsOrdersOrderConcessionEntity>(ORDER_CONCESSION_ENTITY, user);
        concession.NewRecord();
        concession.OrderLineID = input.OrderLineID;
        concession.DeliveryForm = 'Price';
        // Orders' CHECK constraint and its subclass judge the category; sales passes it through.
        concession.ReasonCategory = input.ReasonCategory as DiscountReasonCategory;
        concession.Reason = reason;
        if (!(await concession.Save())) {
            // `CompleteMessage` joins `Message` with every entry of `Errors`; a validation failure
            // carries its reasons only in `Errors`, which is why reading `Message` alone showed nothing.
            return refused(concession.LatestResult?.CompleteMessage?.trim() || CONCESSION_REFUSED_WITHOUT_REASON);
        }
        return {
            Success: true,
            ConcessionID: concession.ID,
            AwaitingApproval: !concession.DecidedByUserID,
            Message: null,
        };
    }

    private async rollbackQuietly(db: DatabaseProviderBase): Promise<void> {
        try {
            await db.RollbackTransaction();
        } catch (rollbackErr) {
            LogError(`Sales.RecordDiscountConcession: rollback failed: ${rollbackErr}`);
        }
    }
}
