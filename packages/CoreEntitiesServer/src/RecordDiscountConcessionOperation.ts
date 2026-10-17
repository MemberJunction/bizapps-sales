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
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { BaseRemotableOperation, IMetadataProvider, LogError, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { mjBizAppsOrdersOrderConcessionEntity } from '@mj-biz-apps/orders-entities';
import {
    ORDER_CONCESSION_ENTITY,
    SalesRecordDiscountConcessionOperation as SalesRecordDiscountConcessionOperationBase,
    type DiscountReasonCategory,
    type SalesRecordDiscountConcessionInput,
    type SalesRecordDiscountConcessionOutput,
} from '@mj-biz-apps/sales-entities';

import { OrdersIsInstalled } from './orders-availability.js';

/** Shown only when orders refuses and its result carries no text at all. */
export const CONCESSION_REFUSED_WITHOUT_REASON = 'Orders refused the concession and gave no reason.';

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
        const reason = input.Reason?.trim() ?? '';
        if (!reason) return refused('A discount needs a reason before it can be recorded.');
        if (!input.ReasonCategory) return refused('A discount needs a reason category before it can be recorded.');
        if (!OrdersIsInstalled()) return refused('Orders is not installed on this host, so the discount cannot be recorded.');

        try {
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
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            LogError(`Sales.RecordDiscountConcession failed for order line ${input.OrderLineID}: ${message}`);
            return refused(message);
        }
    }
}
