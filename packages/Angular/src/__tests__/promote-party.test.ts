import { describe, expect, it } from 'vitest';
import type { BaseEntity } from '@memberjunction/core';
import {
    CreateParty,
    PROMOTIONS,
    PromoteParty,
    ProspectAccountTypeID,
    type AccountTypeFlagRow,
    type PromoteDeps,
} from '../lib/data/promote-party';

/**
 * Promoting an existing Organization or Person inserts only the IS-A subtype row. The sequence is
 * MJ's: `NewRecord()`, then `AttachToParent`, then the child's own fields, then `Save()`.
 *
 * The case worth the most here is the SECOND promotion. `AttachToParent` asks only whether the
 * PARENT exists, so it returns true for a record that is already promoted, and People and
 * Organizations allow multiple subtypes so nothing upstream refuses it. Without the pre-check the
 * save reaches the database and dies on a primary-key violation.
 */

/** A log of everything the promotion did to the child, in order, so the SEQUENCE can be asserted. */
type Call = 'NewRecord' | 'AttachToParent' | 'Save' | `Set:${string}`;

interface FakeChild {
    entity: BaseEntity;
    calls: Call[];
    attachedTo: string[];
    sets: Record<string, unknown>;
}

function fakeChild(opts: { attach?: boolean; save?: boolean; refusal?: string; throwOnAttach?: string } = {}): FakeChild {
    const calls: Call[] = [];
    const attachedTo: string[] = [];
    const sets: Record<string, unknown> = {};
    const entity = {
        NewRecord: () => {
            calls.push('NewRecord');
            return true;
        },
        AttachToParent: async (key: { KeyValuePairs: { Value: string }[] }) => {
            calls.push('AttachToParent');
            if (opts.throwOnAttach) throw new Error(opts.throwOnAttach);
            attachedTo.push(String(key.KeyValuePairs[0].Value));
            return opts.attach ?? true;
        },
        Set: (name: string, value: unknown) => {
            calls.push(`Set:${name}`);
            sets[name] = value;
        },
        Get: (name: string) => (name === 'ID' ? 'org-1' : null),
        Save: async () => {
            calls.push('Save');
            return opts.save ?? true;
        },
        LatestResult: opts.refusal ? { CompleteMessage: opts.refusal } : null,
    } as unknown as BaseEntity;
    return { entity, calls, attachedTo, sets };
}

function deps(child: FakeChild, exists: boolean | null): PromoteDeps & { reads: [string, string][] } {
    const reads: [string, string][] = [];
    return {
        reads,
        ReadPartyRow: async (entityName, id) => {
            reads.push([entityName, id]);
            return exists;
        },
        OpenChild: async () => child.entity,
    };
}

describe('PromoteParty', () => {
    it('inserts the subtype row under the parent key, in the order MJ requires', async () => {
        const child = fakeChild();
        const d = deps(child, false);
        const outcome = await PromoteParty(PROMOTIONS.Account.Child, 'org-1', { AccountTypeID: 'at-prospect' }, d);

        expect(outcome).toEqual({ Kind: 'Promoted', ID: 'org-1' });
        expect(child.attachedTo).toEqual(['org-1']);
        // NewRecord before AttachToParent before the child's own fields before Save.
        expect(child.calls).toEqual(['NewRecord', 'AttachToParent', 'Set:AccountTypeID', 'Save']);
        expect(child.sets).toEqual({ AccountTypeID: 'at-prospect' });
        expect(d.reads).toEqual([['MJ_BizApps_Sales: Sales Accounts', 'org-1']]);
    });

    it('refuses a record that is already promoted, and writes NOTHING', async () => {
        const child = fakeChild();
        const outcome = await PromoteParty(PROMOTIONS.Account.Child, 'org-1', {}, deps(child, true));

        expect(outcome).toEqual({ Kind: 'AlreadyPromoted' });
        // The whole point: no NewRecord, no Save, so no primary-key violation.
        expect(child.calls).toEqual([]);
    });

    it('refuses when the existence read FAILED, rather than risking a key violation', async () => {
        const child = fakeChild();
        const outcome = await PromoteParty(PROMOTIONS.Contact.Child, 'person-1', {}, deps(child, null));

        expect(outcome.Kind).toBe('Failed');
        expect(child.calls).toEqual([]);
    });

    it('reports a missing parent without saving', async () => {
        const child = fakeChild({ attach: false });
        const outcome = await PromoteParty(PROMOTIONS.Account.Child, 'org-404', {}, deps(child, false));

        expect(outcome).toEqual({ Kind: 'NoParent' });
        expect(child.calls).toEqual(['NewRecord', 'AttachToParent']);
    });

    it('turns a thrown AttachToParent into a refusal carrying its message', async () => {
        const child = fakeChild({ throwOnAttach: 'record is already saved' });
        const outcome = await PromoteParty(PROMOTIONS.Account.Child, 'org-1', {}, deps(child, false));

        expect(outcome).toEqual({ Kind: 'Failed', Message: 'record is already saved' });
    });

    it("passes a refused save's own message through", async () => {
        const child = fakeChild({ save: false, refusal: 'Territory is too long' });
        const outcome = await PromoteParty(PROMOTIONS.Account.Child, 'org-1', {}, deps(child, false));

        expect(outcome).toEqual({ Kind: 'Failed', Message: 'Territory is too long' });
    });

    it('does not write a field whose value is null or undefined', async () => {
        const child = fakeChild();
        await PromoteParty(
            PROMOTIONS.Account.Child,
            'org-1',
            { AccountTypeID: null, LifecycleStageTypeID: undefined, Territory: 'West' },
            deps(child, false),
        );

        // A blank Account Type must stay blank, not become an empty value (D-PR1).
        expect(child.sets).toEqual({ Territory: 'West' });
        expect(child.calls).toEqual(['NewRecord', 'AttachToParent', 'Set:Territory', 'Save']);
    });

    it('never touches the NOT NULL columns NewRecord already seeded', async () => {
        const child = fakeChild();
        await PromoteParty(PROMOTIONS.Account.Child, 'org-1', { AccountTypeID: 'at-1' }, deps(child, false));
        await PromoteParty(PROMOTIONS.Contact.Child, 'person-1', {}, deps(child, false));

        expect(Object.keys(child.sets)).not.toContain('IsActive');
        expect(Object.keys(child.sets)).not.toContain('OptedOutOfOutreach');
    });

    it('refuses an empty id without reading anything', async () => {
        const child = fakeChild();
        const d = deps(child, false);
        expect((await PromoteParty(PROMOTIONS.Account.Child, '   ', {}, d)).Kind).toBe('Failed');
        expect(d.reads).toEqual([]);
        expect(child.calls).toEqual([]);
    });

    it('promotes a Person into Sales Contacts through the same path', async () => {
        const child = fakeChild();
        const d = deps(child, false);
        const outcome = await PromoteParty(PROMOTIONS.Contact.Child, 'person-1', {}, d);

        expect(outcome.Kind).toBe('Promoted');
        expect(d.reads).toEqual([['MJ_BizApps_Sales: Sales Contacts', 'person-1']]);
        expect(child.attachedTo).toEqual(['person-1']);
    });
});

describe('ProspectAccountTypeID', () => {
    function row(over: Partial<AccountTypeFlagRow> & { ID: string }): AccountTypeFlagRow {
        return { IsProspect: false, IsActive: true, DisplayRank: 0, ...over };
    }

    it('picks the row carrying IsProspect', () => {
        const rows = [row({ ID: 'customer' }), row({ ID: 'prospect', IsProspect: true })];
        expect(ProspectAccountTypeID(rows)).toBe('prospect');
    });

    it('is decided by the FLAG, not by the name — a row named Prospect without the flag loses', () => {
        // Renaming the seeded row must not change behaviour, and must not make a namesake win.
        const rows = [
            row({ ID: 'named-prospect-but-not-flagged' }),
            row({ ID: 'target', IsProspect: true }),
        ];
        expect(ProspectAccountTypeID(rows)).toBe('target');
    });

    it('ignores an inactive prospect row', () => {
        const rows = [row({ ID: 'retired', IsProspect: true, IsActive: false })];
        expect(ProspectAccountTypeID(rows)).toBeNull();
    });

    it('returns null when nothing is flagged, so the field stays blank', () => {
        expect(ProspectAccountTypeID([row({ ID: 'customer' })])).toBeNull();
        expect(ProspectAccountTypeID([])).toBeNull();
    });

    it('is stable when a seeding error flags two rows', () => {
        const rows = [
            row({ ID: 'b-second', IsProspect: true, DisplayRank: 20 }),
            row({ ID: 'a-first', IsProspect: true, DisplayRank: 10 }),
        ];
        expect(ProspectAccountTypeID(rows)).toBe('a-first');
        expect(ProspectAccountTypeID([...rows].reverse())).toBe('a-first');
    });
});

describe('CreateParty', () => {
    it('builds the child, sets non-blank fields, and saves parent + child without AttachToParent', async () => {
        const child = fakeChild();
        const outcome = await CreateParty(
            PROMOTIONS.Account.Child,
            { Name: 'Zephyr Logistics', AccountTypeID: 'at-prospect' },
            { OpenChild: async () => child.entity },
        );

        expect(outcome).toEqual({ Kind: 'Promoted', ID: 'org-1' });
        expect(child.attachedTo).toEqual([]);
        expect(child.calls).toEqual(['NewRecord', 'Set:Name', 'Set:AccountTypeID', 'Save']);
        expect(child.sets).toEqual({ Name: 'Zephyr Logistics', AccountTypeID: 'at-prospect' });
    });

    it('skips null, undefined and whitespace-only values', async () => {
        const child = fakeChild();
        await CreateParty(
            PROMOTIONS.Contact.Child,
            { FirstName: 'Grace', LastName: 'Hopper', AccountTypeID: null, Territory: undefined, Notes: '   ' },
            { OpenChild: async () => child.entity },
        );

        expect(child.sets).toEqual({ FirstName: 'Grace', LastName: 'Hopper' });
        expect(child.calls).toEqual(['NewRecord', 'Set:FirstName', 'Set:LastName', 'Save']);
    });

    it("passes a refused save's own message through", async () => {
        const child = fakeChild({ save: false, refusal: 'LastName cannot be null' });
        const outcome = await CreateParty(
            PROMOTIONS.Contact.Child,
            { FirstName: 'Grace' },
            { OpenChild: async () => child.entity },
        );

        expect(outcome).toEqual({ Kind: 'Failed', Message: 'LastName cannot be null' });
    });

    it('reports a missing entity or a thrown save as Failed', async () => {
        const missing = await CreateParty(
            PROMOTIONS.Account.Child,
            { Name: 'Zephyr' },
            { OpenChild: async () => null },
        );
        expect(missing).toEqual({ Kind: 'Failed', Message: 'Could not open MJ_BizApps_Sales: Sales Accounts.' });

        const throwing = await CreateParty(
            PROMOTIONS.Account.Child,
            { Name: 'Zephyr' },
            {
                OpenChild: async () => {
                    throw new Error('provider offline');
                },
            },
        );
        expect(throwing).toEqual({ Kind: 'Failed', Message: 'provider offline' });
    });
});
