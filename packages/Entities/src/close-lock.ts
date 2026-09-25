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
 * The deal fields that stay editable while the deal is locked, on ANY locked deal.
 *
 * Pinned by integration check CD14, which closes a deal and then proves each of these is genuinely
 * accepted and that a field outside the set is genuinely refused — so this cannot quietly stop
 * describing what the server does.
 */
const EDITABLE_ON_ANY_LOCKED_DEAL: ReadonlySet<string> = new Set<string>([
    // Commentary. A closed deal still gets notes, and forcing a reopen to add one would corrupt the
    // reopen record with administrative noise.
    'Description',
    // Follow-up. NextStepDate is here because leaving one of the pair open and the other frozen makes
    // no sense -- a next step nobody may date is half a field.
    'NextStep',
    'NextStepDate',
    // Attribution and bookkeeping. Nothing downstream reads these, and they are routinely corrected
    // after the fact: the contract takes the PRIMARY contact, not the billing one, and Lead Source and
    // Campaign exist for reporting.
    'BillingContactID',
    'LeadSourceTypeID',
    'CampaignID',
]);

/**
 * The fields that stay editable only on a LOST deal.
 *
 * golive#206's field table says "Loss Notes (Lost deals only)", and item 3 asks that the server's
 * list "match this list exactly". An earlier version of this module put `LossNotes` in the flat set
 * above and said so out loud: a conditional member would need the form and the server to evaluate the
 * same condition, which is the drift this module exists to prevent.
 *
 * That reasoning was weaker than it read. THIS module is exactly where such a condition belongs --
 * the same place that already owns "how you decide a deal is locked at all". Both sides now pass a
 * flag they already hold, from the same resolver, and the condition itself lives here once.
 *
 * `LossReasonID` stays frozen on every deal, lost included: the close event records which reason was
 * chosen, and rewriting it would make that event dishonest. Notes are the channel for corrections.
 */
const EDITABLE_ON_A_LOST_DEAL: ReadonlySet<string> = new Set<string>(['LossNotes']);

/**
 * Every field a locked deal still accepts, given its outcome.
 *
 * Takes the flag rather than exposing a flat set, so a caller cannot read the list and forget the
 * condition. That is not hypothetical: four call sites used to read the flat constant directly.
 *
 * @param isLost - whether the deal's PERSISTED status carries `IsLost`. When it cannot be determined,
 *                 pass `false`: refusing an edit to a closed deal is the cheaper mistake.
 */
export function DealFieldsEditableWhileLocked(isLost: boolean): ReadonlySet<string> {
    if (!isLost) {
        return EDITABLE_ON_ANY_LOCKED_DEAL;
    }
    return new Set<string>([...EDITABLE_ON_ANY_LOCKED_DEAL, ...EDITABLE_ON_A_LOST_DEAL]);
}

/**
 * Whether `fieldName` may still be edited on a locked deal with this outcome.
 *
 * Callers should prefer this to reaching into the sets, so the membership test stays in one place.
 */
export function IsDealFieldEditableWhileLocked(fieldName: string, isLost: boolean): boolean {
    return EDITABLE_ON_ANY_LOCKED_DEAL.has(fieldName) || (isLost && EDITABLE_ON_A_LOST_DEAL.has(fieldName));
}

/**
 * What each editable-while-locked field is CALLED on screen.
 *
 * The lock notice used to interpolate the raw field names, so a user read "only Description and
 * NextStep can still be changed" — `NextStep` being a column name that appears nowhere on the form.
 * golive#207 asks for the labels a salesperson sees.
 *
 * Falling back to the field name is deliberate rather than throwing: a field added to the set without
 * a label here should read slightly wrong, not take the whole notice down. `DealFieldLabel` is
 * exported so a test can prove every member of the set has one.
 */
const DEAL_FIELD_LABELS: Readonly<Record<string, string>> = {
    Description: 'Description',
    NextStep: 'Next Step',
    NextStepDate: 'Next Step Date',
    BillingContactID: 'Billing Contact',
    LeadSourceTypeID: 'Lead Source',
    CampaignID: 'Campaign',
    LossNotes: 'Loss Notes',
    DealStatusTypeID: 'Deal Status',
};

/**
 * Splits a column name into words and drops a trailing `ID`: `ExpectedCloseDate` -> `Expected Close
 * Date`, `BillingContactID` -> `Billing Contact`.
 *
 * THIS EXISTS BECAUSE THE MAP ABOVE COVERS THE WRONG HALF OF THE RULE. It holds the fields the lock
 * leaves EDITABLE -- what row 16 lists. Row 18 names the FROZEN fields, and there are far more of
 * those, none of them in the map: `Amount`, `ExpectedCloseDate`, `AnnualIncreasePctOverride` and every
 * other column a form or an importer can set. Falling back to the raw field name meant row 18 read
 * "ExpectedCloseDate, AnnualIncreasePctOverride cannot be changed" -- the exact "NextStep being a
 * column name that appears nowhere on the form" complaint the map was added to answer, on the message
 * a user is far more likely to see.
 *
 * Deriving rather than hand-listing the frozen set, because a hand list would have to be extended
 * every time a column is added and would read correctly right up until somebody forgot -- the same
 * shape as the gap it is replacing. The map stays for the two labels a split cannot produce
 * (`LeadSourceTypeID` -> "Lead Source", not "Lead Source Type") and is now an override rather than
 * the only source of a label.
 */
function SplitFieldName(fieldName: string): string {
    return fieldName
        .replace(/ID$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .trim();
}

/** The on-screen label for a deal field: the override if there is one, else the field name split into words. */
export function DealFieldLabel(fieldName: string): string {
    return DEAL_FIELD_LABELS[fieldName] ?? SplitFieldName(fieldName);
}

/**
 * What the lock notice lists as still editable.
 *
 * DEAL STATUS IS IN HERE AND NOT IN `DealFieldsEditableWhileLocked`, which looks like a
 * contradiction and is not. That set is what the SERVER accepts in a bare save, and golive#205 asks
 * for a bare status write to be refused on every path — the status moves through `Sales.CloseDeal`
 * and `Sales.ReopenDeal`, which the form's status control routes to. So the field IS editable to a
 * person and IS NOT writable by a raw save, and one set cannot say both.
 *
 * The notice describes what a PERSON can do, so it is the one that carries Deal Status.
 *
 * It takes `isLost` because the set it wraps does: golive#206 keeps Loss Notes editable on a lost
 * deal and frozen on a won one, so the notice must name it on one and not the other.
 */
export function DealFieldsListedAsEditable(isLost: boolean): readonly string[] {
    return ['DealStatusTypeID', ...DealFieldsEditableWhileLocked(isLost)];
}

/**
 * Join labels the way a sentence does: "A, B and C".
 *
 * Oxford-comma-free and with "and" before the last, because this lands mid-sentence in prose a tester
 * wrote, not in a bulleted list.
 */
export function JoinLabels(labels: readonly string[]): string {
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Sales' deal-status type table. Named here so the lock lookup below has one spelling of it. */
const E_DEAL_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

/** What a surface needs to know to render the lock: whether it is on, and what to say about it. */
export interface DealLockState {
    IsLocked: boolean;
    /** The status' display name, for the notice. Null when not locked. */
    StatusName: string | null;
    /**
     * Whether the locking status carries `IsLost`, which decides one field: golive#206 keeps Loss
     * Notes editable on a lost deal and frozen on a won one.
     *
     * Resolved HERE rather than by each surface, for the same reason `IsLocked` is: it is read off the
     * status ROW by flag, from the PERSISTED status, and a second implementation gets one of those
     * quietly wrong. `false` on an open deal and on a status that cannot be read — refusing an edit to
     * a closed deal is the cheaper mistake.
     */
    IsLost: boolean;
    /**
     * Whether the PERSISTED status carries `IsWon` — the outcome, not the lock.
     *
     * UNLIKE EVERY OTHER MEMBER HERE, THIS IS NOT GATED ON `LocksDeal`, and the difference is the
     * whole reason it exists. The rest of this shape answers "what may still be edited", a question
     * only a locked deal has. `IsWon` answers "did we win", which an OPEN deal can also answer, and
     * golive#226 asks the Deal header for chips that appear on a won deal and on no other. Gating it
     * on the lock would tie a header decision to a field-editing one, so a deployment whose winning
     * status does not freeze the deal would lose its Order and Contract chips with nothing on screen
     * to explain it.
     *
     * Read off the status ROW by FLAG, like its siblings. Nothing anywhere compares a status name —
     * a deployment may call its winning status "Signed" (§3), and `test:vocabulary-gate` enforces it.
     *
     * `false` when the status cannot be read: a chip that is missing costs a click, and one that
     * should not be there says a deal was won when it was not.
     *
     * golive#231's outcome tiles read it too, and are unaffected by the ungating: every one of those
     * getters tests the CLOSE STAMPS first, so an open won-status deal still reads "Closes".
     */
    IsWon: boolean;
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
    const open: DealLockState = { IsLocked: false, StatusName: null, IsLost: false, IsWon: false, Notice: null };
    if (!persistedStatusID) {
        return open;
    }

    const result = await new RunView().RunView<{ LocksDeal: boolean; Name: string; IsLost: boolean; IsWon: boolean }>(
        {
            EntityName: E_DEAL_STATUS_TYPE,
            ExtraFilter: `ID = '${String(persistedStatusID).replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['LocksDeal', 'Name', 'IsLost', 'IsWon'],
        },
        contextUser,
    );
    const row = result?.Success ? (result.Results ?? [])[0] : undefined;

    /**
     * A STATUS ROW THAT IS ABSENT LOCKS THE DEAL, as `DealEntityServer.checkCloseLock` does.
     *
     * The read succeeded and found nothing, so nothing can prove the deal is open. The server locks it
     * with the ordinary editable set of a deal that is not lost, and this reports the same so no surface
     * offers a field the server then refuses. Setting the status to an open one is the way out.
     */
    if (result?.Success && !row) {
        const editable = JoinLabels(DealFieldsListedAsEditable(false).map(DealFieldLabel));
        return {
            IsLocked: true,
            StatusName: null,
            IsLost: false,
            IsWon: false,
            Notice:
                `This deal's status could not be found, so it is treated as closed. Only ${editable} can be ` +
                'edited. To change anything else, set the status to an open one.',
        };
    }

    /**
     * THE OUTCOME SURVIVES THE EARLY RETURN, THE LOCK DOES NOT.
     *
     * `IsWon` is a fact about the status itself, so it is carried out of every exit below rather than
     * being reset to `false` by the unlocked one. The cost of getting this backwards is silent: the
     * header would simply draw no chips on a won-but-unlocked deal, which looks exactly like a deal
     * with no order and no contract.
     */
    const isWon = row?.IsWon === true;
    if (!row?.LocksDeal) {
        return { ...open, IsWon: isWon };
    }

    /**
     * golive#207 row 16, in the tester's words: "This deal is closed (Won). Only Deal Status,
     * Description and Next Step can be edited. To change anything else, set the status back to Open."
     *
     * DERIVED rather than hardcoded to those three. The tester wrote that list when the editable set
     * held two fields; golive#206 item 3 expands it. A hardcoded sentence would have started lying the
     * moment that landed, and the lie would be invisible — it reads perfectly either way.
     *
     * What went, and why it is no loss: the old notice explained WHY the deal is frozen ("a contract or
     * an order was derived from it"). A person who has just been stopped wants to know what they can do,
     * not the provenance argument, and the reason is one click away in the close history.
     */
    const isLost = row.IsLost === true;
    const editable = JoinLabels(DealFieldsListedAsEditable(isLost).map(DealFieldLabel));
    return {
        IsLocked: true,
        StatusName: row.Name,
        IsLost: isLost,
        IsWon: isWon,
        Notice:
            `This deal is closed (${row.Name}). Only ${editable} can be edited. ` +
            'To change anything else, set the status back to Open.',
    };
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
