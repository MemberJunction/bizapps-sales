import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealPartyPanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * THE DEAL'S ACCOUNT AND CONTACTS USE THE FAST PARTY PICKER (bc-aidp-next-golive#372).
 *
 * The stock field listed rows on focus and searched one view column with a leading wildcard, which
 * takes seconds on a million-person party file. Each party field now names the picker's Kind and the
 * sales query that restricts results to rows the Deal's FK can hold (SalesAccount / SalesContact).
 */

const ACCOUNTS = { Kind: 'Organization', QueryName: 'Sales: Party Lookup Accounts' };
const CONTACTS = { Kind: 'Person', QueryName: 'Sales: Party Lookup Contacts' };

interface Spec { name: string; party?: { Kind: string; QueryName: string } }

function pickers(fields: readonly Spec[]): Record<string, Spec['party']> {
    return Object.fromEntries(fields.filter((f) => f.party).map((f) => [f.name, f.party]));
}

function panelWith<T extends object>(proto: T, saved: boolean): T & { Fields: Spec[] } {
    const panel = Object.create(proto) as T & { Fields: Spec[]; Record: DealEntity };
    panel.Record = { IsSaved: saved } as unknown as DealEntity;
    return panel;
}

const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

describe('deal form: Account and contacts use the party picker', () => {
    it('the Account & people panel marks exactly the three party fields on a saved deal', () => {
        const panel = panelWith(MJSDealPartyPanel.prototype, true);
        expect(pickers(panel.Fields)).toEqual({ AccountID: ACCOUNTS, PrimaryContactID: CONTACTS, BillingContactID: CONTACTS });
    });

    it('the Pipeline panel carries the same pickers while a new deal borrows the party fields', () => {
        const panel = panelWith(MJSDealPipelinePanel.prototype, false);
        expect(pickers(panel.Fields)).toEqual({ AccountID: ACCOUNTS, PrimaryContactID: CONTACTS, BillingContactID: CONTACTS });
    });

    it('both panels render bizapps-party-field for a party spec, keeping the account fill and navigation', () => {
        const rendered = source.match(/<bizapps-party-field[\s\S]*?<\/bizapps-party-field>/g) ?? [];
        expect(rendered).toHaveLength(2);
        for (const tag of rendered) {
            expect(tag).toContain('[Kind]="f.party.Kind"');
            expect(tag).toContain('[QueryName]="f.party.QueryName"');
            expect(tag).toContain('(ValueChange)="OnFieldValueChange($event)"');
            expect(tag).toContain('(Navigate)="FormComponent.OnFormNavigate($event)"');
        }
    });

    it('each query the form names is shipped in metadata/queries', () => {
        for (const [file, name] of [
            ['.party-lookup-accounts.json', ACCOUNTS.QueryName],
            ['.party-lookup-contacts.json', CONTACTS.QueryName],
        ]) {
            const json = readFileSync(new URL(`../../../../metadata/queries/${file}`, import.meta.url), 'utf8');
            expect((JSON.parse(json) as { fields: { Name: string } }[])[0].fields.Name).toBe(name);
        }
    });
});
