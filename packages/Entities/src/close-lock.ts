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
import { RunView, type UserInfo } from '@memberjunction/core';

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

/** Sales' deal-status type table. Named here so the lock lookup below has one spelling of it. */
const E_DEAL_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

/** What a surface needs to know to render the lock: whether it is on, and what to say about it. */
export interface DealLockState {
    IsLocked: boolean;
    /** The status' display name, for the notice. Null when not locked. */
    StatusName: string | null;
    /** A ready-to-render explanation, or null when the deal is open. */
    Notice: string | null;
}

/**
 * Resolves whether a PERSISTED status locks the deal.
 *
 * ── WHY THE LOOKUP IS SHARED, NOT JUST THE FIELD LIST ───────────────────────────────────────────
 *
 * Sharing `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` alone would still leave two copies of the more subtle
 * half — *how you decide a deal is locked at all*: read `LocksDeal` off the status ROW, by FLAG, and
 * off the **persisted** status rather than whatever the user just picked in a dropdown. Both of those
 * are easy to get quietly wrong in a second implementation, and a surface that resolved the lock from
 * the pending status would unlock a deal the moment someone changed the dropdown.
 *
 * So every surface calls this. The Explorer record form and the deal workspace now share one answer.
 *
 * Reads the FLAG, never a status name — a deployment may call its winning status "Signed" (§3).
 *
 * @param persistedStatusID - `DealStatusTypeID`'s **OldValue**, not its current value.
 * @param contextUser - Server callers must pass one; the browser omits it.
 */
export async function ResolveDealLockState(
    persistedStatusID: string | null | undefined,
    contextUser?: UserInfo,
): Promise<DealLockState> {
    const open: DealLockState = { IsLocked: false, StatusName: null, Notice: null };
    if (!persistedStatusID) {
        return open;
    }

    const result = await new RunView().RunView<{ LocksDeal: boolean; Name: string }>(
        {
            EntityName: E_DEAL_STATUS_TYPE,
            ExtraFilter: `ID = '${String(persistedStatusID).replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['LocksDeal', 'Name'],
        },
        contextUser,
    );
    const row = result?.Success ? (result.Results ?? [])[0] : undefined;
    if (!row?.LocksDeal) {
        return open;
    }

    const editable = [...DEAL_FIELDS_EDITABLE_WHILE_LOCKED].join(' and ');
    return {
        IsLocked: true,
        StatusName: row.Name,
        Notice:
            `This deal is closed (${row.Name}) and locked. A contract or an order was derived from it, so ` +
            `its terms are frozen — only ${editable} can still be changed. To change anything else, reopen ` +
            'the deal, which records a reason.',
    };
}
