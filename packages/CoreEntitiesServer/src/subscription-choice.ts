/**
 * Close Won and the lines for a product the customer already holds (golive #318).
 *
 * Closing a deal as Won confirms its order, and at confirm orders turns a subscription line whose
 * subscriber already holds the product into the NEXT TERM of that subscription: its stated dates are
 * replaced by "the day after current coverage ends". A line can say otherwise through
 * `OrderLine.SubscriptionAction` (extend, or a new subscription on the line's own dates). A line that
 * says nothing gets the type's rule, which is how a second team's purchase for the same year started a
 * year late with no warning.
 *
 * ── WHY THE CHECK IS HERE AND NOT IN ORDERS' CONFIRM ──────────────────────────────────────────────
 *
 * The close confirms the order inside the deal's save, through the stage's order-status rule, and that
 * rule turns an order-side refusal into a WARNING so a stage change is never held hostage by orders
 * (D-OS1). A confirm that refused an unanswered line would therefore leave a deal closed Won on a Draft
 * order. Refusing the close itself, before anything is written, is the only place the question can
 * stop the outcome rather than annotate it.
 *
 * ── RENEWAL DEALS ─────────────────────────────────────────────────────────────────────────────────
 *
 * A deal whose type requires a renewal source is, by definition, the next term. Its unanswered lines
 * are answered `ExtendExisting` at close rather than refused: asking there adds a click and prevents
 * nothing.
 *
 * Which lines are asked is orders' rule (`FindUnansweredHeldLines`), so this, the order screen and the
 * deal line editor ask about the same lines.
 */
import type { IRunViewProvider, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import {
    FindUnansweredHeldLines,
    IsBooked,
    type UnansweredHeldLine,
    type mjBizAppsOrdersOrderLineEntity,
} from '@mj-biz-apps/orders-entities';
import type { SalesCloseIssue } from '@mj-biz-apps/sales-entities';
import type { DealEntityServer } from './DealEntityServer.js';

/** An order line that has not answered extend-or-new, and the subscription it would extend. */
export interface UnansweredSubscriptionLine {
    Line: mjBizAppsOrdersOrderLineEntity;
    Held: UnansweredHeldLine;
}

/**
 * The deal order's lines that the close's confirm would decide without asking.
 *
 * Empty when the deal has no order, or its order is already booked: a booked order's lines were
 * decided by the confirm that booked it.
 */
export async function FindUnansweredSubscriptionLines(
    deal: DealEntityServer,
    provider: IRunViewProvider,
    user: UserInfo,
): Promise<UnansweredSubscriptionLine[]> {
    if (!deal.OrderID) return [];
    const order = deal.OrderID_Object ?? (await deal.OrderID_LoadObject());
    if (!order || IsBooked(order.Status)) return [];

    // The same collection the confirm reads, so an answer written below is the one it applies.
    await order.Lines.Load();
    const lines = order.Lines.Items;
    const held = await FindUnansweredHeldLines(order, lines, provider, user);
    return held.flatMap((h) => {
        const line = lines.find((l) => UUIDsEqual(l.ID, h.LineID));
        return line ? [{ Line: line, Held: h }] : [];
    });
}

/** The refusal for one unanswered line, attributed to the line's choice. */
export function SubscriptionChoiceIssue(entry: UnansweredSubscriptionLine): SalesCloseIssue {
    const { Line, Held } = entry;
    const product = Line.Product?.trim() || 'this product';
    const coveredThrough = Held.Holding.LatestTermEnd
        ? `, covered through ${Held.Holding.LatestTermEnd.toISOString().slice(0, 10)}`
        : '';
    return {
        Section: 'lines',
        Field: 'SubscriptionAction',
        Severity: 'error',
        Message:
            `Line ${Line.LineNumber} (${product}): the customer already holds this product ` +
            `(${Held.Holding.SubscriptionNumber}${coveredThrough}). Open the line and choose whether it is ` +
            'the next term of that subscription or a new subscription on its own dates, then close the deal.',
    };
}

/**
 * Answers each line `ExtendExisting` and saves it. For a renewal deal, inside the close's transaction
 * and before the deal's save confirms the order.
 */
export async function AnswerAsNextTerm(entries: readonly UnansweredSubscriptionLine[]): Promise<void> {
    for (const { Line } of entries) {
        Line.SubscriptionAction = 'ExtendExisting';
        if (!(await Line.Save())) {
            throw new Error(
                `order line ${Line.LineNumber} could not be set to extend the existing subscription: ` +
                    (Line.LatestResult?.CompleteMessage ?? 'unknown error'),
            );
        }
    }
}
