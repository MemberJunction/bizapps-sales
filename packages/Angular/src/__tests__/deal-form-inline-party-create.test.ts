/**
 * A CUSTOMER OR CONTACT CREATED FROM A DEAL FORM FIELD IS BOUND UNDER THE KEY IT WAS WRITTEN UNDER
 * (issue #202).
 *
 * A party field's "Create new" footer selects the new record with `created.Get(<key>)`. On MJ 6.1.x an
 * IsA child (`SalesAccount`, `SalesContact`) created over GraphQL is written under a server-minted key
 * while `Get('ID')` keeps the browser's key, which was never written; `PrimaryKey` carries the written
 * one. Measured against the real v6.1.5 `BaseEntity` and `GraphQLDataProvider`: `Get('ID')` returned
 * the client key, `PrimaryKey` the server key. The deal then pointed at a customer that does not exist
 * and `DealEntityServer.missingPartyRefusal()` refused the save.
 *
 * `Object.create` holds the panel without an injector, as its sibling suites do. The form, the field's
 * own `Complete` and the created record are stand-ins: the subject is what the panel binds after them.
 */
import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FormNavigationEvent } from '@memberjunction/ng-base-forms';

import { MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

const UNWRITTEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const WRITTEN = 'BBBBBBBB-0000-4000-8000-000000000002';

type DealStub = { AccountID: string | null; PrimaryContactID: string | null; BillingContactID: string | null };

function harness() {
    const deal: DealStub & { EntityInfo: { Fields: { Name: string; RelatedEntityFieldName: string | null }[] } } = {
        AccountID: null,
        PrimaryContactID: null,
        BillingContactID: null,
        EntityInfo: {
            Fields: ['AccountID', 'PrimaryContactID', 'BillingContactID', 'DealTypeID'].map((Name) => ({
                Name,
                RelatedEntityFieldName: 'ID',
            })),
        },
    };
    const forwarded: FormNavigationEvent[] = [];
    const panel = Object.create(MJSDealPipelinePanel.prototype) as MJSDealPipelinePanel;
    Object.defineProperty(panel, 'Record', { value: deal, writable: true });
    Object.defineProperty(panel, 'FormComponent', {
        value: { OnFormNavigate: (e: FormNavigationEvent) => forwarded.push(e) },
        writable: true,
    });
    return { panel, deal, forwarded };
}

/** The record the slide-in hands back: `Get('ID')` reads the parent's unwritten key, `PrimaryKey` the written one. */
const created = (primaryKey = WRITTEN) => ({
    Get: (f: string) => (f === 'ID' ? UNWRITTEN : null),
    PrimaryKey: { GetValueByFieldName: (f: string) => (f === 'ID' ? primaryKey : null) },
});

/** What MJ's `mj-form-field` does in `selectCreatedFKRecord`: bind `created.Get(<key>)`. */
function createRelated(deal: DealStub, field: keyof DealStub): FormNavigationEvent {
    return {
        Kind: 'create-related',
        EntityName: 'MJ_BizApps_Sales: Sales Accounts',
        Complete: (c) => {
            if (c) deal[field] = String(c.Get('ID'));
        },
    };
}

function completeWith(forwarded: FormNavigationEvent[], record: ReturnType<typeof created> | null): void {
    const e = forwarded[0];
    if (e?.Kind !== 'create-related') throw new Error('expected a create-related event to reach the form');
    e.Complete(record as never);
}

describe('creating a party from a deal form field', () => {
    for (const field of ['AccountID', 'PrimaryContactID', 'BillingContactID'] as const) {
        it(`binds ${field} to the written key, not the one Get('ID') reports`, () => {
            const h = harness();
            h.panel.OnFieldNavigate(createRelated(h.deal, field), field);
            completeWith(h.forwarded, created());

            expect(h.deal[field]).toBe(WRITTEN);
        });
    }

    it('leaves the field as the form set it when both reads agree (MJ sends the key)', () => {
        const h = harness();
        h.panel.OnFieldNavigate(createRelated(h.deal, 'AccountID'), 'AccountID');
        completeWith(h.forwarded, created(UNWRITTEN.toUpperCase()));

        expect(h.deal.AccountID).toBe(UNWRITTEN);
    });

    it('binds nothing when the create is cancelled', () => {
        const h = harness();
        h.panel.OnFieldNavigate(createRelated(h.deal, 'AccountID'), 'AccountID');
        completeWith(h.forwarded, null);

        expect(h.deal.AccountID).toBeNull();
    });

    it('passes every other event through untouched', () => {
        const h = harness();
        const typeCreate = createRelated(h.deal, 'AccountID');
        const open: FormNavigationEvent = { Kind: 'external-link', Url: 'https://example.com' };
        h.panel.OnFieldNavigate(typeCreate, 'DealTypeID');
        h.panel.OnFieldNavigate(open, 'AccountID');

        expect(h.forwarded[0]).toBe(typeCreate);
        expect(h.forwarded[1]).toBe(open);
    });

    it('every deal field panel routes mj-form-field navigation through the rebind', () => {
        const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
        expect(source).not.toContain('(Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>');
        expect(source.match(/\(Navigate\)="OnFieldNavigate\(\$event, f\.name\)"><\/mj-form-field>/g)?.length).toBe(5);
    });
});
