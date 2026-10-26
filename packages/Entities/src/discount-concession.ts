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
 * decides it on the server, through `Sales.RecordDiscountConcession` (rule 1: sales never computes
 * money). Inside the rep's Sales Authority it is Approved on save; outside it, Pending for the role
 * orders' ConcessionLimit rule names. Nothing here multiplies a price by a percentage: whether a
 * discount needs a concession is a comparison of two figures orders produced, the discount it priced
 * for the line and the largest value it stored on the line's Pending or Approved concession
 * (`LineDiscountNeedsConcession`, golive#340).
 *
 * A discount whose value is already covered records nothing: an approval already given, or one
 * waiting, covers at least what the line now gives away.
 *
 * @module @mj-biz-apps/sales-entities
 */
import { Metadata, RunView } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';
import type { mjBizAppsOrdersOrderConcessionEntity } from '@mj-biz-apps/orders-entities';
import { SalesRecordDiscountConcessionOperation } from './generated/remote_operations';

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
 * What the editor knows about a line when it decides whether the discount needs a reason.
 *
 * Every figure here is orders': `DiscountValue` is the discount `Orders.PriceOrder` priced for the line
 * as it now stands, and `CoveredValue` is the largest value orders stored on the line's Pending or
 * Approved concession. Sales compares the two and computes neither (rule 1).
 */
export interface LineDiscountFacts {
    /** The `DiscountPct` the line carried when the editor opened. */
    SavedPct: number | null | undefined;
    /** The `DiscountPct` it carries now. */
    CurrentPct: number | null | undefined;
    /** Orders' priced discount for the line as it now stands; null while it has not priced it. */
    DiscountValue: number | null;
    /** `LargestStandingConcessionValue` of the line's concessions; null when they could not be read. */
    CoveredValue: number | null;
    /**
     * Whether orders values a discount on this line at all. False for a line with no engine price and
     * for a renewal line: orders records no price concession on either and its confirm gate asks for
     * none. Null when not yet known.
     */
    OrdersValuesLine: boolean | null;
    /**
     * The line's price is also off its engine default. Orders' stored concession value then includes the
     * price cut as well as the discount, and sales cannot separate the two without arithmetic, so a raised
     * percent still asks as well.
     */
    PriceOverridden: boolean;
}

/**
 * Whether the line's discount needs a reason, so a concession can be recorded for it.
 *
 * Measured in dollars, against what orders already holds for the line: the discount needs a concession
 * when orders' value for it is more than the largest Pending or Approved concession on the line. That
 * covers what a percent comparison against the saved percent missed:
 *  - a line reopened after a save whose concession was refused: nothing covers it, so it asks again;
 *  - a quantity or price raised at the same percent: the dollars went up, so it asks.
 *
 * Falls back to the percent rule (`DiscountNeedsConcession`) when the line's concessions could not be
 * read, and asks whenever nothing covers the line while orders has not priced it yet.
 */
export function LineDiscountNeedsConcession(facts: LineDiscountFacts): boolean {
    if (facts.OrdersValuesLine === false) return false;
    if (!(Number(facts.CurrentPct ?? 0) > FRACTION_TOLERANCE)) return false;
    const raisedPercent = DiscountNeedsConcession(facts.SavedPct, facts.CurrentPct);
    if (facts.CoveredValue === null) return raisedPercent;
    if (facts.DiscountValue === null) return !(facts.CoveredValue > 0) || raisedPercent;
    // Both figures are orders' cent-rounded money, so they compare exactly; nothing is added or rounded here.
    const exceedsCovered = facts.DiscountValue > facts.CoveredValue;
    return facts.PriceOverridden ? exceedsCovered || raisedPercent : exceedsCovered;
}

/* ── What orders holds for a line ─────────────────────────────────────────────────────────────── */

/** One of orders' concession rows, as the editor and the line cards read it. */
export interface LineConcessionRow {
    ID: string;
    OrderLineID: string | null;
    Status: mjBizAppsOrdersOrderConcessionEntity['Status'];
    ComputedValue: number | null;
    DecidedByUserID: string | null;
    __mj_CreatedAt: Date | string;
}

/**
 * ORDERS' REJECTED STATE. `Status` is orders' fixed three-value column (its CHECK constraint and its
 * generated union type), not vocabulary sales owns in a type table, so rule 2's type-table flags do not
 * exist for it. Typed against orders' union, so a rename there fails this build instead of matching
 * nothing. Pending is read from the missing decider, as the server operation reads it.
 */
const CONCESSION_REJECTED: mjBizAppsOrdersOrderConcessionEntity['Status'] = 'Rejected';

/** Whether an approver turned the concession down. */
export function ConcessionWasRejected(row: Pick<LineConcessionRow, 'Status'>): boolean {
    return row.Status === CONCESSION_REJECTED;
}

/** Whether the concession still waits for a decision. */
export function ConcessionIsPending(row: Pick<LineConcessionRow, 'DecidedByUserID'>): boolean {
    return !row.DecidedByUserID;
}

/**
 * The largest value orders stored on the line's Pending or Approved concessions; 0 when there is none.
 * A Rejected one covers nothing. This is the dollar baseline a raised discount is measured against.
 */
export function LargestStandingConcessionValue(rows: readonly LineConcessionRow[]): number {
    let largest = 0;
    for (const row of rows) {
        if (ConcessionWasRejected(row)) continue;
        const value = Number(row.ComputedValue ?? 0);
        if (value > largest) largest = value;
    }
    return largest;
}

/** What the line card says about a discounted line's concession. */
export type LineConcessionState =
    /** No discount, or one orders does not value: nothing to say. */
    | 'NotNeeded'
    /** An Approved concession is the line's latest decision. */
    | 'Approved'
    | 'Pending'
    | 'Rejected'
    /** Discounted, orders values it, and no concession was ever recorded (or orders refused it). */
    | 'NotRecorded'
    /** Discounted with no concession, and whether orders values the line is not known. */
    | 'Unknown';

/**
 * The state of a line's concession, from the rows orders stored for it.
 *
 * A Pending one wins: it is the newest request (recording a new one withdraws a Pending earlier one).
 * Otherwise the latest decision decides, so a raise an approver rejected shows as Rejected even when an
 * earlier, smaller one was approved. A recording orders refused leaves no row, so it reads as Not
 * recorded.
 */
export function ResolveLineConcessionState(input: {
    DiscountPct: number | null | undefined;
    Rows: readonly LineConcessionRow[];
    OrdersValuesLine: boolean | null;
}): LineConcessionState {
    if (!(Number(input.DiscountPct ?? 0) > FRACTION_TOLERANCE)) return 'NotNeeded';
    if (input.Rows.some(ConcessionIsPending)) return 'Pending';
    const latest = [...input.Rows].sort((a, b) => createdAt(b) - createdAt(a))[0];
    if (latest) return ConcessionWasRejected(latest) ? 'Rejected' : 'Approved';
    if (input.OrdersValuesLine === false) return 'NotNeeded';
    return input.OrdersValuesLine === null ? 'Unknown' : 'NotRecorded';
}

function createdAt(row: LineConcessionRow): number {
    return new Date(row.__mj_CreatedAt).getTime();
}

/**
 * The line-price concessions orders holds on an order: Price or Scope, naming no term (an amount
 * change names the term it lowers, and is a different concession). The same set the server operation
 * withdraws from.
 */
export async function LoadLineConcessionRows(orderHeaderID: string): Promise<LineConcessionRow[]> {
    const result = await new RunView().RunView<LineConcessionRow>({
        EntityName: ORDER_CONCESSION_ENTITY,
        ExtraFilter:
            `OrderHeaderID = '${EscapeSQLString(orderHeaderID)}' ` +
            `AND DeliveryForm IN ('Price', 'Scope') AND SubscriptionTermID IS NULL`,
        Fields: ['ID', 'OrderLineID', 'Status', 'ComputedValue', 'DecidedByUserID', '__mj_CreatedAt'],
        ResultType: 'simple',
    });
    if (!result.Success) throw new Error(result.ErrorMessage || 'the concessions could not be read');
    return result.Results ?? [];
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
 * Shown only when neither the operation nor orders says why the concession was not recorded. The server
 * operation returns the same sentence when orders' result carries no text.
 */
export const CONCESSION_REFUSED_WITHOUT_REASON = 'Orders refused the concession and gave no reason.';

/**
 * Records a Price concession for the line's discount through `Sales.RecordDiscountConcession`. The line
 * must already be saved: a concession names a persisted line, and orders values it from what that line
 * stores.
 *
 * ── WHY THROUGH THE SERVER (golive#340) ─────────────────────────────────────────────────────────
 *
 * Orders' server subclass of the concession entity is what fills the order, the value and the
 * requester, and decides the concession. This used to create the entity in the browser, where that
 * subclass does not run: required-field validation failed before any request was sent, nothing was
 * recorded, and the empty `Message` surfaced as a refusal with no reason.
 */
export async function RecordDiscountConcession(request: DiscountConcessionRequest): Promise<DiscountConcessionOutcome> {
    const reason = request.Reason.trim();
    if (!reason) return { Recorded: false, Message: 'A discount needs a reason before it can be recorded.' };

    try {
        const envelope = await new SalesRecordDiscountConcessionOperation().Execute({
            OrderLineID: request.OrderLineID,
            ReasonCategory: request.ReasonCategory,
            Reason: reason,
        });
        const out = envelope.Output;
        if (!envelope.Success || !out) {
            return { Recorded: false, Message: envelope.ErrorMessage?.trim() || 'Sales.RecordDiscountConcession could not be reached.' };
        }
        if (!out.Success) return { Recorded: false, Message: out.Message?.trim() || CONCESSION_REFUSED_WITHOUT_REASON };
        return { Recorded: true, AwaitingApproval: out.AwaitingApproval };
    } catch (err) {
        return { Recorded: false, Message: err instanceof Error ? err.message : String(err) };
    }
}
