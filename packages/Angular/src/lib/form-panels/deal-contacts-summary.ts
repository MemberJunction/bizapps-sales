/**
 * @fileoverview The line above the deal's Customer contacts grid that names the primary and billing
 * contacts (golive#428).
 *
 * Those two are fields on the deal, not rows in the grid, so the section shows them itself. Two things
 * can make a name wrong to print, and both are decided here so they can be tested without a form:
 *
 * - **The viewer may not read it.** `BaseEntity.Get()` throws for a field denied by field-level
 *   security, so the caller checks first (`field-readable.ts`) and passes `Readable: false`; the
 *   contact is then left out rather than read.
 * - **The contact changed and the deal is not saved.** Picking a primary contact, changing the account
 *   or promoting a person sets the contact's ID only; the name column is a view field that catches up
 *   on save. Until then the stored name is the previous person's, so it is not shown.
 *
 * @module @mj-biz-apps/sales-ng
 */

/** One contact the summary may name. */
export interface DealContactSummaryPart {
    Label: string;
    /** The saved name. Read only when `Readable`; pass null otherwise. */
    Name: string | null;
    /** False when field-level security denies the viewer this contact. */
    Readable: boolean;
    /** True when the contact's ID has an unsaved change, so `Name` is the previous person's. */
    Changed: boolean;
}

export const NO_CONTACT = 'none';
export const UNSAVED_CONTACT = 'changed, not saved yet';

/** The summary, or null when the viewer may read neither contact and there is nothing to show. */
export function DealContactsSummary(parts: readonly DealContactSummaryPart[]): string | null {
    const shown = parts.filter((part) => part.Readable);
    if (shown.length === 0) return null;
    return shown.map((part) => `${part.Label}: ${contactText(part)}`).join(' · ');
}

function contactText(part: DealContactSummaryPart): string {
    if (part.Changed) return UNSAVED_CONTACT;
    return part.Name || NO_CONTACT;
}
