/**
 * @fileoverview When a deal's Billing Contact takes its Primary Contact's value.
 *
 * The primary contact is usually the person the invoice goes to, so a rep who picks one should not
 * have to search for the same person again in Billing Contact (issue #312). Picking a primary contact
 * fills an EMPTY billing contact with the same person; the rep can still change or clear it.
 *
 * ── WHAT THIS NEVER DOES ────────────────────────────────────────────────────────────────────────
 *
 * - Overwrite a billing contact that is already filled in. A different billing contact is a choice
 *   somebody made, and replacing it because the primary changed would silently move the invoice.
 * - Follow the primary contact after the copy. Once filled, the billing contact is its own value;
 *   changing the primary later leaves it alone (the rule above).
 * - Treat an empty billing contact as missing. Empty still means "bill the primary contact", which is
 *   what the column says and what order provisioning falls back to. A rep who clears the copy gets that.
 *
 * A pure function so both tiers and every caller share one answer, and so it is testable without
 * standing up an entity.
 */

/** True when the value names no record. */
function isEmpty(id: string | null | undefined): boolean {
    return id == null || id === '';
}

/**
 * The contact to write into Billing Contact after Primary Contact was set, or null to leave it alone.
 *
 * @param priorPrimary  Primary Contact before the write.
 * @param nextPrimary   Primary Contact after the write.
 * @param billing       Billing Contact as it stands.
 */
export function BillingContactFromPrimary(
    priorPrimary: string | null | undefined,
    nextPrimary: string | null | undefined,
    billing: string | null | undefined,
): string | null {
    if (isEmpty(nextPrimary) || !isEmpty(billing)) {
        return null;
    }
    // Only a CHANGE of primary copies. Writing the same value again (a field re-emitting its value)
    // must not refill a billing contact the rep deliberately cleared.
    if (!isEmpty(priorPrimary) && priorPrimary!.toLowerCase() === nextPrimary!.toLowerCase()) {
        return null;
    }
    return nextPrimary!;
}
