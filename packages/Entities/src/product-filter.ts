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
}

/**
 * The filter that decides what a rep may select, as of `asOf`.
 *
 * Built as a string because `RunView` takes SQL, and assembled here so the three conditions live beside
 * the comment explaining each. The date is passed in rather than read from the clock inside so the
 * behaviour is testable at a chosen instant.
 *
 * @param asOf - The date the availability window is judged against. UTC, because everything stored is.
 */
export function ProductFilterFor(asOf: Date): string {
    const day = `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, '0')}-${String(asOf.getUTCDate()).padStart(2, '0')}`;
    return (
        `Status = 'Active' ` +
        `AND (AvailableFrom IS NULL OR AvailableFrom <= '${day}') ` +
        `AND (AvailableTo IS NULL OR AvailableTo >= '${day}')`
    );
}
