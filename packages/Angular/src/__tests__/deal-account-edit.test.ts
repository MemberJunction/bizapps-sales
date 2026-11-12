/**
 * "EDIT ACCOUNT" OPENS THE DEAL'S SELECTED ACCOUNT, NOT A NEW ONE, AND RE-READS THE DEAL ONLY WHEN SAFE.
 *
 * `Object.create` holds the component without an injector, as its sibling suites do; the presenter
 * and the form are stand-ins that record what they were asked to do.
 */
import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { MJFormPresenterOptions } from '@memberjunction/ng-base-forms';

import { MJSDealAccountEditComponent } from '../lib/form-panels/deal-account-edit.component';

const ACCOUNT = 'AAAAAAAA-0000-4000-8000-000000000001';

function harness(opts: { accountId?: string | null; saved?: boolean; dealEditMode?: boolean; dirty?: boolean } = {}) {
    const opened: MJFormPresenterOptions[] = [];
    let refreshes = 0;
    const c = Object.create(MJSDealAccountEditComponent.prototype) as MJSDealAccountEditComponent;
    Object.defineProperty(c, 'forms', {
        value: {
            Open: (o: MJFormPresenterOptions) => {
                opened.push(o);
                return { AfterSaved: async () => (opts.saved === false ? null : {}) };
            },
        },
    });
    c.Record = { AccountID: opts.accountId === undefined ? ACCOUNT : opts.accountId, Account: ' Acme ', Dirty: opts.dirty ?? false } as never;
    c.Form = { RefreshRecord: async () => { refreshes++; return true; } } as never;
    c.DealEditMode = opts.dealEditMode ?? false;
    return { c, opened, refreshes: () => refreshes };
}

describe('editing the selected account from a deal', () => {
    it('opens the selected account for editing in a slide-in', async () => {
        const h = harness();
        await h.c.Edit();
        expect(h.opened).toEqual([{
            EntityName: 'MJ_BizApps_Sales: Sales Accounts',
            RecordId: ACCOUNT,
            Presentation: 'slide-in',
            EditMode: true,
            Title: 'Acme',
        }]);
    });

    it('opens nothing when the deal has no account', async () => {
        const h = harness({ accountId: null });
        await h.c.Edit();
        expect(h.opened).toEqual([]);
    });

    it('re-reads the deal after a save, so a renamed account shows its new name', async () => {
        const h = harness();
        await h.c.Edit();
        expect(h.refreshes()).toBe(1);
    });

    for (const [why, o] of [
        ['the slide-in was cancelled', { saved: false }],
        ['the deal is in edit mode', { dealEditMode: true }],
        ['the deal has unsaved changes', { dirty: true }],
    ] as const) {
        it(`does not re-read the deal when ${why}`, async () => {
            const h = harness(o);
            await h.c.Edit();
            expect(h.refreshes()).toBe(0);
        });
    }
});
