import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A CUSTOMER OR CONTACT THE DATABASE DOES NOT HOLD IS REFUSED, AND THE MESSAGE SAYS WHICH CASE IT IS.
 *
 * An Organization or Person with no Sales Account / Sales Contact row is "not set up" (the Deals panel
 * on their forms pre-fills their own ID); a party whose parent is gone too was a stale pick. The ID goes
 * to the log, not the message.
 *
 * A picker read before a data reload can offer IDs that were since replaced. Saved onto a deal with no
 * order yet, such an ID reached the embedded order's bill-to first and failed there on
 * `FK_OrderHeader_BillToOrganization`, a SQL error that named neither the deal nor the customer.
 *
 * `Object.create` holds the server entity without standing up metadata, as `AbsentStatusLock` does.
 */

const LIVE_ACCOUNT = 'bbbbbbbb-0000-4000-8000-000000000001';
const GONE_ACCOUNT = 'bbbbbbbb-0000-4000-8000-00000000dead';
const LIVE_CONTACT = 'cccccccc-0000-4000-8000-000000000001';
const GONE_CONTACT = 'cccccccc-0000-4000-8000-00000000dead';
/** An Organization and a Person with no Sales Account / Sales Contact row. */
const ORG_ONLY = 'dddddddd-0000-4000-8000-000000000001';
const PERSON_ONLY = 'eeeeeeee-0000-4000-8000-000000000001';
const EXISTING = new Set([LIVE_ACCOUNT, LIVE_CONTACT]);
const PARENTS = new Set([LIVE_ACCOUNT, LIVE_CONTACT, ORG_ONLY, PERSON_ONLY]);

type ViewParams = { EntityName: string; ExtraFilter: string };
type ViewResult = { Success: boolean; Results: { ID: string }[]; ErrorMessage?: string };

type Harness = {
    missingPartyRefusal(): Promise<string | null>;
    ViewCalls: ViewParams[];
};

function deal(opts: {
    saved: boolean;
    accountID?: string | null;
    contactID?: string | null;
    dirty?: string[];
    failReads?: boolean;
    failParentReads?: boolean;
}): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const calls: ViewParams[] = [];
    const dirty = new Set(opts.dirty ?? []);
    const runViews = async (params: ViewParams[]): Promise<ViewResult[]> => {
        calls.push(...params);
        return params.map(({ EntityName, ExtraFilter }) => {
            const parent = EntityName.startsWith('MJ_BizApps_Common');
            if (parent ? opts.failParentReads : opts.failReads) {
                return { Success: false, Results: [], ErrorMessage: 'timeout' };
            }
            const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
            const found = (parent ? PARENTS : EXISTING).has(id);
            return { Success: true, Results: found ? [{ ID: id }] : [] };
        });
    };
    for (const [k, v] of Object.entries({
        IsSaved: opts.saved,
        AccountID: opts.accountID ?? null,
        PrimaryContactID: opts.contactID ?? null,
        ContextCurrentUser: { ID: 'u1' },
        GetFieldByName: (name: string) => ({ Dirty: dirty.has(name) }),
        ProviderToUse: { RunViews: runViews },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'ViewCalls', { get: () => calls });
    return instance;
}

describe('a deal save naming a customer or contact that is missing', () => {
    it('refuses a new deal whose customer is gone, without showing its ID', async () => {
        const refusal = await deal({ saved: false, accountID: GONE_ACCOUNT }).missingPartyRefusal();

        expect(refusal).toContain('customer no longer exists');
        expect(refusal).toContain('Pick it again');
        expect(refusal).toContain('Nothing was saved');
        expect(refusal).not.toContain(GONE_ACCOUNT);
    });

    it('says an organization is not set up as a sales customer, rather than asking to pick it again', async () => {
        const refusal = await deal({ saved: false, accountID: ORG_ONLY }).missingPartyRefusal();

        expect(refusal).toContain('not set up as a sales customer');
        expect(refusal).not.toContain('Pick it again');
        expect(refusal).not.toContain(ORG_ONLY);
    });

    it('says a person is not set up as a sales contact', async () => {
        const refusal = await deal({ saved: false, accountID: LIVE_ACCOUNT, contactID: PERSON_ONLY }).missingPartyRefusal();

        expect(refusal).toContain('not set up as a sales contact');
        expect(refusal).not.toContain('customer');
    });

    it('falls back to the stale-pick wording when the parent read fails', async () => {
        const refusal = await deal({ saved: false, accountID: ORG_ONLY, failParentReads: true }).missingPartyRefusal();
        expect(refusal).toContain('customer no longer exists');
    });

    it('refuses a changed primary contact that is gone', async () => {
        const d = deal({ saved: true, accountID: LIVE_ACCOUNT, contactID: GONE_CONTACT, dirty: ['PrimaryContactID'] });
        const refusal = await d.missingPartyRefusal();

        expect(refusal).toContain('primary contact');
        expect(refusal).not.toContain('customer');
    });

    it('names both when both are gone', async () => {
        const refusal = await deal({ saved: false, accountID: GONE_ACCOUNT, contactID: GONE_CONTACT }).missingPartyRefusal();

        expect(refusal).toContain('customer no longer exists');
        expect(refusal).toContain('primary contact no longer exists');
    });

    it('lets a customer and contact that exist through', async () => {
        const refusal = await deal({ saved: false, accountID: LIVE_ACCOUNT, contactID: LIVE_CONTACT }).missingPartyRefusal();
        expect(refusal).toBeNull();
    });

    it('does not read a value already on disk, which the foreign keys guarantee', async () => {
        const d = deal({ saved: true, accountID: GONE_ACCOUNT, contactID: GONE_CONTACT, dirty: ['Name'] });

        expect(await d.missingPartyRefusal()).toBeNull();
        expect(d.ViewCalls).toHaveLength(0);
    });

    it('does not refuse when the read fails, since the constraints still hold', async () => {
        const refusal = await deal({ saved: false, accountID: GONE_ACCOUNT, failReads: true }).missingPartyRefusal();
        expect(refusal).toBeNull();
    });

    it('refuses a malformed id without putting it in a filter', async () => {
        const d = deal({ saved: false, accountID: "x' OR 1=1 --" });

        expect(await d.missingPartyRefusal()).toContain('customer no longer exists');
        expect(d.ViewCalls).toHaveLength(0);
    });

    it('reads the sales account and sales contact entities', async () => {
        const d = deal({ saved: false, accountID: LIVE_ACCOUNT, contactID: LIVE_CONTACT });
        await d.missingPartyRefusal();

        expect(d.ViewCalls.map((c) => c.EntityName)).toEqual([
            'MJ_BizApps_Sales: Sales Accounts',
            'MJ_BizApps_Sales: Sales Contacts',
        ]);
    });
});
