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
 * share check sums every Pending and Approved concession on the order. Left in place, the concession for
 * the line's earlier discount is counted twice: once on its own and once inside the new one. The new one
 * routes to a higher tier than it should, and the order cannot be confirmed even after it is approved.
 * So the earlier one is withdrawn first (golive #403): its status is set to Withdrawn, which orders keeps
 * as a record and counts toward nothing. Deleting it would lose that history, and a role that may record
 * concessions but not delete them could not do it. Orders lets the concession's requester withdraw it
 * without the right to update concessions, and decides which can be withdrawn: a Pending one, or an
 * Approved one while the order is not confirmed. A refusal refuses the whole recording, since leaving the
 * earlier one in place would count the line twice.
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
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
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

// The line ID goes into a RunView filter, and the rows that filter returns are withdrawn, so anything else
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
        const concessionID = input.ConcessionID?.trim() || null;
        if (concessionID && !UUID.test(concessionID)) {
            return refused('A discount concession needs a valid concession ID.');
        }
        if (!OrdersIsInstalled()) return refused('Orders is not installed on this host, so the discount cannot be recorded.');

        const db = provider as unknown as DatabaseProviderBase;
        let transactionOpen = false;
        try {
            await db.BeginTransaction();
            transactionOpen = true;
            const existing = await this.withdrawSuperseded(input.OrderLineID, concessionID, provider, user);
            if (existing) {
                await db.CommitTransaction();
                transactionOpen = false;
                return {
                    Success: true,
                    ConcessionID: existing.ID,
                    AwaitingApproval: !existing.DecidedByUserID,
                    Message: null,
                };
            }
            const outcome = await this.record(input, reason, concessionID, provider, user);
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
     * Withdraws the line's earlier line-price concessions still standing: every Pending or Approved Price or
     * Scope one on the line that names no term (an amount change names the term it lowers, and is a
     * different concession). A withdrawal orders refuses throws with orders' reason, which rolls back.
     *
     * When the caller supplies `concessionID` and a concession with that ID already sits on the line, a
     * prior attempt with the same client-generated ID already wrote it (#512): return it untouched so a
     * retry after a timeout does not withdraw and recreate the concession it already recorded.
     */
    private async withdrawSuperseded(
        orderLineID: string,
        concessionID: string | null,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<mjBizAppsOrdersOrderConcessionEntity | null> {
        const result = await (provider as unknown as IRunViewProvider).RunView<mjBizAppsOrdersOrderConcessionEntity>(
            {
                EntityName: ORDER_CONCESSION_ENTITY,
                ExtraFilter:
                    `OrderLineID = '${orderLineID}' AND DeliveryForm IN ('Price', 'Scope') AND SubscriptionTermID IS NULL ` +
                    `AND Status IN ('Pending', 'Approved')`,
                ResultType: 'entity_object',
            },
            user,
        );
        if (!result.Success) throw new Error(`The line's earlier concessions could not be read: ${result.ErrorMessage}`);
        const earlierRows = result.Results ?? [];
        if (concessionID) {
            const matching = earlierRows.find((earlier) => UUIDsEqual(earlier.ID, concessionID));
            if (matching) return matching;
        }
        for (const earlier of earlierRows) {
            earlier.Status = 'Withdrawn';
            if (!(await earlier.Save())) {
                const reason = earlier.LatestResult?.CompleteMessage?.trim() || 'orders gave no reason';
                throw new Error(`The line's earlier concession could not be withdrawn, so the raised discount was not recorded: ${reason}`);
            }
        }
        return null;
    }

    private async record(
        input: SalesRecordDiscountConcessionInput,
        reason: string,
        concessionID: string | null,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesRecordDiscountConcessionOutput> {
        const concession = await provider.GetEntityObject<mjBizAppsOrdersOrderConcessionEntity>(ORDER_CONCESSION_ENTITY, user);
        concession.NewRecord();
        if (concessionID) concession.ID = concessionID;
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
