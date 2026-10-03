import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * REASSIGNING A REP ON A CLOSED DEAL MUST STILL WORK (golive#206 item 2).
 *
 * `OwnerEmployeeID` is deliberately OUT of the locked-editable set — golive#206 classes Owner as
 * server-written provenance and a hand-set one is refused. But item 2 of the same issue says moving
 * a rep off a closed deal is record-keeping and must be allowed, so `checkCloseLock` carries one
 * carve-out:
 *
 *     && !(f.Name === 'OwnerEmployeeID' && this.RosterDrivesThisSave)
 *
 * WHY THIS FILE EXISTS. That line is the only thing making the case work, and nothing exercised it.
 * No test set `RosterDrivesThisSave` true against a locked deal, and `OwnerEmployeeID` appeared in no
 * locked-deal dirty list, so deleting the carve-out broke golive#206 item 2 and every test still
 * passed. It also now carries a SECOND caller: `DealTeamMemberEntityServer` (sales#147) loads the
 * deal's team and re-saves it, which is exactly the shape the carve-out is keyed on.
 *
 * The protection is doubled in practice — the team grid leaves the field clean, so the stamp is
 * applied by `stampOwnerFromTeam()` AFTER `checkCloseLock()` has already run — but the deal
 * workspace's owner picker (`DealEntity.SetOwner()`) assigns the stamp itself and arrives here
 * DIRTY. That is the `CD29` case the carve-out was written for, and it is what this pins.
 *
 * `Object.create` holds the server entity without standing up metadata, as `AbsentStatusLock` does.
 */

const OPEN = 'bbbbbbbb-0000-4000-8000-000000000001';
const WON = 'bbbbbbbb-0000-4000-8000-000000000002';
const LOST = 'bbbbbbbb-0000-4000-8000-000000000003';

type Row = { LocksDeal: boolean; IsLost: boolean };
const ROWS: Record<string, Row> = {
    [OPEN]: { LocksDeal: false, IsLost: false },
    [WON]: { LocksDeal: true, IsLost: false },
    [LOST]: { LocksDeal: true, IsLost: true },
};

/** A RunView double: a listed ID returns its row, anything else returns an empty, SUCCESSFUL read. */
function statusView() {
    return async ({ ExtraFilter }: { ExtraFilter: string }) => {
        const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
        const row = ROWS[id];
        return row ? { Success: true, Results: [{ ID: id, ...row }] } : { Success: true, Results: [] };
    };
}

type Harness = {
    checkCloseLock(): Promise<string | null>;
    _lockedAtSave: boolean;
};

/**
 * @param persisted the status the deal is SAVED in — what the lock reads.
 * @param dirty     the fields this save changed.
 * @param roster    whether the roster is driving, i.e. `Team.IsLoaded || Team.Count > 0`.
 */
function deal(opts: { persisted: string; dirty: string[]; roster: boolean }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    for (const [k, v] of Object.entries({
        IsSaved: true,
        _declaredTransition: null,
        _reopenInProgress: false,
        _orderStatusWarnings: [],
        _ownerStampWarnings: [],
        Team: { Load: async () => true, IsLoaded: false, Count: 0, Items: [] },
        _orderJustProvisioned: false,
        _lockedAtSave: false,
        _lastStageEventID: null,
        _resultHistory: [],
        DealStatusTypeID: opts.persisted,
        ContextCurrentUser: { ID: 'u1' },
        GetFieldByName: (name: string) =>
            name === 'DealStatusTypeID' ? { Dirty: false, OldValue: opts.persisted } : undefined,
        Fields: opts.dirty.map((Name) => ({ Name, CodeName: Name, Dirty: true, OldValue: null })),
        Companions: [],
        ProviderToUse: { RunView: statusView() },
        Set: () => undefined,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    // A GETTER on the real class (`Team.IsLoaded || Team.Count > 0`), shadowed here.
    Object.defineProperty(instance, 'RosterDrivesThisSave', { get: () => opts.roster });
    return instance;
}

describe('the owner of a CLOSED deal, changed by the roster', () => {
    it('is allowed on a won deal — golive#206 item 2 calls this record-keeping', async () => {
        const d = deal({ persisted: WON, dirty: ['OwnerEmployeeID'], roster: true });
        expect(await d.checkCloseLock(), 'the carve-out must let a roster-driven owner through').toBeNull();
        // Still LOCKED — the carve-out permits one field, it does not reopen the deal.
        expect(d._lockedAtSave, 'the deal is still locked, whatever this edit was').toBe(true);
    });

    it('is allowed on a lost deal too — the outcome decides Loss Notes, not the owner', async () => {
        const d = deal({ persisted: LOST, dirty: ['OwnerEmployeeID'], roster: true });
        expect(await d.checkCloseLock()).toBeNull();
    });

    it('is REFUSED when the roster is not driving — a hand-set owner stays frozen', async () => {
        const d = deal({ persisted: WON, dirty: ['OwnerEmployeeID'], roster: false });
        const refusal = await d.checkCloseLock();
        expect(refusal, 'without the roster this is the hand-set case golive#206 refuses').not.toBeNull();
        expect(refusal).toContain('Owner');
    });

    it('does not extend the carve-out to any OTHER frozen field', async () => {
        // The roster driving must not become a general key to a locked deal.
        const d = deal({ persisted: WON, dirty: ['Amount'], roster: true });
        expect(await d.checkCloseLock(), 'only OwnerEmployeeID is carved out').not.toBeNull();
    });

    it('refuses the other frozen fields even alongside a permitted owner change', async () => {
        const d = deal({ persisted: WON, dirty: ['OwnerEmployeeID', 'Amount'], roster: true });
        const refusal = await d.checkCloseLock();
        expect(refusal, 'Amount is still frozen').not.toBeNull();
        expect(refusal).toContain('Amount');
    });

    it('leaves an OPEN deal alone, roster or not', async () => {
        const d = deal({ persisted: OPEN, dirty: ['OwnerEmployeeID'], roster: false });
        expect(await d.checkCloseLock()).toBeNull();
        expect(d._lockedAtSave).toBe(false);
    });
});
