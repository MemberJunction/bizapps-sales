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
 * ── THE THREE CONDITIONS ────────────────────────────────────────────────────────────────────────
 *
 * 1. **CompanyID.** Products are per-company. Without this clause a rep on one tenant's pipeline can
 *    select another tenant's product — the most consequential of the three, because it is a data leak
 *    rather than a mistake. The company comes from the DEAL'S PIPELINE, which is the same source the
 *    server stamps `Deal.CompanyID` from, so the picker and the server cannot disagree.
 * 2. **Status = 'Active'.** `Draft` is not sellable yet; `Discontinued` and `EOL` are not sellable any
 *    more. Compared as a literal because it is orders' own CHECK-constrained vocabulary, not this app's
 *    — the Sales vocabulary rule governs Sales' type tables, and this column belongs to another app.
 * 3. **The availability window.** `AvailableFrom` / `AvailableTo` are nullable and open-ended on either
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
}

/**
 * The filter that decides what a rep may select, as of `asOf`.
 *
 * Built as a string because `RunView` takes SQL, and assembled here so the three conditions live beside
 * the comment explaining each. The date is passed in rather than read from the clock inside so the
 * behaviour is testable at a chosen instant.
 *
 * @param companyID - The selling company, from the deal's pipeline.
 * @param asOf - The date the availability window is judged against. UTC, because everything stored is.
 */
export function ProductFilterFor(companyID: string, asOf: Date): string {
    const day = `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, '0')}-${String(asOf.getUTCDate()).padStart(2, '0')}`;
    // Single-quote escaping: a company ID is a GUID from our own metadata rather than user input, but
    // the filter is still concatenated SQL and the habit is what keeps it safe when a caller changes.
    const company = companyID.replace(/'/g, "''");
    return (
        `CompanyID = '${company}' AND Status = 'Active' ` +
        `AND (AvailableFrom IS NULL OR AvailableFrom <= '${day}') ` +
        `AND (AvailableTo IS NULL OR AvailableTo >= '${day}')`
    );
}
