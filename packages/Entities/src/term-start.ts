/**
 * @fileoverview The term-start rule for a deal's subscription lines (sales#32).
 *
 * WHY THIS IS A MODULE AND NOT THREE METHODS ON THE WORKSPACE COMPONENT. Two of the three decisions
 * here are the kind that look obviously right and are quietly wrong — which of them applies is decided
 * by whether a value is *stored* versus *shown*, and those are indistinguishable in a date control on
 * screen. Kept as pure functions they can be asserted directly by the integration checks, which is the
 * same shape the discount rules (`DiscountFractionToPercent`) and the picker filter (`ProductFilterFor`)
 * already have in this package: the rule lives here, the component delegates, the checks prove it.
 *
 * ── WHAT SALES IS ACTUALLY DOING HERE ───────────────────────────────────────────────────────────────
 *
 * Writing ONE column, `OrderLine.ServicePeriodStart`, and nothing else. The term END is orders' to
 * compute at confirm from the subscription's own cadence and proration, and sales does not know either.
 * This app states intent; orders states the term. Guessing an end date here would be sales computing a
 * commercial term, which is the boundary rule this repo does not cross.
 *
 * ── AND WHAT IT DEPENDS ON ──────────────────────────────────────────────────────────────────────────
 *
 * As of this writing orders OVERWRITES the column at confirm:
 * `OrderEntityServer.materializeSubscriptions` ends with "the line's stored service period reflects the
 * TERM, not what a user typed" and assigns `line.ServicePeriodStart = term.StartDate`, where the term
 * start comes from `SubscriptionBehavior.ComputeStartDate`. The companion orders issue changes that hook
 * to honour an explicitly-set value. Until it lands, everything in this module works and survives save
 * and reload, and the confirmed term still starts on the order date.
 *
 * @module @mj-biz-apps/sales-entities
 */
import type { ProductLookup } from './product-filter';

/** Either shape a date can arrive in — an entity field holds a `Date`, a `RunView` row can hold a string. */
export type DateLike = Date | string | null | undefined;

/**
 * Whether a product is sold as a subscription.
 *
 * ── THE PREDICATE IS ORDERS', NOT OURS ──
 *
 * `OrderEntityServer.materializeSubscriptions` selects the lines it will build subscriptions for with
 * `ID IN (...) AND SubscriptionTypeID IS NOT NULL` against this same column. Matching it exactly means
 * a line offering a term start is exactly a line that will receive a term at confirm. Any other test —
 * a product-type string, a name convention — could drift from that and offer a term start on a line
 * which never gets one, which reads as a broken promise rather than a field that does nothing.
 *
 * A function rather than a bare `!= null` at each call site because the emptiness test is the subtle
 * part: `RunView`'s `simple` result type returns an absent uniqueidentifier as `null`, but a row read
 * another way can carry `''`, and `'' != null` is true — which would mark every non-subscription
 * product as a subscription. Both shapes are rejected here, once.
 */
export function IsSubscriptionProduct(
    product: Pick<ProductLookup, 'SubscriptionTypeID'> | null | undefined,
): boolean {
    return !!product && String(product.SubscriptionTypeID ?? '').trim().length > 0;
}

/**
 * Whether a line shows a term start at all.
 *
 * Three cases, and the third is the one worth reading:
 *
 * · **No product chosen** — nothing to say. A line with no `ProductID` cannot be a subscription, and it
 *   already blocks the save on its own account (`UnlinkedLineIssues`).
 * · **Product in the catalogue** — orders' predicate decides, and that is #32's requirement 3 exactly.
 * · **Product NOT in the catalogue** — quoted before it was withdrawn; `ProductLabel` renders it as
 *   "(no longer offered)". The lookup cannot say whether it was a subscription, and answering `false`
 *   would HIDE a term start the rep had already set: the value stays in the database, still governs the
 *   term, and has no control on screen to see or clear it. So the stored value decides — shown if there
 *   is one, absent if there is not. Nothing is invented for a line that never had one.
 *
 * @param hasProduct - Whether the line references a product at all.
 * @param product - The catalogue row, or null when the product is no longer offered.
 * @param stored - What the line currently stores in `ServicePeriodStart`.
 */
export function ShouldOfferTermStart(
    hasProduct: boolean,
    product: Pick<ProductLookup, 'SubscriptionTypeID'> | null | undefined,
    stored: DateLike,
): boolean {
    if (!hasProduct) {
        return false;
    }
    return product ? IsSubscriptionProduct(product) : !!stored;
}

/**
 * The date the control DISPLAYS: the stored term start, or the order date as a default.
 *
 * ── THE DEFAULT IS DISPLAYED, NEVER WRITTEN ──
 *
 * This is the whole of #32's behaviour, and the two acceptance criteria that look like opposites are
 * one rule seen twice: with nothing stored the field follows the order date, and the moment a value is
 * stored it stops following. Writing the default onto the line at load would collapse both into "always
 * frozen", would make every line dirty just by opening the deal, and would leave "reset to order date"
 * with nothing to distinguish it from setting today's date by hand.
 *
 * `??` and not `||` on purpose: the operand is a `Date`, and a falsy-but-real value is not possible
 * here — but `||` would also swallow `''`, which is a legitimately-cleared field that must fall back to
 * the order date rather than render blank.
 */
export function EffectiveTermStart(stored: DateLike, orderDate: DateLike): DateLike {
    return stored ?? orderDate ?? null;
}

/**
 * Whether the line carries its own term start rather than showing the order date.
 *
 * The one thing a date control cannot show by itself, and the reason the workspace prints "order date"
 * under an inherited value: an inherited default and a deliberately-chosen date look identical on
 * screen and behave differently the moment the order date moves.
 */
export function HasExplicitTermStart(stored: DateLike): boolean {
    return !!stored;
}
