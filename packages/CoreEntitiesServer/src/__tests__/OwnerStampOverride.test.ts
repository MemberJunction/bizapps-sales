import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A CALLER-SUPPLIED OWNER LOSES TO THE ROSTER, AND THE OVERRIDE IS REPORTED.
 *
 * This replaces a refusal. `SD26` used to assert that a hand-set `OwnerEmployeeID` failed the whole
 * save, and its comment explained why a silent correction was rejected: *"A save that quietly fixed
 * the value would produce the same surprise — the owner is not who the caller said — with nothing to
 * notice."* The objection is about NOTICING, and a warning answers it without failing the save.
 *
 * What the refusal cost, found reviewing sales#147: a deal page open since before someone used the
 * Internal team grid sends back the owner it LOADED. That differs from the row the server just read,
 * is indistinguishable from a deliberate hand-set, and refused the save — losing an unrelated edit
 * and telling the user to do the thing they had just done.
 *
 * `CompanyID` is the precedent. It is `serverMaintained` in the same field list, equally derived, and
 * `stampCompanyFromPipeline` overwrites a supplied value rather than refusing.
 */

type Harness = {
    overrideSuppliedOwnerStamp(): Promise<void>;
    OwnerStampWarnings: readonly string[];
    TeamLoads: number;
};

function deal(opts: { ownerDirty: boolean; rosterLoaded?: boolean; loadThrows?: boolean }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    let teamLoads = 0;

    for (const [k, v] of Object.entries({
        IsSaved: true,
        OwnerEmployeeID: 'employee-the-caller-named',
        ContextCurrentUser: { ID: 'u1' },
        _ownerStampWarnings: [] as string[],
        GetFieldByName: (name: string) =>
            name === 'OwnerEmployeeID' ? { Dirty: opts.ownerDirty, OldValue: null } : undefined,
        Team: {
            IsLoaded: opts.rosterLoaded ?? false,
            Count: opts.rosterLoaded ? 1 : 0,
            Items: [],
            Load: async () => {
                teamLoads += 1;
                if (opts.loadThrows) throw new Error('the roster could not be read');
                return true;
            },
        },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'TeamLoads', { get: () => teamLoads });
    return instance;
}

describe('an owner supplied without the roster', () => {
    it('loads the roster so the derivation can overwrite it', async () => {
        const d = deal({ ownerDirty: true });
        await d.overrideSuppliedOwnerStamp();
        expect(d.TeamLoads, 'the roster must be loaded, or stampOwnerFromTeam declines').toBe(1);
    });

    it('reports the override instead of refusing the save', async () => {
        const d = deal({ ownerDirty: true });
        await d.overrideSuppliedOwnerStamp();
        expect(d.OwnerStampWarnings.length, 'the override must not be silent').toBe(1);
        expect(d.OwnerStampWarnings[0]).toContain('set from the deal team');
        expect(d.OwnerStampWarnings[0]).toContain('Internal team panel');
    });

    it('says so when the roster itself could not be read', async () => {
        const d = deal({ ownerDirty: true, loadThrows: true });
        await d.overrideSuppliedOwnerStamp();
        expect(d.OwnerStampWarnings.length, 'a failed check is not a clean one').toBe(1);
        expect(d.OwnerStampWarnings[0]).toContain('could not be read');
    });
});

describe('the cases that must stay quiet', () => {
    it('does nothing when the roster is already driving the save', async () => {
        const d = deal({ ownerDirty: true, rosterLoaded: true });
        await d.overrideSuppliedOwnerStamp();
        expect(d.TeamLoads, 'already loaded — nothing to do').toBe(0);
        expect(d.OwnerStampWarnings.length, 'this is the legitimate path, not an override').toBe(0);
    });

    it('does nothing when nobody supplied an owner — the common case', async () => {
        const d = deal({ ownerDirty: false });
        await d.overrideSuppliedOwnerStamp();
        expect(d.TeamLoads).toBe(0);
        expect(d.OwnerStampWarnings.length).toBe(0);
    });
});
