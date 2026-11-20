/**
 * @fileoverview Which companies a deal must list (golive #484).
 *
 * A deal can involve several companies (`DealCompany`). Two of them are not the rep's to remove:
 *
 * - the deal's own company (`Deal.CompanyID`), the billing company. It issues the order, the invoice
 *   and the contract, so it is always one of the deal's companies;
 * - the company of every product on the deal's order. Orders stamps `OrderLine.CompanyID` from the
 *   product, so a deal selling that product involves that company whether or not the rep listed it.
 *
 * `DealEntityServer` adds whichever of these is missing on save, and the deal form shows them as
 * locked. Pure functions, so both tiers apply the same rule and it is testable without a database.
 */

/** Lower-cased, trimmed id, or null for an empty value. */
function normalized(id: string | null | undefined): string | null {
    const value = String(id ?? '').trim().toLowerCase();
    return value.length > 0 ? value : null;
}

/** The ids a deal must list: its billing company first, then each line company once, in order. */
export function RequiredDealCompanyIDs(
    billingCompanyID: string | null | undefined,
    lineCompanyIDs: readonly (string | null | undefined)[],
): string[] {
    const seen = new Set<string>();
    const required: string[] = [];
    for (const id of [billingCompanyID, ...lineCompanyIDs]) {
        const key = normalized(id);
        if (key && !seen.has(key)) {
            seen.add(key);
            required.push(String(id).trim());
        }
    }
    return required;
}

/** The required ids that `listedCompanyIDs` does not hold, compared without case. */
export function MissingDealCompanyIDs(
    required: readonly string[],
    listedCompanyIDs: readonly (string | null | undefined)[],
): string[] {
    const listed = new Set(listedCompanyIDs.map(normalized).filter((id): id is string => id !== null));
    return required.filter((id) => !listed.has(normalized(id) ?? ''));
}

/**
 * The billing company a deal with no company should take: the first company the rep listed (g484.1).
 * Null when the deal already has one, or when nothing is listed.
 */
export function DefaultBillingCompanyID(
    currentBillingCompanyID: string | null | undefined,
    listedCompanyIDs: readonly (string | null | undefined)[],
): string | null {
    if (normalized(currentBillingCompanyID)) {
        return null;
    }
    const first = listedCompanyIDs.find((id) => normalized(id) !== null);
    return first ? String(first).trim() : null;
}
