import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BaseEntity } from '@memberjunction/core';
import {
    MJSOrganizationPromotePanel,
    MJSPersonPromotePanel,
} from '../lib/form-panels/promote-party.panels';
import type { PromoteOutcome } from '../lib/data/promote-party';

/**
 * The promote card on Common's Organization and Person forms. It is the whole component, so what
 * matters as much as the happy path is WHEN IT DOES NOT RENDER: a record that is already a sales
 * record, and a record whose check has not answered. Offering a promotion that is not needed invites
 * the second promotion that dies on a primary-key violation.
 */

type Panel = MJSOrganizationPromotePanel | MJSPersonPromotePanel;

interface Harness<T extends Panel> {
    p: T;
    reads: [string, string][];
    promotions: [string, string, Record<string, unknown>][];
    refreshes: number;
}

function harness<T extends Panel>(
    make: () => T,
    id: string | null,
    exists: boolean | null,
    outcome: PromoteOutcome = { Kind: 'Promoted', ID: 'id-1' },
    prefill: Record<string, unknown> = { AccountTypeID: 'at-prospect' },
): Harness<T> {
    const p = make();
    const reads: [string, string][] = [];
    const promotions: [string, string, Record<string, unknown>][] = [];
    let refreshes = 0;

    Object.defineProperty(p, 'Record', {
        value: { IsSaved: !!id, Get: () => id } as unknown as BaseEntity,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(p, 'FormComponent', {
        value: {
            RefreshRecord: async () => {
                refreshes += 1;
                return true;
            },
        },
        configurable: true,
        writable: true,
    });
    Object.defineProperty(p, 'Prefill', {
        value: async () => prefill,
        configurable: true,
        writable: true,
    });

    p.ReadPartyRow = async (entity, recordID) => {
        reads.push([entity, recordID]);
        return exists;
    };
    p.Promote = async (childEntity, parentID, fields) => {
        promotions.push([childEntity, parentID, (fields ?? {}) as Record<string, unknown>]);
        return outcome;
    };
    return {
        p,
        reads,
        promotions,
        get refreshes() {
            return refreshes;
        },
    };
}

describe('the Organization promote card', () => {
    it('offers promotion on an organization that is not a sales account', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false);
        await h.p.CheckNeedsPromotion();
        expect(h.p.NeedsPromotion()).toBe(true);
        expect(h.reads).toEqual([['MJ_BizApps_Sales: Sales Accounts', 'org-1']]);
    });

    it('does NOT render on an organization that is already a sales account', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', true);
        await h.p.CheckNeedsPromotion();
        expect(h.p.NeedsPromotion()).toBe(false);
    });

    it('does NOT render while the check is unanswered, including when the read failed', async () => {
        const unknown = harness(() => new MJSOrganizationPromotePanel(), 'org-1', null);
        await unknown.p.CheckNeedsPromotion();
        // null means "could not tell" — not an invitation to promote.
        expect(unknown.p.NeedsPromotion()).toBe(false);

        const fresh = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false);
        expect(fresh.p.NeedsPromotion()).toBeNull();
    });

    it('does not read anything on an unsaved record', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), null, false);
        await h.p.CheckNeedsPromotion();
        expect(h.reads).toEqual([]);
        expect(h.p.NeedsPromotion()).toBeNull();
    });

    it('promotes with the Account Type prefill, hides itself, and refreshes the form', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false);
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();

        expect(h.promotions).toEqual([['MJ_BizApps_Sales: Sales Accounts', 'org-1', { AccountTypeID: 'at-prospect' }]]);
        expect(h.p.NeedsPromotion()).toBe(false);
        expect(h.p.Error()).toBeNull();
        // The refresh is what makes the Deals panel re-read its own gate.
        expect(h.refreshes).toBe(1);
    });

    it('treats an already-promoted answer as success, not an error', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false, { Kind: 'AlreadyPromoted' });
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();

        expect(h.p.NeedsPromotion()).toBe(false);
        expect(h.p.Error()).toBeNull();
        expect(h.refreshes).toBe(1);
    });

    it('keeps the card and shows the message when the promotion is refused', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false, {
            Kind: 'Failed',
            Message: 'Could not check whether it is already a sales record. Try again.',
        });
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();

        expect(h.p.NeedsPromotion()).toBe(true);
        expect(h.p.Error()).toBe('Could not check whether it is already a sales record. Try again.');
        expect(h.refreshes).toBe(0);
    });

    it('explains a vanished parent in its own words rather than echoing a key error', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false, { Kind: 'NoParent' });
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();
        expect(h.p.Error()).toBe('This record no longer exists. Reload the page.');
    });

    it('clears a previous refusal when the promotion is retried', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false, { Kind: 'Failed', Message: 'boom' });
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();
        expect(h.p.Error()).toBe('boom');

        h.p.Promote = async () => ({ Kind: 'Promoted', ID: 'org-1' });
        await h.p.RunPromotion();
        expect(h.p.Error()).toBeNull();
        expect(h.p.NeedsPromotion()).toBe(false);
    });

    it('does not promote twice while a promotion is in flight', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false);
        await h.p.CheckNeedsPromotion();
        h.p.Busy.set(true);
        await h.p.RunPromotion();
        expect(h.promotions).toEqual([]);
    });

    it('re-asks the gate when the form refreshes, because the record ID does not change on promotion', async () => {
        const h = harness(() => new MJSOrganizationPromotePanel(), 'org-1', false);
        await h.p.CheckNeedsPromotion();
        expect(h.reads).toHaveLength(1);

        h.p.OnRecordRefreshed({} as unknown as BaseEntity);
        await h.p.CheckNeedsPromotion();
        expect(h.reads).toHaveLength(2);
    });
});

describe('the Person promote card', () => {
    it('promotes a person into Sales Contacts and sets NO defaults', async () => {
        const h = harness(() => new MJSPersonPromotePanel(), 'person-1', false, { Kind: 'Promoted', ID: 'person-1' }, {});
        await h.p.CheckNeedsPromotion();
        await h.p.RunPromotion();

        expect(h.reads).toEqual([['MJ_BizApps_Sales: Sales Contacts', 'person-1']]);
        expect(h.promotions).toEqual([['MJ_BizApps_Sales: Sales Contacts', 'person-1', {}]]);
    });
});

describe('the promote card markup', () => {
    const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../lib/form-panels/promote-party.panels.ts'),
        'utf8',
    );

    it('names the selectors the harness drives', () => {
        for (const id of ['promote-card', 'promote-confirm', 'promote-error']) {
            expect(source).toContain(`data-testid="${id}"`);
        }
    });

    it('renders the card only when a promotion is needed', () => {
        expect(source).toContain('@if (NeedsPromotion() === true)');
    });

    it('says the parent is not changed, because that is the question a rep would ask', () => {
        expect(source).toContain('is not changed');
    });

    it('uses only semantic tokens for colour', () => {
        const colours = source.match(/(?:background|color|border):[^;]*;/g) ?? [];
        expect(colours.length).toBeGreaterThan(0);
        for (const rule of colours) {
            expect(rule).toMatch(/var\(--mj-/);
        }
    });
});

describe('the deal form offers the promote route wherever it draws a party field', () => {
    const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../lib/form-panels/deal-form.panels.ts'),
        'utf8',
    );

    /**
     * THE DEAL FORM DRAWS PARTY FIELDS FROM TWO PANELS, and the one that leads on a NEW deal is not
     * the one named "party": `MJSDealPipelinePanel` carries `leadsWhenUnsaved: true`, while
     * `MJSDealPartyPanel` deliberately drops the creation party fields while the deal is unsaved.
     * The first version of this feature put the promote link only on the latter, so it was invisible
     * in the exact place a rep hits the problem — creating a deal for a company that is not an
     * account yet.
     *
     * Pairing the counts rather than asserting "two" states the requirement instead of today's
     * layout: a third render site added later fails this until it carries the affordance too.
     */
    it('pairs every party-field render site with a promote link', () => {
        const pickers = (source.match(/<bizapps-party-field/g) ?? []).length;
        const links = (source.match(/class="mjs-promote-link"/g) ?? []).length;
        expect(pickers).toBeGreaterThan(1);
        expect(links).toBe(pickers);
    });

    it('mounts the dialog in every panel that imports the party field', () => {
        const importsParty = (source.match(/PartyFieldComponent\]/g) ?? []).length
            + (source.match(/PartyFieldComponent, MJSPromotePartyDialog\]/g) ?? []).length;
        const mounts = (source.match(/<mjs-promote-party-dialog/g) ?? []).length;
        expect(mounts).toBe(importsParty);
    });

    it('keys the promote affordance on the field\'s party Kind, never on its name', () => {
        // A fourth party field added to the spec list must get the affordance without this changing.
        expect(source).toContain("f.party.Kind === 'Organization' ? 'account' : 'contact'");
        expect(source).not.toMatch(/PromotableFieldKind[\s\S]{0,200}f\.name === 'AccountID'/);
    });
});
