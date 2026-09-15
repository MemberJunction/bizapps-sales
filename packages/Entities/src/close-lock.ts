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

/**
 * What a save knows about a status change, before deciding whether it is a bare close.
 *
 * Resolved by the caller because two of these need a database read; the decision itself does not, and
 * that is the point of separating them.
 */
export interface StatusTransitionFacts {
    /** False on creation — a deal born closed has no transition to have run. */
    IsSaved: boolean;
    /** True when `Sales.CloseDeal` (or a reopen) announced itself via `DeclareTransition`. */
    HasDeclaredTransition: boolean;
    /** True when the caller set `DealStatusTypeID` on this save. */
    StatusIsDirty: boolean;
    /** Whether the status being moved INTO carries `LocksDeal`. */
    TargetLocks: boolean;
    /** Whether the status being moved OUT OF carries it. Null when there was none. */
    PriorLocks: boolean | null;
}

/**
 * Is this save about to lock a deal without the close having run? (bc-aidp-next-golive#205)
 *
 * THE DEFECT IT NAMES. The close lock reads the PERSISTED status, so Open -> Won is a save on an
 * unlocked deal and passes straight through it. The deal ends up locked with none of the close having
 * happened — no stage event, no contract, no finance tasks, no loss reason, an order still live — and
 * the lock then refuses `DealStatusTypeID` on every later save, so it cannot be undone either.
 *
 * WHAT MAKES A CLOSE LEGITIMATE is the declared transition. `Sales.CloseDeal` calls `stampClose`
 * immediately before saving, and that declares one; a form writing a field has no way to. So this
 * needs no new flag on the entity, and it cannot be spoofed by a caller that does not know about it.
 *
 * LEAVING a locking status is deliberately NOT this function's business. That is a reopen, and the
 * close lock already refuses a bare one with a message that names `Sales.ReopenDeal` — two refusals
 * for the same edit would be one too many, and the other one is better worded for it.
 *
 * Pure, so the decision can be pinned without a deal, a status table or a save.
 */
export function IsBareCloseWrite(facts: StatusTransitionFacts): boolean {
    if (!facts.IsSaved || facts.HasDeclaredTransition || !facts.StatusIsDirty) {
        return false;
    }
    if (facts.PriorLocks === true) {
        return false; // a reopen attempt; the close lock owns that refusal
    }
    return facts.TargetLocks;
}

/** One row of the deal-status list, with the flag that decides whether it may be picked. */
export interface DealStatusOption {
    ID: string;
    Name: string;
    /** Entering this status closes and freezes the deal. Enforced server-side. */
    LocksDeal: boolean;
    /**
     * The OUTCOME flags, carried so a close action can find the status to close INTO by flag rather
     * than by name. A deployment may call its winning status "Signed"; nothing may match on the word.
     */
    IsWon: boolean;
    IsLost: boolean;
}

/**
 * Every active deal status, with its lock flag, for a surface that has to offer a choice.
 *
 * RETURNS ALL OF THEM AND LETS THE CALLER FILTER, deliberately. A closed deal still has to SHOW the
 * status it is in — a control that simply dropped the locking ones would render a won deal as blank
 * or "— choose —", which reads as data loss. The workspace already solves it this way: it offers the
 * non-locking ones and adds the deal's own status back as a display-only option.
 *
 * `LocksDeal` rather than `IsWon || IsLost`, because that is the flag the server's refusal reads.
 * They coincide on today's data — Won, Lost and Abandoned carry both — but a surface filtering on a
 * different flag would eventually offer a status the server then refuses, which is the drift this
 * module exists to prevent.
 */
export async function LoadDealStatusOptions(contextUser?: UserInfo): Promise<DealStatusOption[]> {
    const result = await new RunView().RunView<{
        ID: string;
        Name: string;
        LocksDeal: boolean;
        IsWon: boolean;
        IsLost: boolean;
    }>(
        {
            EntityName: E_DEAL_STATUS_TYPE,
            ExtraFilter: 'IsActive = 1',
            OrderBy: 'DisplayRank',
            ResultType: 'simple',
            // Every field read below must be listed here. A field declared on the row type and left
            // out of this list arrives `undefined`, and a flag check against it quietly never fires --
            // which is how ActivitySyncProviderType.IsActive did nothing for a release.
            Fields: ['ID', 'Name', 'LocksDeal', 'IsWon', 'IsLost'],
        },
        contextUser,
    );
    if (!result?.Success) {
        // An empty list leaves the control with nothing to offer, which is visibly wrong and therefore
        // reportable. Inventing a list from somewhere else would hide a failed lookup behind a control
        // that looks like it is working.
        return [];
    }
    return (result.Results ?? []).map((r) => ({
        ID: String(r.ID),
        Name: String(r.Name),
        LocksDeal: r.LocksDeal === true,
        IsWon: r.IsWon === true,
        IsLost: r.IsLost === true,
    }));
}
