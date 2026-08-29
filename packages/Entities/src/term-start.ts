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
    /**
     * A STORED VALUE IS OFFERED REGARDLESS OF THE PRODUCT, and that ordering is the fix.
     *
     * This used to read `product ? IsSubscriptionProduct(product) : !!stored`, so the `stored` fallback
     * applied only when the product was UNKNOWN. When the product was known and was not a subscription
     * the answer was `false` no matter what was stored — the exact outcome this function's docstring
     * says it prevents: "the value stays in the database, still governs the term, and has no control on
     * screen to see or clear it".
     *
     * It is reachable in one click. A rep sets a term start on a subscription line, then re-picks that
     * row's product as a one-time item. Nothing on either side reconciles the column —
     * `OrderLineEntity` and `OrderLineEntityServer` never mention `ServicePeriodStart`, and orders'
     * subscription materialisation only visits lines carrying a `SubscriptionTypeID` — so the value is
     * written once and then never read, never cleared, and never seen.
     *
     * Worse than invisible: orders' confirm bails out of stamping an event line's own service period
     * with `if (line.ServicePeriodStart || line.ServicePeriodEnd) return;`, and revenue recognition
     * then throws for want of a service period. A stranded value turns into a failed confirm naming
     * nothing the rep did.
     *
     * `OnProductChange` now clears the column when the newly chosen product is known and is not a
     * subscription, which stops the stranding at its source. This is the second half: anything stranded
     * by another route stays visible and clearable rather than silently governing a term.
     */
    if (HasExplicitTermStart(stored)) {
        return true;
    }
    return product ? IsSubscriptionProduct(product) : false;
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
/**
 * Is this `DateLike` absent for our purposes?
 *
 * Absent means null, undefined, a blank or whitespace-only string, or a Date that does not parse. The
 * three predicates in this module disagreed about that before — `??` passed `''` through while `!!`
 * rejected it, so one function said "no term start" while another rendered the empty string — and a
 * shared test is what stops them drifting again.
 */
function IsEmptyDateLike(value: DateLike): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime());
    }
    return String(value).trim().length === 0;
}

export function EffectiveTermStart(stored: DateLike, orderDate: DateLike): DateLike {
    /**
     * ── `??` WAS THE WRONG OPERATOR, AND THE COMMENT ABOVE SAYS SO ────────────────────────────
     *
     * The reasoning above argues that a cleared field "must fall back to the order date rather than
     * render blank". `??` only falls back on null and undefined; `'' ?? orderDate` is `''`. So the
     * code implemented precisely the outcome the comment rejects, and `DateLike` explicitly admits
     * `string` — a cleared `<input type="date">` reports exactly `''`.
     *
     * What the rep saw: a blank date box captioned "order date", with no reset button, because
     * `HasExplicitTermStart('')` is false while `EffectiveTermStart('')` returned the empty string.
     *
     * An emptiness test rather than `||`, because `||` would also swallow a legitimate falsy that is
     * not empty — and being explicit here is cheaper than re-deriving which falsy values `DateLike`
     * can hold.
     */
    return IsEmptyDateLike(stored) ? (orderDate ?? null) : stored;
}

/**
 * Whether the line carries its own term start rather than showing the order date.
 *
 * The one thing a date control cannot show by itself, and the reason the workspace prints "order date"
 * under an inherited value: an inherited default and a deliberately-chosen date look identical on
 * screen and behave differently the moment the order date moves.
 */
export function HasExplicitTermStart(stored: DateLike): boolean {
    /**
     * An UNPARSEABLE value is not an explicit term start.
     *
     * `!!new Date('nonsense')` is true, and the formatter applies `getUTCFullYear()` with no NaN guard,
     * so the field rendered "NaN-NaN-NaN" — which `<input type="date">` rejects and shows blank. The
     * app then believed the line carried a deliberate term start: reset button shown, hint suppressed,
     * and no fallback to the order date.
     */
    return !IsEmptyDateLike(stored);
}
