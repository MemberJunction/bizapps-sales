import { describe, expect, it } from 'vitest';
import { DefaultBillingCompanyID, MissingDealCompanyIDs, RequiredDealCompanyIDs } from '../deal-companies';

/** Which companies a deal must list, and which billing company a new deal takes (golive #484). */

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';

describe('RequiredDealCompanyIDs', () => {
    it('lists the billing company first, then each line company once', () => {
        expect(RequiredDealCompanyIDs(A, [B, A, B, C])).toEqual([A, B, C]);
    });

    it('compares ids without case, keeping the first spelling', () => {
        expect(RequiredDealCompanyIDs(A, [A.toUpperCase(), B])).toEqual([A, B]);
    });

    it('skips empty values, including a deal with no company yet', () => {
        expect(RequiredDealCompanyIDs(null, [null, '', B])).toEqual([B]);
        expect(RequiredDealCompanyIDs(undefined, [])).toEqual([]);
    });
});

describe('MissingDealCompanyIDs', () => {
    it('returns the required ids the list does not hold', () => {
        expect(MissingDealCompanyIDs([A, B, C], [B])).toEqual([A, C]);
    });

    it('treats a listed id in another case as present', () => {
        expect(MissingDealCompanyIDs([A], [A.toUpperCase()])).toEqual([]);
    });

    it('returns nothing when every required id is listed', () => {
        expect(MissingDealCompanyIDs([A, B], [C, B, A])).toEqual([]);
    });
});

describe('DefaultBillingCompanyID', () => {
    it('takes the first listed company when the deal has none', () => {
        expect(DefaultBillingCompanyID(null, [B, A])).toBe(B);
        expect(DefaultBillingCompanyID('', ['', C])).toBe(C);
    });

    it('leaves a chosen billing company alone', () => {
        expect(DefaultBillingCompanyID(A, [B])).toBeNull();
    });

    it('returns null when nothing is listed', () => {
        expect(DefaultBillingCompanyID(null, [])).toBeNull();
    });
});
