import { describe, expect, it } from 'vitest';
import { DealTeamMemberEntityServer } from '../DealTeamMemberEntityServer.js';

/**
 * ADDING YOURSELF AS OWNER / AE IN THE TEAM GRID DID NOT UPDATE THE DEAL.
 *
 * bc-aidp-next-golive#291: `stampOwnerFromTeam()` is guarded by `RosterDrivesThisSave`, which asks
 * whether the team is part of THIS save. The Deal form's Internal team grid saves the child row and
 * nothing else, so the grid showed an owner while the Overview still said "No owner assigned."
 *
 * The sharpest version: `ownerStampEditRefusal()` refuses a hand-set owner with "Change the Owner
 * role on the Internal team panel instead" — and that panel was the one path that did not work.
 *
 * WHAT IS PINNED HERE is the mechanism, not a recomputation of the owner. This class deliberately
 * does NOT derive an owner: it loads the deal WITH its team and saves, which makes
 * `RosterDrivesThisSave` true and lets the existing `stampOwnerFromTeam()` do the deriving. So the
 * assertions are about which deals get re-saved and that the team is loaded first — a save without
 * the load is a silent no-op, which is the bug itself wearing a different hat.
 *
 * `Object.create` holds the entity without standing up metadata, the way `SeedOwnerOnCreate` does,
 * and every member the methods touch is shadowed explicitly — it does not run the constructor.
 */

const DEAL_A = 'dddddddd-0000-4000-8000-00000000000a';
const DEAL_B = 'dddddddd-0000-4000-8000-00000000000b';

type Opts = {
    DealID?: string | null;
    /** `OldValue` for DealID — what the row pointed at before this save. */
    priorDealID?: string | null;
    IsSaved?: boolean;
    superSaveResult?: boolean;
    superDeleteResult?: boolean;
    /** Deals whose Save() should refuse, by id. */
    saveRefuses?: string[];
    /** Deals whose Load() should fail, by id. */
    loadFails?: string[];
    /** Make this row's role one that admits a single holder per deal (Owner / AE in the seed). */
    singleHolderRole?: boolean;
    /** The employee name already holding that role on this deal, if any. */
    existingHolder?: string;
};

function member(opts: Opts) {
    const loadedTeams: string[] = [];
    const savedDeals: string[] = [];
    const loadedDeals: string[] = [];

    const instance = Object.create(DealTeamMemberEntityServer.prototype) as {
        Save(): Promise<boolean>;
        Delete(): Promise<boolean>;
        LoadedTeams: string[];
        SavedDeals: string[];
        LoadedDeals: string[];
    };

    const dealID = 'DealID' in opts ? opts.DealID : DEAL_A;
    Object.defineProperty(instance, 'DealID', { value: dealID, writable: true });
    Object.defineProperty(instance, 'DealRoleID', { value: 'role-owner', writable: true });
    Object.defineProperty(instance, 'IsActive', { value: true, writable: true });
    Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved ?? true, writable: true });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'user' }, writable: true });

    Object.defineProperty(instance, 'GetFieldByName', {
        value: (name: string) => {
            if (name === 'DealID') return { OldValue: 'priorDealID' in opts ? opts.priorDealID : dealID };
            if (name === 'DealRoleID') return { OldValue: 'role-owner' };
            if (name === 'IsActive') return { OldValue: true };
            return undefined;
        },
        writable: true,
    });

    // The base-class halves. `Object.create` gives us the prototype chain, so these shadow what the
    // overrides call through to.
    Object.defineProperty(instance, 'baseSave', { value: async () => opts.superSaveResult ?? true, writable: true });

    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            GetEntityObject: async () => {
                let loadedID = '';
                return {
                    Load: async (id: string) => {
                        loadedID = id;
                        loadedDeals.push(id);
                        return !(opts.loadFails ?? []).includes(id);
                    },
                    Team: {
                        Load: async () => {
                            loadedTeams.push(loadedID);
                            return true;
                        },
                    },
                    Save: async () => {
                        savedDeals.push(loadedID);
                        return !(opts.saveRefuses ?? []).includes(loadedID);
                    },
                };
            },
        },
        writable: true,
    });

    /**
     * `Fields` exists for `refuseSave`, which reads it to record what the refused save carried.
     * Absent, a refusal throws while reporting the refusal, which hides the reason behind a TypeError.
     */
    Object.defineProperty(instance, 'Fields', { value: [], writable: true });
    Object.defineProperty(instance, 'RegisterResultHistoryEntry', { value: () => undefined, writable: true });

    /**
     * The single-holder check reads `DealRole.AllowsMultiplePerDeal` and then the deal's rows in that
     * role. Default is a role that ADMITS several, so every test written before that check existed
     * still exercises the path it was written for; `singleHolderRole` and `existingHolder` opt in.
     */
    Object.defineProperty(instance, 'RunView', { value: undefined, writable: true });
    const provider = (instance as unknown as { ProviderToUse: Record<string, unknown> }).ProviderToUse;
    provider.RunView = async ({ EntityName }: { EntityName: string }) => {
        if (EntityName === 'MJ_BizApps_Sales: Deal Roles') {
            return {
                Success: true,
                Results: [{ Name: 'Owner / AE', AllowsMultiplePerDeal: !(opts.singleHolderRole ?? false) }],
            };
        }
        return { Success: true, Results: opts.existingHolder ? [{ Employee: opts.existingHolder }] : [] };
    };

    Object.defineProperty(instance, 'LoadedTeams', { get: () => loadedTeams });
    Object.defineProperty(instance, 'SavedDeals', { get: () => savedDeals });
    Object.defineProperty(instance, 'LoadedDeals', { get: () => loadedDeals });
    return instance;
}

/** Runs the override while shadowing the base-class `Save`/`Delete` it calls through to. */
async function runSave(m: ReturnType<typeof member>, superResult = true): Promise<boolean> {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(m));
    const original = proto.Save;
    proto.Save = async () => superResult;
    try {
        return await m.Save();
    } finally {
        proto.Save = original;
    }
}

async function runDelete(m: ReturnType<typeof member>, superResult = true): Promise<boolean> {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(m));
    const original = proto.Delete;
    proto.Delete = async () => superResult;
    try {
        return await m.Delete();
    } finally {
        proto.Delete = original;
    }
}

describe('saving a team row refreshes the deal it belongs to', () => {
    it('re-saves the deal, so stampOwnerFromTeam runs', async () => {
        const m = member({});
        expect(await runSave(m)).toBe(true);
        expect(m.SavedDeals).toEqual([DEAL_A]);
    });

    /**
     * THE LOAD IS THE MECHANISM. `RosterDrivesThisSave` asks `Team.IsLoaded`, so a deal saved without
     * its team loaded runs `stampOwnerFromTeam()` and returns early — a save that silently does
     * nothing, which is the bug this class exists to fix.
     */
    it('loads the team before saving, or the save would be a no-op', async () => {
        const m = member({});
        await runSave(m);
        expect(m.LoadedTeams).toEqual([DEAL_A]);
    });

    it('does nothing when the row itself did not save', async () => {
        const m = member({});
        expect(await runSave(m, false)).toBe(false);
        expect(m.SavedDeals).toEqual([]);
    });
});

describe('a row that moves between deals refreshes both', () => {
    /**
     * The deal it left is owned by nobody now; the deal it joined may have an owner it did not have.
     * Asking only about the CURRENT DealID would leave the first one stale.
     */
    it('refreshes the previous deal and the current one', async () => {
        const m = member({ priorDealID: DEAL_A, DealID: DEAL_B });
        await runSave(m);
        expect(m.SavedDeals.sort()).toEqual([DEAL_A, DEAL_B].sort());
    });

    it('refreshes a deal once when nothing moved', async () => {
        const m = member({ priorDealID: DEAL_A, DealID: DEAL_A });
        await runSave(m);
        expect(m.SavedDeals).toEqual([DEAL_A]);
    });
});

describe('deleting a team row refreshes the deal', () => {
    it('re-saves the deal the row was on', async () => {
        const m = member({});
        expect(await runDelete(m)).toBe(true);
        expect(m.SavedDeals).toEqual([DEAL_A]);
    });

    it('does nothing when the delete itself failed', async () => {
        const m = member({});
        expect(await runDelete(m, false)).toBe(false);
        expect(m.SavedDeals).toEqual([]);
    });
});

/**
 * A FAILED RE-STAMP MUST NOT UNDO A COMMITTED ROSTER EDIT.
 *
 * The row is already saved by the time this runs, and the roster is the authority — a deal whose
 * stamp is briefly stale still has a correct team, and the next save of either fixes it. Reporting
 * failure for a write that succeeded, or rolling back a correct edit because a derived field could
 * not be refreshed, are both worse than a logged warning.
 */
describe('when the deal cannot be refreshed', () => {
    it('still reports the row as saved when the deal refuses', async () => {
        const m = member({ saveRefuses: [DEAL_A] });
        expect(await runSave(m)).toBe(true);
    });

    it('still reports the row as saved when the deal cannot be loaded', async () => {
        const m = member({ loadFails: [DEAL_A] });
        expect(await runSave(m)).toBe(true);
        expect(m.SavedDeals).toEqual([]); // and does not try to save what it could not load
    });

    it('refreshes the second deal even when the first fails', async () => {
        const m = member({ priorDealID: DEAL_A, DealID: DEAL_B, loadFails: [DEAL_A] });
        await runSave(m);
        expect(m.SavedDeals).toEqual([DEAL_B]);
    });
});

describe('a row with no deal', () => {
    it('is not chased — there is nothing to refresh', async () => {
        const m = member({ DealID: null, priorDealID: null });
        await runSave(m);
        expect(m.LoadedDeals).toEqual([]);
    });
});

/**
 * ONE HOLDER FOR A ROLE THAT SAYS SO — `DealRole.AllowsMultiplePerDeal = 0`.
 *
 * Raised in review on sales#147. The seed sets the flag false for Owner / AE and true for the other
 * five roles, and nothing read it. A rep "taking" a deal added a SECOND Owner / AE row and the deal
 * stayed with the first: `stampOwnerFromTeam` resolves with `find`, which returns the OLDEST match,
 * so the grid showed the new rep while every rollup still credited the old one.
 *
 * These pin the flag's enforcement rather than Owner specifically, which is how it is written.
 */
describe('a role that admits only one holder per deal', () => {
    it('refuses a second holder, and names who already has it', async () => {
        const m = member({ singleHolderRole: true, existingHolder: 'Erica Chen', IsSaved: false });
        expect(await runSave(m), 'the save must be refused').toBe(false);
        expect(m.SavedDeals, 'and the deal must not be touched').toEqual([]);
    });

    it('allows the FIRST holder — there is nobody to collide with', async () => {
        const m = member({ singleHolderRole: true, IsSaved: false });
        expect(await runSave(m)).toBe(true);
        expect(m.SavedDeals.length, 'and the owner stamp still refreshes').toBeGreaterThan(0);
    });

    it('allows a role that admits several, however many already hold it', async () => {
        const m = member({ singleHolderRole: false, existingHolder: 'Erica Chen' });
        expect(await runSave(m)).toBe(true);
    });

    it('does not refuse the EXISTING row its own seat', async () => {
        // A saved row excludes itself, or every later edit to the owner row refuses itself.
        const m = member({ singleHolderRole: true, IsSaved: true });
        expect(await runSave(m)).toBe(true);
    });
});
