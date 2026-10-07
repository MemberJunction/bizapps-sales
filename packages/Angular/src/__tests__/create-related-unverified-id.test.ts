import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { DealWorkspaceComponent } from '../lib/workspace/deal-workspace.component';

/**
 * AN INLINE-CREATED CUSTOMER IS BOUND ONLY UNDER AN ID SHOWN TO EXIST.
 *
 * The slide-in has been measured reporting an id it never wrote (DECISIONS-NEEDED.md DN-19, the
 * "INTERMITTENT" entry). When the lookup reload also missed the new row, the workspace minted an option
 * from that id and bound it, and the deal's first save failed inside its order on
 * `FK_OrderHeader_BillToOrganization`.
 *
 * Built with `Object.create` rather than TestBed: the subject is the binding decision, and the
 * slide-in, the service and the failure banner are all stand-ins for it.
 */

const REPORTED = 'aaaaaaaa-0000-4000-8000-000000000001';
const WRITTEN = 'BBBBBBBB-0000-4000-8000-000000000002';
const OLDER = 'CCCCCCCC-0000-4000-8000-000000000003';

type Lookup = { ID: string; Name: string };

function workspace(opts: {
    reloads: Lookup[][];
    exists: boolean | null;
    name?: string;
    /** The child's own key; defaults to REPORTED, the state once MJ sends the key on create. */
    primaryKey?: string;
}) {
    const deal = { AccountID: null as string | null, PrimaryContactID: null as string | null };
    const failures: string[] = [];
    const existsCalls: string[] = [];
    const reloads = [...opts.reloads];
    const created = {
        Get: (f: string) => ({ ID: REPORTED, Name: opts.name ?? 'Example Co' })[f] ?? null,
        PrimaryKey: { GetValueByFieldName: (f: string) => (f === 'ID' ? (opts.primaryKey ?? REPORTED) : null) },
    };

    const c = Object.create(DealWorkspaceComponent.prototype) as {
        CreateRelated(entityName: string, target: 'AccountID'): Promise<void>;
        Lookups: { Accounts: Lookup[]; Contacts: Lookup[] };
    };
    const props: Record<string, unknown> = {
        Deal: deal,
        Lookups: { Accounts: [], Contacts: [] },
        IsFieldEditable: () => true,
        Fail: (m: string) => failures.push(m),
        Touch: () => undefined,
        forms: { Open: () => ({ AfterSaved: async () => created }) },
        service: {
            LoadLookups: async () => ({ Accounts: reloads.shift() ?? [], Contacts: [] }),
            RecordExists: async (_entity: string, id: string) => {
                existsCalls.push(id);
                return opts.exists;
            },
        },
    };
    for (const [k, v] of Object.entries(props)) {
        Object.defineProperty(c, k, { value: v, writable: true });
    }
    return { c, deal, failures, existsCalls };
}

const ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';

describe('binding a customer created from the deal workspace', () => {
    it('binds the lookup option when the reload carries the id, without a server read', async () => {
        const w = workspace({ reloads: [[{ ID: REPORTED.toUpperCase(), Name: 'Example Co' }]], exists: true });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBe(REPORTED.toUpperCase());
        expect(w.existsCalls).toHaveLength(0);
    });

    it('binds a synthetic option when the server confirms the id the reload missed', async () => {
        const w = workspace({ reloads: [[]], exists: true });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBe(REPORTED);
        expect(w.c.Lookups.Accounts.map((o) => o.ID)).toEqual([REPORTED]);
        expect(w.failures).toHaveLength(0);
    });

    it('never binds the reported id when the server says it was not written', async () => {
        // The failure this exists for: the reload missed the row AND the reported id is the unwritten one.
        const w = workspace({ reloads: [[], [{ ID: WRITTEN, Name: 'Example Co' }]], exists: false });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBe(WRITTEN);
        expect(w.c.Lookups.Accounts.some((o) => o.ID === REPORTED)).toBe(false);
    });

    it('binds nothing and says so when the unwritten id has no row by name', async () => {
        const w = workspace({ reloads: [[], []], exists: false });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBeNull();
        expect(w.failures[0]).toContain('could not be found');
    });

    it('binds nothing when two rows share the name', async () => {
        const twins = [{ ID: WRITTEN, Name: 'Example Co' }, { ID: OLDER, Name: 'Example Co' }];
        const w = workspace({ reloads: [[], twins], exists: false });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBeNull();
        expect(w.failures[0]).toContain('More than one customer');
    });

    it('binds nothing when the existence read fails', async () => {
        const w = workspace({ reloads: [[]], exists: null });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBeNull();
        expect(w.failures[0]).toContain('could not be confirmed');
    });

    it('binds the key the child carries, not the parent key Get(ID) reads (issue #188)', async () => {
        // MJ 6.1.x: Get('ID') reads the parent's never-written key; PrimaryKey holds the written one.
        const w = workspace({ reloads: [[{ ID: WRITTEN, Name: 'Example Co' }]], exists: false, primaryKey: WRITTEN });
        await w.c.CreateRelated(ACCOUNT, 'AccountID');

        expect(w.deal.AccountID).toBe(WRITTEN);
        expect(w.existsCalls).toHaveLength(0);
        expect(w.failures).toHaveLength(0);
    });
});
