import { describe, expect, it } from 'vitest';
import { DealEntityServer, HoldsOwnerSeat, type OwnerSeatCandidate } from '../DealEntityServer.js';
import type { EntityDeleteOptions } from '@memberjunction/core';
import { DealTeamMemberEntityServer, PartOfGraphSave } from '../DealTeamMemberEntityServer.js';

/**
 * THE LAST OWNER ROW ON A DEAL STAYS (sales#568).
 *
 * Deleting the Owner / AE row from the Internal team grid saved, then `restampDeals` re-derived the
 * owner from a team with no owner row and blanked `OwnerEmployeeID`. No warning; the deal dropped out
 * of its rep's lists. Deactivating or re-roling that row leaves the same unowned deal.
 *
 * Two halves are pinned: the deal's answer (`LastOwnerSeatRefusal`, over the same `HoldsOwnerSeat`
 * predicate `stampOwnerFromTeam` uses), and the team row's overrides asking it and stopping the write.
 * `Object.create` holds both entities without standing up metadata, as `TeamGridOwnerStamp` does.
 */

const OWNER_ROLE = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const OTHER_ROLE = 'aaaaaaaa-0000-4000-8000-0000000000b2';
const ROW = 'cccccccc-0000-4000-8000-000000000001';
const SECOND = 'cccccccc-0000-4000-8000-000000000002';
const DEAL_A = 'dddddddd-0000-4000-8000-00000000000a';
const MESSAGE =
    'Deal D-0042 would have no owner. Choose the new owner in the Owner field instead; that replaces this row in one save.';

type TeamRow = { ID: string; DealRoleID: string; IsActive: boolean };

function deal(team: TeamRow[]) {
    const instance = Object.create(DealEntityServer.prototype) as DealEntityServer & { TeamLoads: number };
    let loads = 0;
    Object.defineProperty(instance, 'ResolveOwnerRoleID', { value: async () => OWNER_ROLE, writable: true });
    Object.defineProperty(instance, 'Team', {
        value: { Load: async () => { loads++; return true; }, Items: team },
        writable: true,
    });
    Object.defineProperty(instance, 'DealNumber', { value: 'D-0042', writable: true });
    Object.defineProperty(instance, 'TeamLoads', { get: () => loads });
    return instance;
}

const ownerRow = (id = ROW, isActive = true): TeamRow => ({ ID: id, DealRoleID: OWNER_ROLE, IsActive: isActive });

describe('HoldsOwnerSeat — the one predicate the stamp and the guard share', () => {
    it('is an active row in the owner role', () => {
        expect(HoldsOwnerSeat({ DealRoleID: OWNER_ROLE, IsActive: true }, OWNER_ROLE)).toBe(true);
    });
    it('compares role IDs without regard to case', () => {
        expect(HoldsOwnerSeat({ DealRoleID: OWNER_ROLE.toUpperCase(), IsActive: true }, OWNER_ROLE)).toBe(true);
    });
    it('is not an inactive owner row', () => {
        expect(HoldsOwnerSeat({ DealRoleID: OWNER_ROLE, IsActive: false }, OWNER_ROLE)).toBe(false);
    });
    it('counts an unset active flag as active', () => {
        expect(HoldsOwnerSeat({ DealRoleID: OWNER_ROLE, IsActive: null }, OWNER_ROLE)).toBe(true);
    });
    it('is not a row in another role', () => {
        expect(HoldsOwnerSeat({ DealRoleID: OTHER_ROLE, IsActive: true }, OWNER_ROLE)).toBe(false);
    });
});

describe('DealEntityServer.LastOwnerSeatRefusal', () => {
    it('refuses removing the only active owner row, pointing at the Owner field', async () => {
        expect(await deal([ownerRow()]).LastOwnerSeatRefusal(ROW, null)).toBe(MESSAGE);
    });

    it('allows it when a second active owner row remains', async () => {
        expect(await deal([ownerRow(), ownerRow(SECOND)]).LastOwnerSeatRefusal(ROW, null)).toBeNull();
    });

    it('does not count an inactive second owner row as an owner', async () => {
        expect(await deal([ownerRow(), ownerRow(SECOND, false)]).LastOwnerSeatRefusal(ROW, null)).toBe(MESSAGE);
    });

    it('allows removing a row that is not the owner', async () => {
        const d = deal([ownerRow(SECOND), { ID: ROW, DealRoleID: OTHER_ROLE, IsActive: true }]);
        expect(await d.LastOwnerSeatRefusal(ROW, null)).toBeNull();
    });

    it('allows removing an already inactive owner row', async () => {
        expect(await deal([ownerRow(ROW, false)]).LastOwnerSeatRefusal(ROW, null)).toBeNull();
    });

    it('refuses deactivating the last owner row', async () => {
        const after: OwnerSeatCandidate = { DealRoleID: OWNER_ROLE, IsActive: false };
        expect(await deal([ownerRow()]).LastOwnerSeatRefusal(ROW, after)).toBe(MESSAGE);
    });

    it('refuses moving the last owner row to another role', async () => {
        const after: OwnerSeatCandidate = { DealRoleID: OTHER_ROLE, IsActive: true };
        expect(await deal([ownerRow()]).LastOwnerSeatRefusal(ROW, after)).toBe(MESSAGE);
    });

    it('does not read the team for an edit that keeps the row in the seat', async () => {
        const d = deal([ownerRow()]);
        expect(await d.LastOwnerSeatRefusal(ROW, { DealRoleID: OWNER_ROLE, IsActive: true })).toBeNull();
        expect(d.TeamLoads).toBe(0);
    });
});

// ── The team row's overrides ────────────────────────────────────────────────────────────────────

type MemberOpts = {
    /** What the deal answers; `throw` makes the check itself fail. */
    dealAnswer?: string | null | 'throw';
    loadFails?: boolean;
    dirty?: string[];
    current?: { DealID?: string; DealRoleID?: string; IsActive?: boolean };
};

function member(opts: MemberOpts) {
    const asked: Array<{ memberID: string; after: OwnerSeatCandidate | null }> = [];
    const refusals: Array<{ Message: string; Type: string }> = [];
    const savedDeals: string[] = [];
    const instance = Object.create(DealTeamMemberEntityServer.prototype) as {
        Save(): Promise<boolean>;
        Delete(): Promise<boolean>;
    };
    const define = (name: string, value: unknown) => Object.defineProperty(instance, name, { value, writable: true });
    define('ID', ROW);
    define('IsSaved', true);
    define('DealID', opts.current?.DealID ?? DEAL_A);
    define('DealRoleID', opts.current?.DealRoleID ?? OWNER_ROLE);
    define('IsActive', opts.current?.IsActive ?? true);
    define('EmployeeID', 'eeeeeeee-0000-4000-8000-000000000001');
    define('ContextCurrentUser', { ID: 'user' });
    define('Fields', []);
    define('GetFieldByName', (name: string) => {
        const old: Record<string, unknown> = { DealID: DEAL_A, DealRoleID: OWNER_ROLE, IsActive: true };
        return { OldValue: old[name], Dirty: (opts.dirty ?? []).includes(name) };
    });
    define('RegisterResultHistoryEntry', (r: { Message: string; Type: string }) => refusals.push(r));
    define('ProviderToUse', {
        // The role checks: a role that admits several holders, not the owner role, so they pass.
        RunView: async () => ({ Success: true, Results: [{ Name: 'Owner / AE', AllowsMultiplePerDeal: true, IsOwnerRole: false }] }),
        GetEntityObject: async () => ({
            Load: async () => !opts.loadFails,
            Team: { Load: async () => true },
            Save: async () => { savedDeals.push(DEAL_A); return true; },
            LastOwnerSeatRefusal: async (memberID: string, after: OwnerSeatCandidate | null) => {
                asked.push({ memberID, after });
                if (opts.dealAnswer === 'throw') throw new Error('owner role unreadable');
                return opts.dealAnswer ?? null;
            },
        }),
    });
    return { instance, asked, refusals, savedDeals };
}

async function withBase<T>(m: object, method: 'Save' | 'Delete', run: () => Promise<T>): Promise<{ result: T; baseCalls: number }> {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(m));
    const original = proto[method];
    let baseCalls = 0;
    proto[method] = async () => { baseCalls++; return true; };
    try {
        return { result: await run(), baseCalls };
    } finally {
        proto[method] = original;
    }
}

describe('deleting a team row on its own', () => {
    it('is refused with the deal\'s message when it is the last owner row, and nothing is deleted', async () => {
        const m = member({ dealAnswer: MESSAGE });
        const { result, baseCalls } = await withBase(m.instance, 'Delete', () => m.instance.Delete());
        expect(result).toBe(false);
        expect(baseCalls).toBe(0);
        expect(m.refusals).toEqual([expect.objectContaining({ Message: MESSAGE, Type: 'delete' })]);
        expect(m.asked).toEqual([{ memberID: ROW, after: null }]);
    });

    it('goes through when the deal has another owner', async () => {
        const m = member({ dealAnswer: null });
        const { result, baseCalls } = await withBase(m.instance, 'Delete', () => m.instance.Delete());
        expect(result).toBe(true);
        expect(baseCalls).toBe(1);
        expect(m.savedDeals).toEqual([DEAL_A]); // and the owner stamp still refreshes
    });

    it('is refused when the check itself fails', async () => {
        const m = member({ dealAnswer: 'throw' });
        const { result, baseCalls } = await withBase(m.instance, 'Delete', () => m.instance.Delete());
        expect(result).toBe(false);
        expect(baseCalls).toBe(0);
        expect(m.refusals[0].Message).toContain('could not be checked for keeping an owner');
    });

    it('is refused when the deal cannot be loaded', async () => {
        const m = member({ loadFails: true });
        const { result } = await withBase(m.instance, 'Delete', () => m.instance.Delete());
        expect(result).toBe(false);
        expect(m.refusals[0].Message).toContain('could not be read to check that it keeps an owner');
    });
});

describe('editing a team row on its own', () => {
    it('refuses deactivating the last owner row', async () => {
        const m = member({ dealAnswer: MESSAGE, dirty: ['IsActive'], current: { IsActive: false } });
        const { result, baseCalls } = await withBase(m.instance, 'Save', () => m.instance.Save());
        expect(result).toBe(false);
        expect(baseCalls).toBe(0);
        expect(m.refusals).toEqual([expect.objectContaining({ Message: MESSAGE, Type: 'update' })]);
        expect(m.asked).toEqual([{ memberID: ROW, after: { DealRoleID: OWNER_ROLE, IsActive: false } }]);
    });

    it('refuses re-roling the last owner row', async () => {
        const m = member({ dealAnswer: MESSAGE, dirty: ['DealRoleID'], current: { DealRoleID: OTHER_ROLE } });
        const { result } = await withBase(m.instance, 'Save', () => m.instance.Save());
        expect(result).toBe(false);
        expect(m.asked[0].after).toEqual({ DealRoleID: OTHER_ROLE, IsActive: true });
    });

    it('asks as a removal when the row moves to another deal', async () => {
        const m = member({ dealAnswer: MESSAGE, dirty: ['DealID'], current: { DealID: 'dddddddd-0000-4000-8000-00000000000b' } });
        const { result } = await withBase(m.instance, 'Save', () => m.instance.Save());
        expect(result).toBe(false);
        expect(m.asked[0].after).toBeNull();
    });

    it('does not ask the deal about an edit that touches neither role nor active flag', async () => {
        const m = member({ dealAnswer: MESSAGE, dirty: ['Notes'] });
        const { result, baseCalls } = await withBase(m.instance, 'Save', () => m.instance.Save());
        expect(result).toBe(true);
        expect(baseCalls).toBe(1);
        expect(m.asked).toEqual([]);
    });
});

/**
 * SETOWNER'S SWAP KEEPS WORKING. MJ's graph save deletes a row removed from `Team` through the row's
 * own `Delete()`, before it inserts the new owner row, so the guard would see an ownerless deal for a
 * moment and refuse the swap. Graph nodes carry `GraphVisited` on their options; the guard skips them.
 */
describe('a team row saved or deleted as part of the deal\'s graph save', () => {
    const graphOptions = { GraphVisited: new Set<string>() };

    it('is not asked about the owner seat on delete', async () => {
        const m = member({ dealAnswer: MESSAGE });
        const { result, baseCalls } = await withBase(m.instance, 'Delete', () =>
            (m.instance as unknown as { Delete(o: object): Promise<boolean> }).Delete(graphOptions));
        expect(result).toBe(true);
        expect(baseCalls).toBe(1);
        expect(m.asked).toEqual([]);
    });

    it('is not asked about the owner seat on save', async () => {
        const m = member({ dealAnswer: MESSAGE, dirty: ['IsActive'], current: { IsActive: false } });
        const { result } = await withBase(m.instance, 'Save', () =>
            (m.instance as unknown as { Save(o: object): Promise<boolean> }).Save(graphOptions));
        expect(result).toBe(true);
        expect(m.asked).toEqual([]);
    });
});

describe('PartOfGraphSave', () => {
    it('is true only when the options carry the graph executor\'s GraphVisited set', () => {
        expect(PartOfGraphSave(undefined)).toBe(false);
        expect(PartOfGraphSave({} as EntityDeleteOptions)).toBe(false);
        expect(PartOfGraphSave({ GraphVisited: new Set<string>() } as EntityDeleteOptions)).toBe(true);
    });
});
