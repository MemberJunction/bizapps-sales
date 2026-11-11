import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const ROW: PromotableRow = { ID: 'org-9', Name: 'Harbor Yacht Club', Detail: 'HYC · harbor.example', IsSalesParty: false };
const EXISTING: PromotableRow = { ID: 'org-1', Name: 'Cascade Manufacturing', Detail: null, IsSalesParty: true };

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
        return queryName.includes('Promotable') ? rows : [];
    };
    d.Promote = async (childEntity, parentID, fields) => {
        promotions.push([childEntity, parentID, (fields ?? {}) as Record<string, unknown>]);
        return outcome;
    };
    // The prefill lives on the kind config; override it for the duration of the test.
    PROMOTE_KINDS[kind].Prefill = async () => prefill;
    d.PartyChosen.subscribe((id) => promoted.push(id));
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

        expect(h.searches.map((x) => x[0]).sort()).toEqual([
            'Sales: Party Lookup Accounts',
            'Sales: Party Lookup Promotable Accounts',
        ]);
        expect(h.d.Rows()).toEqual([ROW]);
    });

    it('derives the domain exactly as common does, rather than reimplementing it', async () => {
        const h = harness();
        h.d.OnTermChange('https://www.harbor.example/about');
        await h.d.RunSearch();

        for (const [, , domain] of h.searches) expect(domain).toBe('harbor.example');
    });

    it('searches people through the contacts complement', async () => {
        const h = harness('Contact');
        h.d.OnTermChange('grace');
        await h.d.RunSearch();
        expect(h.searches.map((x) => x[0])).toContain('Sales: Party Lookup Promotable Contacts');
        expect(h.searches.map((x) => x[0])).toContain('Sales: Party Lookup Contacts');
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
        h.d.Search = async (q, term) => {
            if (!q.includes('Promotable')) return [];
            if (term === 'slow') {
                await new Promise<void>((r) => (release = r));
                return [{ ID: 'stale', Name: 'Stale', Detail: null, IsSalesParty: false }];
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
        expect(h.d.Error()).toMatch(/could not be loaded/);
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

describe('the dialog shows both halves in one list', () => {
    function withBoth(): Harness {
        const h = harness();
        h.d.Search = async (q, term, domain) => {
            h.searches.push([q, term, domain]);
            return q.includes('Promotable') ? [ROW] : [EXISTING];
        };
        return h;
    }

    it('merges existing and promotable rows, flagged and sorted by name', async () => {
        const h = withBoth();
        h.d.OnTermChange('a');
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();

        // PL7/PL8 assert the two queries partition the set, so the union needs no de-duplication.
        expect(h.d.Rows().map((r) => [r.Name, r.IsSalesParty])).toEqual([
            ['Cascade Manufacturing', true],
            ['Harbor Yacht Club', false],
        ]);
    });

    it('SELECTS an existing sales account outright, writing nothing', async () => {
        const h = withBoth();
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        h.d.Choose(h.d.Rows().find((r) => r.IsSalesParty)!);

        expect(h.d.ConfirmLabel()).toBe('Select');
        await h.d.Confirm();
        // No promotion: a second promotion is exactly what PromoteParty refuses.
        expect(h.promotions).toEqual([]);
        expect(h.promoted).toEqual(['org-1']);
        expect(h.closed).toBe(1);
    });

    it('still promotes a row that has no sales account', async () => {
        const h = withBoth();
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        h.d.Choose(h.d.Rows().find((r) => !r.IsSalesParty)!);

        expect(h.d.ConfirmLabel()).toBe('Promote to Sales Account');
        await h.d.Confirm();
        expect(h.promotions).toHaveLength(1);
        expect(h.promoted).toEqual(['org-9']);
    });
});

describe('creating one that does not exist at all', () => {
    it('is offered only after a search has found nothing', async () => {
        const h = harness('Account', []);
        expect(h.d.CanOfferCreate()).toBe(false);      // nothing typed
        h.d.OnTermChange('zzz');
        expect(h.d.CanOfferCreate()).toBe(false);      // still searching
        await h.d.RunSearch();
        expect(h.d.CanOfferCreate()).toBe(true);
    });

    it('creates an account named from the SEARCH TERM — no second field to fill', async () => {
        const h = harness('Account', []);
        const created: [string, Record<string, unknown>][] = [];
        h.d.Create = async (entity, fields) => {
            created.push([entity, fields as Record<string, unknown>]);
            return { Kind: 'Promoted', ID: 'new-1' };
        };
        h.d.OnTermChange('  Zephyr Logistics  ');
        await h.d.RunSearch();
        expect(h.d.CanCreate()).toBe(true);
        await h.d.CreateNew();

        expect(created[0][0]).toBe('MJ_BizApps_Sales: Sales Accounts');
        expect(created[0][1]).toMatchObject({ Name: 'Zephyr Logistics', AccountTypeID: 'at-prospect' });
        expect(h.promoted).toEqual(['new-1']);
        expect(h.closed).toBe(1);
    });

    it('splits a person on the FIRST space, keeping a compound surname whole', async () => {
        const h = harness('Contact', []);
        const created: Record<string, unknown>[] = [];
        h.d.Create = async (_e, fields) => {
            created.push(fields as Record<string, unknown>);
            return { Kind: 'Promoted', ID: 'p-1' };
        };
        h.d.OnTermChange('Juan Carlos de la Cruz');
        await h.d.RunSearch();
        await h.d.CreateNew();

        expect(created[0]).toMatchObject({ FirstName: 'Juan', LastName: 'Carlos de la Cruz' });
        // Never written: it is a persisted computed column on Person.
        expect(Object.keys(created[0])).not.toContain('DisplayName');
    });

    it('refuses a one-word person rather than inventing a last name', async () => {
        const h = harness('Contact', []);
        h.d.OnTermChange('Grace');
        await h.d.RunSearch();
        expect(h.d.NewPersonName()).toBeNull();
        expect(h.d.CanCreate()).toBe(false);
        expect(h.d.CreateBlockedReason()).toMatch(/first and last name/i);

        h.d.OnTermChange('Grace Hopper');
        await h.d.RunSearch();
        expect(h.d.NewPersonName()).toEqual({ First: 'Grace', Last: 'Hopper' });
        expect(h.d.CanCreate()).toBe(true);
        expect(h.d.CreateBlockedReason()).toBeNull();
    });

    it('does not offer an account create while results are on screen', async () => {
        const h = harness('Account', [ROW]);
        h.d.OnTermChange('harbor');
        await h.d.RunSearch();
        expect(h.d.CanOfferCreate()).toBe(false);
        expect(h.d.CanCreate()).toBe(false);
    });

    it('keeps the dialog open and shows why when the create is refused', async () => {
        const h = harness('Account', []);
        h.d.Create = async () => ({ Kind: 'Failed', Message: 'Name is already taken' });
        h.d.OnTermChange('zzz');
        await h.d.RunSearch();
        await h.d.CreateNew();
        expect(h.promoted).toEqual([]);
        expect(h.closed).toBe(0);
        expect(h.d.Error()).toBe('Name is already taken');
    });
});

describe('the dialog keeps one height', () => {
    const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../lib/form-panels/promote-party-dialog.component.ts'),
        'utf8',
    );

    /**
     * The body used to size to its contents, so the dialog jumped as results arrived, emptied, or
     * gave way to the create block -- while the pointer was already moving toward a row. Pinning the
     * body is what turns that into whitespace, so it is pinned here too: a later edit that makes the
     * height elastic again fails this rather than being noticed by whoever clicks the wrong row.
     */
    it('pins the body height and scrolls inside it', () => {
        const body = source.match(/\.mjs-pp__body \{[^}]*\}/)?.[0] ?? '';
        expect(body).toMatch(/height:\s*min\(260px/);
        expect(body).toMatch(/overflow-y:\s*auto/);
        expect(body).not.toMatch(/max-height:\s*none/);
    });

    it('keeps the footer out of the scrolling area', () => {
        // The confirm button must not move with the results; it lives outside the body.
        const bodyIdx = source.indexOf('class="mjs-pp__body"');
        const footIdx = source.indexOf('class="mjs-pp__foot"');
        expect(bodyIdx).toBeGreaterThan(-1);
        expect(footIdx).toBeGreaterThan(bodyIdx);
        expect(source.slice(bodyIdx, footIdx)).toContain('</div>');
    });
});
