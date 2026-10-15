import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntity } from '@memberjunction/core';
import { ContactsFromAccount, type ContactPair } from '../account-contact-defaults';
import { DealEntity } from '../deal-entity';

/**
 * CHOOSING AN ACCOUNT FILLS THE DEAL'S EMPTY CONTACTS FROM IT (#254).
 *
 * The rule is pinned as a pure function, then through `DealEntity.FillContactsFromAccount`, including
 * how it meets the primary-fills-billing rule in `DealEntity.Set` (#312).
 */

const ACCOUNT = 'bbbbbbbb-0000-4000-8000-000000000001';
const OTHER_ACCOUNT = 'bbbbbbbb-0000-4000-8000-000000000002';
const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'aaaaaaaa-0000-4000-8000-000000000002';
const CAROL = 'aaaaaaaa-0000-4000-8000-000000000003';

const NONE: ContactPair = { PrimaryContactID: null, BillingContactID: null };

describe('ContactsFromAccount', () => {
    it('fills both empty contacts from both defaults', () => {
        expect(ContactsFromAccount(NONE, { PrimaryContactID: ALICE, BillingContactID: BOB })).toEqual({
            PrimaryContactID: ALICE,
            BillingContactID: BOB,
        });
    });

    it('never overwrites a contact the deal already has', () => {
        const deal = { PrimaryContactID: CAROL, BillingContactID: CAROL };
        expect(ContactsFromAccount(deal, { PrimaryContactID: ALICE, BillingContactID: BOB })).toEqual({});
    });

    it('fills only the empty one', () => {
        const deal = { PrimaryContactID: CAROL, BillingContactID: '' };
        expect(ContactsFromAccount(deal, { PrimaryContactID: ALICE, BillingContactID: BOB })).toEqual({
            BillingContactID: BOB,
        });
    });

    it('writes nothing for an empty default', () => {
        expect(ContactsFromAccount(NONE, NONE)).toEqual({});
        expect(ContactsFromAccount(NONE, { PrimaryContactID: '', BillingContactID: null })).toEqual({});
    });
});

describe('DealEntity.FillContactsFromAccount', () => {
    afterEach(() => vi.restoreAllMocks());

    /** A deal whose account read returns `defaults`, optionally switching the account mid-read. */
    class TestDeal extends DealEntity {
        public Defaults: ContactPair = NONE;
        public SwitchAccountTo: string | null = null;
        public Reads = 0;
        protected override async ReadAccountContactDefaults(): Promise<ContactPair> {
            this.Reads++;
            if (this.SwitchAccountTo) this.Set('AccountID', this.SwitchAccountTo);
            return this.Defaults;
        }
    }

    function deal(initial: Record<string, string | null>, defaults: ContactPair): TestDeal {
        const store: Record<string, unknown> = { ...initial };
        vi.spyOn(BaseEntity.prototype, 'Set').mockImplementation((name: string, value: unknown) => {
            store[name] = value;
        });
        vi.spyOn(BaseEntity.prototype, 'Get').mockImplementation((name: string) => store[name]);
        const d = Object.create(TestDeal.prototype) as TestDeal;
        d.Defaults = defaults;
        d.SwitchAccountTo = null;
        d.Reads = 0;
        return d;
    }

    it("fills the deal's empty contacts from the account", async () => {
        const d = deal(
            { AccountID: ACCOUNT, PrimaryContactID: null, BillingContactID: null },
            { PrimaryContactID: ALICE, BillingContactID: BOB },
        );
        expect(await d.FillContactsFromAccount()).toEqual(['BillingContactID', 'PrimaryContactID']);
        expect(d.PrimaryContactID).toBe(ALICE);
        expect(d.BillingContactID).toBe(BOB);
    });

    it("keeps the account's billing default when the primary is written after it", async () => {
        const d = deal(
            { AccountID: ACCOUNT, PrimaryContactID: null, BillingContactID: null },
            { PrimaryContactID: ALICE, BillingContactID: BOB },
        );
        await d.FillContactsFromAccount();
        expect(d.BillingContactID).toBe(BOB);
    });

    it('lets the primary fill billing when the account has no billing default', async () => {
        const d = deal(
            { AccountID: ACCOUNT, PrimaryContactID: null, BillingContactID: null },
            { PrimaryContactID: ALICE, BillingContactID: null },
        );
        expect(await d.FillContactsFromAccount()).toEqual(['PrimaryContactID']);
        expect(d.PrimaryContactID).toBe(ALICE);
        expect(d.BillingContactID).toBe(ALICE);
    });

    it('leaves contacts the deal already has', async () => {
        const d = deal(
            { AccountID: ACCOUNT, PrimaryContactID: CAROL, BillingContactID: CAROL },
            { PrimaryContactID: ALICE, BillingContactID: BOB },
        );
        expect(await d.FillContactsFromAccount()).toEqual([]);
        expect(d.PrimaryContactID).toBe(CAROL);
        expect(d.BillingContactID).toBe(CAROL);
    });

    it('does not read anything without an account', async () => {
        const d = deal({ AccountID: null, PrimaryContactID: null, BillingContactID: null }, NONE);
        expect(await d.FillContactsFromAccount()).toEqual([]);
        expect(d.Reads).toBe(0);
    });

    it('writes nothing when the account changed while the read was in flight', async () => {
        const d = deal(
            { AccountID: ACCOUNT, PrimaryContactID: null, BillingContactID: null },
            { PrimaryContactID: ALICE, BillingContactID: BOB },
        );
        d.SwitchAccountTo = OTHER_ACCOUNT;
        expect(await d.FillContactsFromAccount()).toEqual([]);
        expect(d.PrimaryContactID).toBeNull();
        expect(d.BillingContactID).toBeNull();
    });
});
