/**
 * The stages a rep may pick in a Stage list: every stage whose status does not lock the deal.
 *
 * A stage whose `DealStatusType.LocksDeal` is set is where a CLOSE puts a deal. Picking it from a
 * Stage list is not a close: the deal stays open, so the list leaves those stages out and closing goes
 * through the Close action, as the board already does by refusing drops on its closing columns. The
 * deal's current stage stays listed even when it is one of them, so a deal already sitting there still
 * shows where it is.
 *
 * Read from the flag, never from a stage or status name. A status list that failed to load locks
 * nothing here; the server still keeps an open deal from taking a closing stage's figures.
 */

/** What filtering a stage needs: its ID and the status it points at. */
export interface StageWithStatus {
    ID: string;
    DealStatusTypeID?: string | null;
}

/** What filtering needs from a status: its ID and whether it locks the deal. */
export interface StatusLockFlag {
    ID: string;
    LocksDeal: boolean;
}

export function SelectableStages<T extends StageWithStatus>(
    stages: readonly T[],
    statuses: readonly StatusLockFlag[],
    currentStageID: string | null | undefined,
): T[] {
    const locking = new Set(statuses.filter((s) => s.LocksDeal).map((s) => s.ID.toLowerCase()));
    const current = String(currentStageID ?? '').toLowerCase();
    return stages.filter(
        (s) =>
            s.ID.toLowerCase() === current ||
            !s.DealStatusTypeID ||
            !locking.has(s.DealStatusTypeID.toLowerCase()),
    );
}
