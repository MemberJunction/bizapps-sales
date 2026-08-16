/**
 * @fileoverview The close lock's field rule, in ONE place.
 *
 * WHY THIS IS NOT A PRIVATE STATIC ANY MORE. The lock is enforced in
 * `DealEntityServer.Save()` — deliberately, so an Action, an agent and a raw `BaseEntity.Save()` all hit
 * the same wall (master plan §7.3, L-17). But the Explorer form has to know the SAME rule to be usable:
 * a form that presents a frozen field as editable invites someone to type into it, press Save, and be
 * refused by the server. That is a correct refusal delivered at the worst possible moment.
 *
 * Two copies of this list would drift, and the drift would be invisible until a user hit it — the form
 * would offer a field the server refuses, or grey out one it would have accepted. So the server reads
 * this and the form reads this, and there is nothing to keep in sync.
 *
 * It lives in `sales-entities` because that is the only package both the entity server and the Angular
 * layer already depend on.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────────
 *
 * When a deal enters a status whose `DealStatusType.LocksDeal` is set, the deal, its lines and its team
 * become immutable — **except** for these fields. The lock is field-by-field rather than a wall because
 * a closed deal still needs notes: someone has to be able to write "customer asked about renewal"
 * without reopening the deal and falsifying its provenance. Everything a contract or an order was
 * derived from is frozen.
 *
 * Reopening is the one audited way back through, via `Sales.ReopenDeal`, which records a reason.
 *
 * @module @mj-biz-apps/sales-entities
 */

/**
 * The deal fields that stay editable while the deal is locked.
 *
 * Pinned by integration check CD14, which closes a deal and then proves each of these is genuinely
 * accepted and that a field outside the set is genuinely refused — so this constant cannot quietly
 * stop describing what the server does.
 */
export const DEAL_FIELDS_EDITABLE_WHILE_LOCKED: ReadonlySet<string> = new Set<string>([
    'Description',
    'NextStep',
]);

/**
 * Whether `fieldName` may still be edited on a locked deal.
 *
 * Callers should prefer this to reaching into the set, so the membership test stays in one place if the
 * rule ever grows a condition beyond simple membership.
 */
export function IsDealFieldEditableWhileLocked(fieldName: string): boolean {
    return DEAL_FIELDS_EDITABLE_WHILE_LOCKED.has(fieldName);
}
