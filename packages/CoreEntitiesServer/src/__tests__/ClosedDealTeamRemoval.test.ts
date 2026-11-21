import { describe, expect, it } from 'vitest';
import {
    CLOSED_TEAM_REMOVAL,
    CLOSED_TEAM_REMOVAL_WITH_REOPEN,
    DealEntityServer,
} from '../DealEntityServer.js';

/**
 * NO ONE IS REMOVED FROM A CLOSED DEAL'S TEAM, EXCEPT THE OWNER BEING REPLACED (bc-aidp-next-golive#465).
 *
 * Two paths delete a team row and each has its own check:
 *
 * - a removal STAGED on the deal's `Team` collection, executed by the deal's graph save —
 *   `checkCloseLock` rules on it, and lets an owner swap through because `SetOwner` replaces an owner
 *   as a remove plus an add (golive#206 item 2 keeps reassignment after close);
 * - a row deleted ON ITS OWN — `DealTeamMemberEntityServer.Delete` asks
 *   `StandaloneTeamRemovalRefusal` on the loaded deal.
 *
 * `Object.create` holds the server entity without standing up metadata, as
 * `ClosedDealRosterOwnerChange` does.
 */

const OPEN = 'bbbbbbbb-0000-4000-8000-000000000001';
const WON = 'bbbbbbbb-0000-4000-8000-000000000002';
const LOST = 'bbbbbbbb-0000-4000-8000-000000000003';
const MISSING = 'bbbbbbbb-0000-4000-8000-0000000000ff';
const OWNER_ROLE = 'cccccccc-0000-4000-8000-000000000001';
const SE_ROLE = 'cccccccc-0000-4000-8000-000000000002';

type Row = { LocksDeal: boolean; IsLost: boolean; IsWon: boolean };
const STATUSES: Record<string, Row> = {
    [OPEN]: { LocksDeal: false, IsLost: false, IsWon: false },
    [WON]: { LocksDeal: true, IsLost: false, IsWon: true },
    [LOST]: { LocksDeal: true, IsLost: true, IsWon: false },
};

type TeamRow = { IsSaved: boolean; Get(name: string): unknown };
const row = (roleID: string, saved = true): TeamRow => ({
    IsSaved: saved,
    Get: (name: string) => (name === 'DealRoleID' ? roleID : undefined),
});

type Harness = {
    checkCloseLock(reopening?: boolean): Promise<string | null>;
    StandaloneTeamRemovalRefusal(): Promise<string | null>;
};

/**
 * @param persisted the status the deal is SAVED in.
 * @param removed   rows staged for removal on `Team`.
 * @param items     rows on `Team` after the edit (a new row is `IsSaved: false`).
 */
function deal(opts: {
    persisted: string;
    removed?: TeamRow[];
    items?: TeamRow[];
    ownerRoleReadFails?: boolean;
    statusReadFails?: boolean;
}): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const runView = async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter: string }) => {
        if (EntityName === 'MJ_BizApps_Sales: Deal Roles') {
            return opts.ownerRoleReadFails
                ? { Success: false, ErrorMessage: 'role read failed', Results: [] }
                : { Success: true, Results: [{ ID: OWNER_ROLE }] };
        }
        if (opts.statusReadFails) {
            return { Success: false, ErrorMessage: 'status read failed', Results: [] };
        }
        const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
        const status = STATUSES[id];
        return status ? { Success: true, Results: [{ ID: id, ...status }] } : { Success: true, Results: [] };
    };
    const removed = opts.removed ?? [];
    const items = opts.items ?? [];
    for (const [k, v] of Object.entries({
        IsSaved: true,
        _reopenInProgress: false,
        _orderStatusWarnings: [],
        _lockedAtSave: false,
        Team: { Removed: removed, Items: items, IsLoaded: true, Count: items.length },
        ContextCurrentUser: { ID: 'u1' },
        GetFieldByName: (name: string) =>
            name === 'DealStatusTypeID' ? { Dirty: false, OldValue: opts.persisted } : undefined,
        Fields: [],
        Companions: [],
        ProviderToUse: { RunView: runView },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'RosterDrivesThisSave', { get: () => true });
    return instance;
}

describe('a removal staged on a CLOSED deal\'s team', () => {
    it('is refused when someone other than the owner is removed', async () => {
        const d = deal({ persisted: WON, removed: [row(SE_ROLE)], items: [row(OWNER_ROLE)] });
        expect(await d.checkCloseLock()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('is refused on a lost deal too', async () => {
        const d = deal({ persisted: LOST, removed: [row(SE_ROLE)] });
        expect(await d.checkCloseLock()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('allows an owner swap: the owner row goes and a new owner row arrives in the same save', async () => {
        const d = deal({ persisted: WON, removed: [row(OWNER_ROLE)], items: [row(SE_ROLE), row(OWNER_ROLE, false)] });
        expect(await d.checkCloseLock(), 'golive#206 item 2: reassigning the owner after close').toBeNull();
    });

    it('refuses removing the owner with no replacement', async () => {
        const d = deal({ persisted: WON, removed: [row(OWNER_ROLE)], items: [row(SE_ROLE)] });
        expect(await d.checkCloseLock()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('does not count an EXISTING owner row as the replacement', async () => {
        // Only a row this save adds can be the new owner; a saved one was already there.
        const d = deal({ persisted: WON, removed: [row(OWNER_ROLE)], items: [row(OWNER_ROLE)] });
        expect(await d.checkCloseLock()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('refuses an owner swap that also removes someone else', async () => {
        const d = deal({
            persisted: WON,
            removed: [row(OWNER_ROLE), row(SE_ROLE)],
            items: [row(OWNER_ROLE, false)],
        });
        expect(await d.checkCloseLock()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('fails closed when the owner role cannot be read', async () => {
        const d = deal({ persisted: WON, removed: [row(OWNER_ROLE)], items: [row(OWNER_ROLE, false)], ownerRoleReadFails: true });
        const refusal = await d.checkCloseLock();
        expect(refusal).toContain('could not be checked');
    });

    it('uses the two-save message when the same save reopens the deal', async () => {
        const d = deal({ persisted: WON, removed: [row(SE_ROLE)] });
        expect(await d.checkCloseLock(true)).toBe(CLOSED_TEAM_REMOVAL_WITH_REOPEN);
    });

    it('ignores a row that was added and removed before it was ever saved', async () => {
        const d = deal({ persisted: WON, removed: [row(SE_ROLE, false)] });
        expect(await d.checkCloseLock()).toBeNull();
    });

    it('leaves an OPEN deal alone', async () => {
        const d = deal({ persisted: OPEN, removed: [row(SE_ROLE)] });
        expect(await d.checkCloseLock()).toBeNull();
    });
});

describe('a team row deleted on its own', () => {
    it('is refused on a won deal', async () => {
        expect(await deal({ persisted: WON }).StandaloneTeamRemovalRefusal()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('is refused on a lost deal', async () => {
        expect(await deal({ persisted: LOST }).StandaloneTeamRemovalRefusal()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('is refused when the status names no row, as the close lock treats it', async () => {
        expect(await deal({ persisted: MISSING }).StandaloneTeamRemovalRefusal()).toBe(CLOSED_TEAM_REMOVAL);
    });

    it('is refused when the status cannot be read (fails closed)', async () => {
        expect(await deal({ persisted: WON, statusReadFails: true }).StandaloneTeamRemovalRefusal()).toBe(
            CLOSED_TEAM_REMOVAL,
        );
    });

    it('is allowed on an open deal', async () => {
        expect(await deal({ persisted: OPEN }).StandaloneTeamRemovalRefusal()).toBeNull();
    });
});
