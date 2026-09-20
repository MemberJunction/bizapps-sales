import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A NEW DEAL WAS ALWAYS BORN UNOWNED.
 *
 * Nothing populated `DealTeamMember` — not the deal type, not the pipeline, not the account — so
 * `stampOwnerFromTeam()` had nothing to derive from and the Overview reported "No owner assigned." on
 * a deal created seconds earlier. The form's team panel is gated on the deal being saved, so at the
 * moment of creation there was no way to supply one either.
 *
 * The default is the ACCOUNT's owner when it has one, else whoever is creating the deal: a deal on an
 * existing customer belongs to whoever runs that customer, whether a rep, an SE or an admin typed it
 * in. The creator is the fallback, not the first answer.
 *
 * `Object.create` holds the server entity without standing up metadata, the way `StatusReadFailure`
 * does. Only what `seedOwnerOnCreate` touches is shadowed.
 */

const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000001';
const ACCOUNT_OWNER = 'bbbbbbbb-0000-4000-8000-000000000002';
const CREATOR = 'cccccccc-0000-4000-8000-000000000003';

type Opts = {
    IsSaved?: boolean;
    RosterDrives?: boolean;
    AccountID?: string | null;
    /** What the account row returns. `undefined` means the READ FAILED. */
    accountOwner?: string | null;
    creatorEmployee?: string | null;
    readSucceeds?: boolean;
};

function deal(opts: Opts) {
    const setOwnerCalls: (string | null)[] = [];
    const views: string[] = [];

    const instance = Object.create(DealEntityServer.prototype) as {
        seedOwnerOnCreate(): Promise<void>;
        SetOwnerCalls: (string | null)[];
        Views: string[];
    };

    Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved ?? false, writable: true });
    Object.defineProperty(instance, 'AccountID', { value: opts.AccountID ?? null, writable: true });
    Object.defineProperty(instance, 'RosterDrivesThisSave', { get: () => opts.RosterDrives ?? false });
    Object.defineProperty(instance, 'ContextCurrentUser', {
        value: { EmployeeID: opts.creatorEmployee === undefined ? CREATOR : opts.creatorEmployee },
        writable: true,
    });
    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            RunView: async (params: { EntityName: string }) => {
                views.push(params.EntityName);
                if (opts.readSucceeds === false) {
                    return { Success: false, ErrorMessage: 'boom', Results: [] };
                }
                return {
                    Success: true,
                    Results: opts.accountOwner === undefined ? [] : [{ OwnerEmployeeID: opts.accountOwner }],
                };
            },
        },
        writable: true,
    });
    Object.defineProperty(instance, 'SetOwner', {
        value: async (id: string | null) => { setOwnerCalls.push(id); },
        writable: true,
    });

    Object.defineProperty(instance, 'SetOwnerCalls', { get: () => setOwnerCalls });
    Object.defineProperty(instance, 'Views', { get: () => views });
    return instance;
}

describe('the owner a new deal is born with', () => {
    it('takes the account owner when the account has one', async () => {
        const d = deal({ AccountID: ACCOUNT, accountOwner: ACCOUNT_OWNER });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([ACCOUNT_OWNER]);
    });

    /**
     * The account beats the creator even though both are available. Whoever runs the customer owns the
     * deal; the person at the keyboard may be an admin entering it on their behalf.
     */
    it('prefers the account owner over the creator', async () => {
        const d = deal({ AccountID: ACCOUNT, accountOwner: ACCOUNT_OWNER, creatorEmployee: CREATOR });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([ACCOUNT_OWNER]);
    });

    it('falls back to the creator when the account has no owner', async () => {
        const d = deal({ AccountID: ACCOUNT, accountOwner: null });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([CREATOR]);
    });

    it('falls back to the creator when there is no account at all', async () => {
        const d = deal({ AccountID: null });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([CREATOR]);
        expect(d.Views, 'no account means no reason to read one').toEqual([]);
    });
});

describe('every way it declines to act', () => {
    it('does nothing on an update — a default belongs to birth', async () => {
        const d = deal({ IsSaved: true, AccountID: ACCOUNT, accountOwner: ACCOUNT_OWNER });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([]);
    });

    /**
     * The same guard `stampOwnerFromTeam` uses, so the two cannot disagree about what "the caller is
     * managing the team" means. An importer that sets its own roster is never second-guessed.
     */
    it('does nothing when the caller already supplied a roster', async () => {
        const d = deal({ RosterDrives: true, AccountID: ACCOUNT, accountOwner: ACCOUNT_OWNER });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([]);
    });

    /** `System` and `Anonymous` have no linked Employee. An unowned deal is what happens today. */
    it('leaves the deal unowned when nothing resolves', async () => {
        const d = deal({ AccountID: null, creatorEmployee: null });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([]);
    });

    /**
     * A FAILED READ IS NOT A FAILED SAVE. RunView does not throw, and refusing a create because the
     * account could not be read would cost someone the deal they were entering.
     */
    it('falls back rather than failing when the account cannot be read', async () => {
        const d = deal({ AccountID: ACCOUNT, readSucceeds: false });
        await expect(d.seedOwnerOnCreate()).resolves.toBeUndefined();
        expect(d.SetOwnerCalls).toEqual([CREATOR]);
    });

    /**
     * A malformed id RETURNS rather than throwing, unlike the veto's `SafeID`. There the ids come from
     * Orders and stopping is right; here it is our own field on a deal somebody is creating.
     */
    it('skips the lookup on an id that is not a record id, without throwing', async () => {
        const d = deal({ AccountID: "not-an-id' OR 1=1--", accountOwner: ACCOUNT_OWNER });
        await expect(d.seedOwnerOnCreate()).resolves.toBeUndefined();
        expect(d.Views, 'a malformed id must never reach a filter string').toEqual([]);
        expect(d.SetOwnerCalls).toEqual([CREATOR]);
    });

    /**
     * `UserInfo.EmployeeID` is typed `number` in @memberjunction/core, but the column is a
     * uniqueidentifier — verified against the database. A numeric value is therefore a stale type
     * leaking through, not an employee id, and must not be written into a foreign key.
     */
    it('ignores a non-string employee id rather than writing it to a foreign key', async () => {
        const d = deal({ AccountID: null, creatorEmployee: 42 as unknown as string });
        await d.seedOwnerOnCreate();
        expect(d.SetOwnerCalls).toEqual([]);
    });
});

/**
 * A MISSING OWNER ROLE MUST NOT COST SOMEONE A DEAL.
 *
 * `ResolveOwnerRoleID` throws when no active `DealRole` carries `IsOwnerRole` — correct when someone
 * deliberately assigns an owner, since silently doing nothing would be worse. But this default is one
 * nobody asked for, and letting it throw would mean a deployment that had not seeded that role could no
 * longer create deals at all. A default that breaks creation is worse than no default.
 */
describe('when the owner role is not seeded', () => {
    it('saves the deal anyway rather than failing the create', async () => {
        const d = deal({ AccountID: null });
        Object.defineProperty(d, 'SetOwner', {
            value: async () => { throw new Error('no active DealRole has IsOwnerRole = 1'); },
            writable: true,
        });
        await expect(d.seedOwnerOnCreate()).resolves.toBeUndefined();
    });
});
