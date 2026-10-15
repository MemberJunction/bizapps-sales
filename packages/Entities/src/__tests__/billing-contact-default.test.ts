import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntity } from '@memberjunction/core';
import { BillingContactFromPrimary } from '../billing-contact-default';
import { DealEntity } from '../deal-entity';

/**
 * PICKING A PRIMARY CONTACT FILLS AN EMPTY BILLING CONTACT (#312).
 *
 * The rule is pinned as a pure function, then through `DealEntity.Set`, the one write both the deal
 * form (`Record.Set`) and the deal workspace (the generated accessor) go through.
 */

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'aaaaaaaa-0000-4000-8000-000000000002';

describe('BillingContactFromPrimary', () => {
    it('copies a newly chosen primary into an empty billing contact', () => {
        expect(BillingContactFromPrimary(null, ALICE, null)).toBe(ALICE);
        expect(BillingContactFromPrimary(null, ALICE, '')).toBe(ALICE);
    });

    it('never overwrites a billing contact that is filled in', () => {
        expect(BillingContactFromPrimary(null, ALICE, BOB)).toBeNull();
        expect(BillingContactFromPrimary(BOB, ALICE, BOB)).toBeNull();
    });

    it('does nothing when the primary is cleared', () => {
        expect(BillingContactFromPrimary(ALICE, null, null)).toBeNull();
    });

    it('does not refill a cleared billing contact when the primary is written again unchanged', () => {
        expect(BillingContactFromPrimary(ALICE, ALICE, null)).toBeNull();
        expect(BillingContactFromPrimary(ALICE, ALICE.toUpperCase(), null)).toBeNull();
    });

    it('copies when the primary changes and the billing contact is empty', () => {
        expect(BillingContactFromPrimary(ALICE, BOB, null)).toBe(BOB);
    });
});

describe('DealEntity.Set', () => {
    afterEach(() => vi.restoreAllMocks());

    function deal(initial: Record<string, string | null>): DealEntity {
        const store: Record<string, unknown> = { ...initial };
        vi.spyOn(BaseEntity.prototype, 'Set').mockImplementation((name: string, value: unknown) => {
            store[name] = value;
        });
        vi.spyOn(BaseEntity.prototype, 'Get').mockImplementation((name: string) => store[name]);
        return Object.create(DealEntity.prototype) as DealEntity;
    }

    it('fills billing when the form writes the primary through Set', () => {
        const d = deal({ PrimaryContactID: null, BillingContactID: null });
        d.Set('PrimaryContactID', ALICE);
        expect(d.BillingContactID).toBe(ALICE);
    });

    it('fills billing when the workspace assigns the primary through the accessor', () => {
        const d = deal({ PrimaryContactID: null, BillingContactID: null });
        d.PrimaryContactID = ALICE;
        expect(d.BillingContactID).toBe(ALICE);
    });

    it('leaves a chosen billing contact alone', () => {
        const d = deal({ PrimaryContactID: null, BillingContactID: BOB });
        d.PrimaryContactID = ALICE;
        expect(d.BillingContactID).toBe(BOB);
    });

    it('lets the rep clear the copy', () => {
        const d = deal({ PrimaryContactID: null, BillingContactID: null });
        d.PrimaryContactID = ALICE;
        d.BillingContactID = null;
        expect(d.BillingContactID).toBeNull();
        expect(d.PrimaryContactID).toBe(ALICE);
    });

    it('touches nothing else on other fields', () => {
        const d = deal({ PrimaryContactID: null, BillingContactID: null });
        d.Set('Name', 'x');
        expect(d.BillingContactID).toBeNull();
    });
});
