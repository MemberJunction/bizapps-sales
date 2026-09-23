/**
 * @fileoverview The product rule — which of orders' products a deal line may reference.
 *
 * WHY THIS IS ITS OWN FILE, AND WHY IT LIVES IN THE ENTITIES PACKAGE RATHER THAN THE UI. The rule is
 * three conditions that must agree, and getting any of them wrong is either a cross-tenant leak or a rep
 * quoting something that cannot be sold. Keeping it in one place means the filter, the reason each clause
 * exists, and the type it produces are read together.
 *
 * It sits here, framework-free, because it is DOMAIN logic that happens to be rendered as a picker. The
 * integration suite checks it without pulling Angular into a Node harness, and the close-won handoff will
 * need the same rule server-side when it validates that a line references something sellable.
 *
 * ── IDENTITY IS `Product.ID`, AND NOTHING ELSE ──────────────────────────────────────────────────
 *
 * Not the SKU and not the name. `SKU` carries a FILTERED unique index — `WHERE SKU IS NOT NULL` — so it
 * is unique only when present, and orders legitimately ships products without one. `Name` is not unique
 * at all. So a name- or SKU-matching resolver can be a SUGGESTION a human confirms, never an identity
 * mechanism, and `DealLine.ProductID` stores the ID.
 *
 * ── THE CONDITIONS ────────────────────────────────────────────────────────────────────────
 *
 * There used to be a THIRD condition, and removing it was a business decision rather than a tidy-up.
 *
 * The filter began with `CompanyID = <the deal's company>`, on the reasoning that products are
 * per-company and a rep on one company's pipeline selecting another's product would be a data leak.
 * That reading was wrong for Blue Cypress: every deal is a Blue Cypress deal, and company ownership
 * lives at the PRODUCT rather than at the deal (Johanna Snider, Sales channel, 2026-08-26; issue #29).
 * With both pipelines owned by Blue Cypress the clause made every non-Blue-Cypress product unsellable,
 * so an Account Director could not put a Betty or Sidecar product on a deal at all.
 *
 * It is not a tenancy boundary being relaxed, because there was never one here to relax. `DECISIONS.md`
 * D5 already says a deal lives in ONE company's pipeline while its lines carry their OWN company, taken
 * from the product. The clause contradicted D5; the picker now agrees with it.
 *
 * 1. **Status = 'Active'.** `Draft` is not sellable yet; `Discontinued` and `EOL` are not sellable any
 *    more. Compared as a literal because it is orders' own CHECK-constrained vocabulary, not this app's
 *    — the Sales vocabulary rule governs Sales' type tables, and this column belongs to another app.
 * 2. **The availability window.** `AvailableFrom` / `AvailableTo` are nullable and open-ended on either
 *    side, so the test is "not yet started" and "already ended" rather than a range containment. Both
 *    NULL means always available, which is the common case.
 *
 * ── WHAT IT DELIBERATELY DOES NOT SHOW ──────────────────────────────────────────────────────────
 *
 * `StandaloneSellingPrice`. A catalog price displayed beside a transcribed figure invites the rep to
 * reconcile the two, and this app does not compute money — the price on a line is what was signed, and
 * the authoritative figure comes back from `Orders.PreviewOrder`. Showing both would make the difference
 * look like an error rather than a negotiation.
 *
 * @module @mj-biz-apps/sales-entities
 */
import { CompareDays, IsCalendarDay, ToCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';

/** Orders' Products entity. A SOFT reference — no FK crosses the schema boundary (D-SW3). */
export const E_ORDERS_PRODUCT = 'MJ_BizApps_Orders: Products';

/**
 * One selectable product.
 *
 * `SKU` is carried for DISPLAY only — it disambiguates two similarly-named products in the list. It is
 * never the thing stored; see the file header.
 */
export interface ProductLookup {
    ID: string;
    Name: string;
    SKU: string | null;
    /**
     * The company that OWNS this product, and so the company its revenue books to.
     *
     * Carried because the picker no longer filters on company, which means a line's company can no
     * longer be inferred from the deal — it has to come from the product the rep actually chose.
     * `OnProductChange` stamps it. Orders' `OrderLineEntityServer` overwrites it from the product at
     * save regardless; this makes the BROWSER agree with that rather than guess, which matters because
     * `deal.Validate()` runs client-side where that server subclass does not exist.
     */
    CompanyID: string;

    /**
     * The owning company's NAME, for display only — never for matching.
     *
     * The picker spans every company since #29, so `Name` alone no longer identifies a product to a
     * reader. Two companies can each sell an "Onboarding Fee", and `SKU` is nullable with only a
     * FILTERED unique index, so neither field disambiguates them. Without the company on the label a
     * rep chooses between two identical-looking rows, and the choice decides which company's books the
     * revenue lands in.
     *
     * It is a virtual field on orders' Products view, so it costs nothing but a column.
     */
    Company: string | null;

    /**
     * Non-null when this product is sold as a subscription — read only for WHETHER it is set, never for
     * its value. The rule that consumes it lives in `term-start.ts`, with the reasoning.
     */
    SubscriptionTypeID: string | null;
}

/**
 * The columns the picker reads, as ONE exported list rather than a literal at the call site.
 *
 * WHY IT IS SHARED. `SubscriptionTypeID` is not displayed anywhere — it only decides whether a line
 * offers a term start (#32). Drop it from the query and every product arrives without it, so no line is
 * a subscription, no term start appears, and NOTHING reports an error: the screen quietly loses a
 * feature. The integration check that guards against exactly that (`term-start.TS5`) has to read the
 * same list the picker reads, or it proves only that its own copy still works — which is the drift this
 * suite already warns about for hardcoded SKUs and re-typed filters.
 */
export const PRODUCT_LOOKUP_FIELDS = [
    'ID',
    'Name',
    'SKU',
    // #29: the line's company comes from the product, and the label names the owner so a rep can tell
    // two same-named products apart. Drop either and the picker stamps undefined or loses the company.
    'CompanyID',
    'Company',
    // #32: decides whether a line offers a term start at all. Drop it and the control silently vanishes
    // from every line — which is what `term-start.TS5` exists to catch.
    'SubscriptionTypeID',
    /**
     * `as const satisfies` rather than a type ANNOTATION, and the difference is the whole point.
     *
     * Annotating this `readonly (keyof ProductLookup)[]` widens `[number]` to `keyof ProductLookup`,
     * which makes the completeness check below `Exclude<K, K>` — always `never`, always true. Measured:
     * with the annotation, dropping 'CompanyID' still compiled. `satisfies` checks each member against
     * the interface without discarding the literal types.
     */
] as const satisfies readonly (keyof ProductLookup)[];

/**
 * EVERY member of `ProductLookup`, asserted at compile time.
 *
 * The list above is what the picker's query asks for, and omitting a field does not fail to compile —
 * `keyof ProductLookup` types the array without requiring completeness. That is not hypothetical: when
 * #32 was rebased onto #29 this constant produced NO merge conflict, because `next` had never carried
 * it, so git took #32's four-field version whole and silently dropped the two fields #29 had added.
 * Nothing would have failed until a rep noticed a line booking to the wrong company.
 *
 * This makes the next such omission a build error instead.
 */
type MissingFromLookupFields = Exclude<keyof ProductLookup, (typeof PRODUCT_LOOKUP_FIELDS)[number]>;
const _everyLookupFieldIsRequested: MissingFromLookupFields extends never ? true : never = true;
void _everyLookupFieldIsRequested;

/**
 * The filter that decides what a rep may select, as of a calendar day.
 *
 * Built as a string because `RunView` takes SQL, and assembled here so the conditions live beside the
 * comment explaining each. The DAY is passed in rather than read from the clock inside, so the
 * behaviour is testable and so the CALLER, not this function, decides which zone "today" is in:
 * `BusinessTimeZoneEngine.Instance.Today()` for the picker (bc-aidp-next-golive#168).
 *
 * IT USED TO TAKE AN INSTANT AND CHOOSE THE UTC DAY ITSELF, which is the defect. `AvailableFrom` and
 * `AvailableTo` are `DATE` columns — calendar days with no zone — and from 7 PM Central onwards the
 * UTC day is already tomorrow. So a product available from tomorrow was offered this evening, and one
 * whose last day was today had already gone, with nothing on the screen to say the set had changed.
 *
 * @param asOfDay - `YYYY-MM-DD`. VALIDATED BEFORE INTERPOLATION, because this string is concatenated
 *   into an `ExtraFilter` rather than parameterised: `RunView` takes SQL, so a day that arrived from
 *   anywhere but the engine would otherwise be an injection point. Anything else throws.
 */
export function ProductFilterFor(asOfDay: CalendarDay): string {
    if (!IsCalendarDay(asOfDay)) {
        throw new Error(`ProductFilterFor: expected a calendar day (YYYY-MM-DD), got ${JSON.stringify(asOfDay)}`);
    }
    return (
        `Status = 'Active' ` +
        `AND (AvailableFrom IS NULL OR AvailableFrom <= '${asOfDay}') ` +
        `AND (AvailableTo IS NULL OR AvailableTo >= '${asOfDay}')`
    );
}

/**
 * What {@link ProductWindowCovers} concluded. `Unreadable` is its own answer rather than a `false`,
 * because a `DATE` column holding something that is not a day is a broken seed or a driver change —
 * a caller must say so, not quietly treat the product as unavailable.
 */
export type ProductWindowVerdict = 'Covers' | 'Outside' | 'Unreadable';

/**
 * Whether an availability window covers a day — the TypeScript reading of the same rule the SQL above
 * expresses, for a caller holding the window's two columns rather than asking the database.
 *
 * ── WHY THIS IS EXPORTED RATHER THAN OPEN-CODED AT THE ONE CALL SITE ───────────────────────────
 *
 * `product-picker.PP2` derives, from the catalogue's OWN columns, which foreign products ought to be
 * offered, and compares that against what the picker returned. Deriving it is the point — asking the
 * picker and then asserting its own answer back at it is what made that check unable to fail once.
 *
 * It open-coded the comparison and the comparison did not work. `AvailableFrom` is a `DATE`, which
 * the driver hands back as a `Date` object; `String(aDate).slice(0, 10)` is `'Thu Aug 13'`, not a day.
 * So `'Thu Aug 13' <= '2026-08-15'` was false and `>= '2026-08-15'` was true for EVERY windowed row:
 * anything with a window was always excluded, `AvailableTo` never bound, and PP2 silently narrowed to
 * asserting NULL-window products only — exactly the vacuity its own comment says it was rewritten to
 * avoid. The bug was in the day derivation, and a day derivation belongs next to the rule it mirrors,
 * where a unit test can reach it without a database.
 *
 * ── WHY IT IS A SECOND IMPLEMENTATION AND NOT A SHARED ONE ────────────────────────────────────
 *
 * It does NOT call {@link ProductFilterFor}, and must not. That function emits SQL for the server to
 * evaluate; this evaluates the rule here. Two independent readings of one rule is what lets a check
 * disagree with the picker at all — routing both through one expression would make PP2 assert that
 * the filter equals itself.
 *
 * A bound is read with `ToCalendarDay`, so a `Date` is taken from its UTC PARTS and a string is taken
 * as written: the two shapes a `date` column arrives in. A bound that is PRESENT but unreadable is
 * reported as `Unreadable` rather than silently treated as an open end, because a `DATE` column that
 * does not hold a day is a broken seed or a changed driver, and neither should read as "always
 * available".
 *
 * @param from - `AvailableFrom` as read. NULL means the window has always been open.
 * @param to - `AvailableTo` as read. NULL means it never closes.
 * @param day - The calendar day to judge. Throws if it is not one, for the reason `ProductFilterFor` does.
 */
export function ProductWindowCovers(
    from: string | Date | null | undefined,
    to: string | Date | null | undefined,
    day: CalendarDay,
): ProductWindowVerdict {
    if (!IsCalendarDay(day)) {
        throw new Error(`ProductWindowCovers: expected a calendar day (YYYY-MM-DD), got ${JSON.stringify(day)}`);
    }
    const start = readWindowBound(from);
    const end = readWindowBound(to);
    if (start === undefined || end === undefined) {
        return 'Unreadable';
    }
    // `<=` and `>=` on both bounds, matching the SQL exactly: a window is INCLUSIVE at both ends, so a
    // product whose last day is today is still sellable today.
    const openedBy = start === null || CompareDays(start, day) <= 0;
    const stillOpen = end === null || CompareDays(end, day) >= 0;
    return openedBy && stillOpen ? 'Covers' : 'Outside';
}

/**
 * One end of an availability window, with the three outcomes kept apart.
 *
 * `null` means the column is NULL and that end is open. `undefined` means it held something that is
 * not a readable calendar day. Two absences with different meanings, which is why they are two values
 * rather than one — collapsing them is how an unreadable bound would come to mean "always available".
 */
function readWindowBound(value: string | Date | null | undefined): CalendarDay | null | undefined {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return ToCalendarDay(value) ?? undefined;
}
