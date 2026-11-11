import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import {
    MJSPromotePartyDialog,
    PROMOTE_KINDS,
    type PromotableRow,
} from '../lib/form-panels/promote-party-dialog.component';
import type { PromoteOutcome } from '../lib/data/promote-party';

/**
 * The promote dialog. It exists because common's `bizapps-party-field` cannot mark a row
 * unselectable, so a promotable Organization must never reach the deal's account picker — the rows
 * live in their own queries and are only shown here, where choosing one promotes it.
 *
 * The cases that matter most are the ones where it must NOT emit `Promoted`: a refused promotion and
 * a parent that vanished. A surface that trusts a premature `Promoted` would store an ID with no
 * sales row behind it, which is the failure the separate queries are there to avoid.
 */

interface Harness {
    d: MJSPromotePartyDialog;
    searches: [string, string, string | null][];
    promotions: [string, string, Record<string, unknown>][];
    promoted: string[];
    closed: number;
}

const ROW: PromotableRow = { ID: 'org-9', Name: 'Harbor Yacht Club', Detail: 'HYC · harbor.example' };

function harness(
    kind: 'Account' | 'Contact' = 'Account',
    rows: readonly PromotableRow[] = [ROW],
    outcome: PromoteOutcome = { Kind: 'Promoted', ID: 'org-9' },
    prefill: Record<string, unknown> = { AccountTypeID: 'at-prospect' },
): Harness {
    const d = new MJSPromotePartyDialog();
    d.PromoteKind = kind;
    const searches: [string, string, string | null][] = [];
    const promotions: [string, string, Record<string, unknown>][] = [];
    const promoted: string[] = [];
    let closed = 0;

    d.Search = async (queryName, term, domain) => {
        searches.push([queryName, term, domain]);
        return rows;
    };
    d.Promote = async (childEntity, parentID, fields) => {
        promotions.push([childEntity, parentID, (fields ?? {}) as Record<string, unknown>]);
        return outcome;
    };
    // The prefill lives on the kind config; override it for the duration of the test.
    PROMOTE_KINDS[kind].Prefill = async () => prefill;
    d.Promoted.subscribe((id) => promoted.push(id));
    d.Closed.subscribe(() => (closed += 1));

    return {
        d,
        searches,
        promotions,
        promoted,
        get closed() {
            return closed;
        },
    };
}

describe('the promote dialog search', () => {
    it('sends nothing under two characters, and says so', () => {
        const h = harness();
        h.d.OnTermChange('a');
        expect(h.d.Params()).toBeNull();
        expect(h.d.Rows()).toEqual([]);
        expect(h.searches).toEqual([]);
    });

    it('reads the promotable query — the complement of the picker, not the picker', async () => {
        const h = harness();
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();

        expect(h.searches).toEqual([['Sales: Party Lookup Promotable Accounts', 'harbor', null]]);
        expect(h.d.Rows()).toEqual([ROW]);
    });

    it('derives the domain exactly as common does, rather than reimplementing it', async () => {
        const h = harness();
        h.d.OnTermChange('https://www.harbor.example/about');
        await h.d.RunSearch();

        const [, , domain] = h.searches[0];
        expect(domain).toBe('harbor.example');
    });

    it('searches people through the contacts complement', async () => {
        const h = harness('Contact');
        h.d.OnTermChange('grace');
        await h.d.RunSearch();
        expect(h.searches[0][0]).toBe('Sales: Party Lookup Promotable Contacts');
    });

    it('does not search on the keystroke itself — it debounces', () => {
        const h = harness();
        h.d.OnTermChange('harbor');
        expect(h.searches).toEqual([]);
        expect(h.d.Searching()).toBe(true);
    });

    it('discards a search that lands after a newer one', async () => {
        const h = harness();
        let release: (() => void) | null = null;
        h.d.Search = async (_q, term) => {
            if (term === 'slow') {
                await new Promise<void>((r) => (release = r));
                return [{ ID: 'stale', Name: 'Stale', Detail: null }];
            }
            return [ROW];
        };
        h.d.OnTermChange('slow');
        const slow = h.d.RunSearch();
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        release?.();
        await slow;

        expect(h.d.Rows()).toEqual([ROW]);
    });

    it('reports a failed search without pretending there were no matches', async () => {
        const h = harness();
        h.d.Search = async () => {
            throw new Error('network down');
        };
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();

        expect(h.d.Rows()).toEqual([]);
        expect(h.d.Error()).toBe('The search failed. Try again.');
    });
});

describe('the promote dialog promotion', () => {
    async function ready(h: Harness): Promise<void> {
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        h.d.Choose(ROW);
    }

    it('promotes the chosen row with the prefill, then reports the ID and closes', async () => {
        const h = harness();
        await ready(h);
        await h.d.Confirm();

        expect(h.promotions).toEqual([['MJ_BizApps_Sales: Sales Accounts', 'org-9', { AccountTypeID: 'at-prospect' }]]);
        expect(h.promoted).toEqual(['org-9']);
        expect(h.closed).toBe(1);
    });

    it('does nothing when no row is chosen', async () => {
        const h = harness();
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        await h.d.Confirm();
        expect(h.promotions).toEqual([]);
        expect(h.promoted).toEqual([]);
    });

    it('treats an already-promoted row as success, reporting the row it picked', async () => {
        const h = harness('Account', [ROW], { Kind: 'AlreadyPromoted' });
        await ready(h);
        await h.d.Confirm();
        expect(h.promoted).toEqual(['org-9']);
        expect(h.closed).toBe(1);
    });

    it('does NOT report a promotion that was refused', async () => {
        const h = harness('Account', [ROW], { Kind: 'Failed', Message: 'Territory is too long' });
        await ready(h);
        await h.d.Confirm();

        expect(h.promoted).toEqual([]);
        expect(h.closed).toBe(0);
        expect(h.d.Error()).toBe('Territory is too long');
    });

    it('drops a vanished row from the list and reports nothing', async () => {
        const h = harness('Account', [ROW], { Kind: 'NoParent' });
        await ready(h);
        await h.d.Confirm();

        expect(h.promoted).toEqual([]);
        expect(h.d.Rows()).toEqual([]);
        expect(h.d.Selected()).toBeNull();
        expect(h.d.Error()).toBe('That record no longer exists. Search again.');
    });

    it('cannot be cancelled or escaped while a promotion is in flight', async () => {
        const h = harness();
        await ready(h);
        h.d.Busy.set(true);

        h.d.Cancel();
        h.d.OnEscape(new Event('keydown'));
        expect(h.closed).toBe(0);

        await h.d.Confirm();
        expect(h.promotions).toEqual([]);
    });

    it('closes on cancel when idle', () => {
        const h = harness();
        h.d.Cancel();
        expect(h.closed).toBe(1);
        expect(h.promoted).toEqual([]);
    });

    it('clears the chosen row when the term changes, so a stale pick cannot be promoted', async () => {
        const h = harness();
        await ready(h);
        expect(h.d.Selected()).toEqual(ROW);
        h.d.OnTermChange('different');
        expect(h.d.Selected()).toBeNull();
    });
});
