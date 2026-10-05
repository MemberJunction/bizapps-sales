/**
 * @fileoverview Recording a deal line's discount as the concession orders gates confirm on (golive#305).
 *
 * ── WHY A DISCOUNT NEEDS A CONCESSION ───────────────────────────────────────────────────────────
 *
 * The deal's Discount % writes `OrderLine.DiscountPct`. Orders' confirm gate counts that discount as
 * a Price concession and holds the order until an Approved one covers it, the same as a price below
 * the engine's. Without this, a rep with no Sales Authority discounted on a deal and the order
 * confirmed with nobody having approved it.
 *
 * ── WHAT SALES DOES AND DOES NOT DO HERE ────────────────────────────────────────────────────────
 *
 * Sales states the concession — the line, why, and the reason category — and orders values it and
 * decides it (rule 1: sales never computes money). Inside the rep's Sales Authority it is Approved on
 * save; outside it, Pending for the role orders' ConcessionLimit rule names. Nothing here multiplies
 * a price by a percentage: whether a discount went UP is a comparison of two stored fractions, which
 * is the only question sales asks.
 *
 * A discount that went DOWN, or stayed, records nothing: an approval already given covers more than
 * the line now gives away.
 *
 * @module @mj-biz-apps/sales-entities
 */
import { Metadata, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsOrdersOrderConcessionEntity } from '@mj-biz-apps/orders-entities';

export const ORDER_CONCESSION_ENTITY = 'MJ_BizApps_Orders: Order Concessions';

/** Orders' reason categories, as its `CK_OrderConcession_ReasonCategory` and generated type allow. */
export type DiscountReasonCategory = mjBizAppsOrdersOrderConcessionEntity['ReasonCategory'];

/** Tolerance for comparing two stored `DECIMAL(7,4)` fractions read back as floats. */
const FRACTION_TOLERANCE = 1e-9;

/**
 * Whether a line's discount went up, so the increase needs a concession behind it.
 *
 * @param saved   the `DiscountPct` the line carried when the editor opened; null or 0 for a new line.
 * @param current the `DiscountPct` it carries now.
 */
export function DiscountNeedsConcession(saved: number | null | undefined, current: number | null | undefined): boolean {
    return Number(current ?? 0) > Number(saved ?? 0) + FRACTION_TOLERANCE;
}

/**
 * The reason categories orders offers, read from the entity's field metadata rather than written out
 * here, so a category orders adds reaches the rep without a sales release.
 */
export function DiscountReasonCategories(): DiscountReasonCategory[] {
    const field = new Metadata().EntityByName(ORDER_CONCESSION_ENTITY)?.Fields.find((f) => f.Name === 'ReasonCategory');
    return (field?.EntityFieldValues ?? []).map((v) => v.Value as DiscountReasonCategory);
}

export interface DiscountConcessionRequest {
    OrderLineID: string;
    ReasonCategory: DiscountReasonCategory;
    Reason: string;
}

/**
 * What orders decided, or why it refused to record the concession at all.
 *
 * `AwaitingApproval` is read from whether orders stamped a decider, not from the status's name:
 * orders decides a concession inside the rep's authority on save and leaves one outside it undecided
 * for the approving role, and this app does not branch on vocabulary (rule 2).
 */
export type DiscountConcessionOutcome =
    | { Recorded: true; AwaitingApproval: boolean }
    | { Recorded: false; Message: string };

/**
 * Records a Price concession for the line's discount. The line must already be saved: a concession
 * names a persisted line, and orders values it from what that line stores.
 */
export async function RecordDiscountConcession(
    request: DiscountConcessionRequest,
    contextUser?: UserInfo,
): Promise<DiscountConcessionOutcome> {
    const reason = request.Reason.trim();
    if (!reason) return { Recorded: false, Message: 'A discount needs a reason before it can be recorded.' };

    const concession = await new Metadata().GetEntityObject<mjBizAppsOrdersOrderConcessionEntity>(ORDER_CONCESSION_ENTITY, contextUser);
    concession.NewRecord();
    concession.OrderLineID = request.OrderLineID;
    concession.DeliveryForm = 'Price';
    concession.ReasonCategory = request.ReasonCategory;
    concession.Reason = reason;
    if (!(await concession.Save())) {
        return {
            Recorded: false,
            Message: concession.LatestResult?.Message || 'Orders refused the concession and gave no reason.',
        };
    }
    return { Recorded: true, AwaitingApproval: !concession.DecidedByUserID };
}
