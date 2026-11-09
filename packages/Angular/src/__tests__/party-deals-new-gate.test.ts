import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BaseEntity } from '@memberjunction/core';
import { MJSOrganizationDealsPanel, MJSPersonDealsPanel } from '../lib/form-panels/party-deals.panels';

/**
 * The Deals panel on an Organization or Person offers New only when that record is a Sales Account or
 * Sales Contact. New pre-fills the record's own ID, and the server refuses a deal whose customer or
 * contact has no sales row, so offering it elsewhere led the rep into a deal that could not be saved.
 */

function panel<T extends MJSOrganizationDealsPanel | MJSPersonDealsPanel>(
    make: () => T,
    id: string | null,
    answer: boolean | null,
): { p: T; reads: [string, string][] } {
    const p = make();
    const reads: [string, string][] = [];
    Object.defineProperty(p, 'Record', {
        value: { IsSaved: !!id, Get: () => id } as unknown as BaseEntity,
        configurable: true,
        writable: true,
    });
    p.ReadPartyRow = async (entity, recordID) => {
        reads.push([entity, recordID]);
        return answer;
    };
    return { p, reads };
}

describe('the Organization Deals panel', () => {
    it('offers New on a Sales Account, reading the Sales Accounts entity by the organization ID', async () => {
        const { p, reads } = panel(() => new MJSOrganizationDealsPanel(), 'org-1', true);
        await p.CheckSalesParty();
        expect(p.CanCreateDeal()).toBe(true);
        expect(reads).toEqual([['MJ_BizApps_Sales: Sales Accounts', 'org-1']]);
    });

    it('hides New on an organization that is not a Sales Account', async () => {
        const { p } = panel(() => new MJSOrganizationDealsPanel(), 'org-1', false);
        await p.CheckSalesParty();
        expect(p.CanCreateDeal()).toBe(false);
    });

    it('leaves New shown when the read fails; the server refusal names the case', async () => {
        const { p } = panel(() => new MJSOrganizationDealsPanel(), 'org-1', null);
        await p.CheckSalesParty();
        expect(p.CanCreateDeal()).toBe(true);
    });

    it('reads once per record', async () => {
        const { p, reads } = panel(() => new MJSOrganizationDealsPanel(), 'org-1', true);
        await p.CheckSalesParty();
        p.ngDoCheck();
        await p.CheckSalesParty();
        expect(reads).toHaveLength(1);
    });

    it('does not read for an unsaved record', async () => {
        const { p, reads } = panel(() => new MJSOrganizationDealsPanel(), null, true);
        await p.CheckSalesParty();
        expect(reads).toHaveLength(0);
        expect(p.CanCreateDeal()).toBeNull();
    });
});

describe('the Person Deals panel', () => {
    it('reads the Sales Contacts entity and hides New on a person who is not a Sales Contact', async () => {
        const { p, reads } = panel(() => new MJSPersonDealsPanel(), 'person-1', false);
        await p.CheckSalesParty();
        expect(p.CanCreateDeal()).toBe(false);
        expect(reads).toEqual([['MJ_BizApps_Sales: Sales Contacts', 'person-1']]);
    });
});

describe('the template', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const SOURCE = readFileSync(join(HERE, '..', 'lib', 'form-panels', 'party-deals.panels.ts'), 'utf8');

    it('binds New to the gate on both panels', () => {
        expect(SOURCE.match(/\[ShowNewButton\]="CanCreateDeal\(\) === true"/g)).toHaveLength(2);
    });

    it('says why New is missing', () => {
        expect(SOURCE).toContain('Not a sales customer. Add it as an account to create deals.');
        expect(SOURCE).toContain('Not a sales contact. Add them as a contact to create deals.');
    });
});
