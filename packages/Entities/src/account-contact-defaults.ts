/**
 * @fileoverview Which of a deal's contacts take the account's default contacts.
 *
 * A Sales Account can name a default primary contact and a default billing contact (issue #254). When
 * a rep chooses the account on a deal, each EMPTY contact field on the deal takes the account's
 * default; the rep can still change or clear it.
 *
 * ── WHAT THIS NEVER DOES ────────────────────────────────────────────────────────────────────────
 *
 * - Overwrite a contact the deal already has. A contact on the deal is a choice somebody made, and the
 *   account changing is no reason to move the invoice or the relationship.
 * - Copy an empty default. An account with no default billing contact leaves the deal's billing contact
 *   to the primary-contact rule (`BillingContactFromPrimary`), which is what an empty billing contact
 *   already means.
 *
 * A pure function for the same reason that rule is one: every caller shares one answer, and it is
 * testable without standing up an entity.
 */

/** A pair of contact ids, as the deal and the account each hold them. */
export interface ContactPair {
    PrimaryContactID: string | null | undefined;
    BillingContactID: string | null | undefined;
}

/** The writes to make on the deal. A field that is absent is left alone. */
export interface ContactWrites {
    PrimaryContactID?: string;
    BillingContactID?: string;
}

/** True when the value names no record. */
function isEmpty(id: string | null | undefined): boolean {
    return id == null || id === '';
}

/** The account's default for one field, when the deal's own value is empty and the default is not. */
function fillFrom(dealValue: string | null | undefined, accountDefault: string | null | undefined): string | null {
    return isEmpty(dealValue) && !isEmpty(accountDefault) ? accountDefault! : null;
}

/**
 * The contacts to write onto a deal from its account's defaults.
 *
 * @param deal      The deal's contacts as they stand.
 * @param defaults  The account's default contacts.
 */
export function ContactsFromAccount(deal: ContactPair, defaults: ContactPair): ContactWrites {
    const writes: ContactWrites = {};
    const primary = fillFrom(deal.PrimaryContactID, defaults.PrimaryContactID);
    const billing = fillFrom(deal.BillingContactID, defaults.BillingContactID);
    if (primary) writes.PrimaryContactID = primary;
    if (billing) writes.BillingContactID = billing;
    return writes;
}
