import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealPartyPanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';
import { ContactOptionLabel } from '../lib/workspace/deal-workspace.service';

/**
 * CHOOSING AN ACCOUNT FILLS THE DEAL'S EMPTY CONTACTS FROM IT (#254), on the deal form.
 *
 * The rule itself is pinned in sales-entities (`account-contact-defaults.test.ts`). These check the
 * wiring: each panel calls the fill when the ACCOUNT changes and only then, redraws the contacts
 * after a fill, and reports a failed read instead of dropping it.
 */

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';

type FillOutcome = Array<'PrimaryContactID' | 'BillingContactID'> | Error;

/** A deal whose fill returns `outcome` and counts its calls. */
function dealStub(outcome: FillOutcome): DealEntity & { Fills: number } {
    const stub = {
        Fills: 0,
        async FillContactsFromAccount(): Promise<Array<'PrimaryContactID' | 'BillingContactID'>> {
            stub.Fills++;
            if (outcome instanceof Error) throw outcome;
            return outcome;
        },
    };
    return stub as unknown as DealEntity & { Fills: number };
}

describe('deal form: the account field fills the contacts', () => {
    for (const [name, make] of [
        ['Pipeline panel', () => new MJSDealPipelinePanel()],
        ['Account & people panel', () => new MJSDealPartyPanel()],
    ] as const) {
        it(`${name}: fills on an account change and rebuilds only the contact fields`, async () => {
            const panel = make();
            const deal = dealStub(['PrimaryContactID']);
            panel.Record = deal;
            const before = {
                account: panel.FieldTrackKey({ name: 'AccountID', type: 'textbox' }),
                primary: panel.FieldTrackKey({ name: 'PrimaryContactID', type: 'textbox' }),
            };
            await panel.OnFieldValueChange({ FieldName: 'AccountID' });
            expect(deal.Fills).toBe(1);
            expect(panel.FieldTrackKey({ name: 'AccountID', type: 'textbox' })).toBe(before.account);
            expect(panel.FieldTrackKey({ name: 'PrimaryContactID', type: 'textbox' })).not.toBe(before.primary);
        });

        it(`${name}: ignores changes to other fields`, async () => {
            const panel = make();
            const deal = dealStub(['PrimaryContactID']);
            panel.Record = deal;
            await panel.OnFieldValueChange({ FieldName: 'PrimaryContactID' });
            expect(deal.Fills).toBe(0);
        });

        it(`${name}: does not rebuild the contacts when nothing was filled`, async () => {
            const panel = make();
            panel.Record = dealStub([]);
            const before = panel.FieldTrackKey({ name: 'BillingContactID', type: 'textbox' });
            await panel.OnFieldValueChange({ FieldName: 'AccountID' });
            expect(panel.FieldTrackKey({ name: 'BillingContactID', type: 'textbox' })).toBe(before);
        });

        it(`${name}: says when the defaults could not be read`, async () => {
            const panel = make();
            panel.Record = dealStub(new Error('read failed'));
            await panel.OnFieldValueChange({ FieldName: 'AccountID' });
            expect(panel.AccountDefaultsError()).toBe("The account's default contacts were not filled in: read failed");
        });
    }
});

describe('ContactOptionLabel', () => {
    const row = { ID: ALICE, FirstName: 'Ada', LastName: 'Byron', Email: 'ada@example.com' };

    it('labels a contact "Name (email)", as the deal form picker does', () => {
        expect(ContactOptionLabel({ ...row, DisplayNameAndEmail: 'Ada Byron (ada@example.com)' })).toBe(
            'Ada Byron (ada@example.com)',
        );
    });

    it('falls back to the name, then the email', () => {
        expect(ContactOptionLabel({ ...row, DisplayNameAndEmail: null })).toBe('Ada Byron');
        expect(ContactOptionLabel({ ...row, FirstName: null, LastName: null, DisplayNameAndEmail: ' ' })).toBe(
            'ada@example.com',
        );
    });
});
