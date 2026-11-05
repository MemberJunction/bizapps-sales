import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BuildLeftNavSections, DEALS_SUB_PAGES, PrimaryActionFor, SecondaryActionFor } from '../lib/nav/sales-nav.model';

/**
 * SALES COULD NOT REACH ITS OWN ACCOUNTS OR CONTACTS.
 *
 * The app's only section was Deals, so a Sales Account or Contact could be opened from a deal but not
 * listed or created anywhere in the app. Accounts and Contacts are now rail pages, each with its own
 * create action, and the dashboard offers New account beside New deal.
 */

const template = readFileSync(new URL('../lib/sections/sales-section.component.html', import.meta.url), 'utf8');
const component = readFileSync(new URL('../lib/sections/sales-section.component.ts', import.meta.url), 'utf8');

describe('the Customers rail group', () => {
    it('lists Accounts and Contacts under Customers, after the deal pages', () => {
        const sections = BuildLeftNavSections(DEALS_SUB_PAGES);
        const customers = sections.find((s) => s.label === 'Customers');
        expect(customers?.items.map((i) => i.id)).toEqual(['accounts', 'contacts']);
        expect(sections.at(-1)).toBe(customers);
    });

    it('gives each page a create action for its own entity', () => {
        expect(PrimaryActionFor('accounts')).toMatchObject({ Label: 'New account', Creates: 'account' });
        expect(PrimaryActionFor('contacts')).toMatchObject({ Label: 'New contact', Creates: 'contact' });
        expect(PrimaryActionFor('dashboard')).toMatchObject({ Label: 'New deal', Creates: 'deal' });
    });

    it('offers New account beside New deal on the dashboard only', () => {
        expect(SecondaryActionFor('dashboard')).toMatchObject({ Label: 'New account', Creates: 'account' });
        for (const page of ['list', 'board', 'accounts', 'contacts']) {
            expect(SecondaryActionFor(page)).toBeNull();
        }
    });

    it('maps each action to the Sales entity it creates', () => {
        expect(component).toMatch(/deal: E_DEAL, account: E_ACCOUNT, contact: E_CONTACT/);
        expect(component).toContain("const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';");
        expect(component).toContain("const E_CONTACT = 'MJ_BizApps_Sales: Sales Contacts';");
    });

    it('mounts the grid only on its page, opening rows and creating through the section', () => {
        const block = template.match(/@if \(Page === 'accounts' \|\| Page === 'contacts'\)[\s\S]*?<\/mj-entity-viewer>/)?.[0] ?? '';
        expect(block).toContain('(RecordOpened)="OnPartyOpened($event)"');
        expect(block).toContain('(CreateRecordRequested)="StartPrimary()"');
    });
});
