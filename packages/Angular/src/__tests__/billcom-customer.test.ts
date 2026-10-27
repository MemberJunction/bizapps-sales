import { describe, expect, it } from 'vitest';
import { BillComCustomerWarning, DecideBillComCustomer, type BillComProviderRow } from '../lib/data/billcom-customer';

/**
 * Orders creates a Bill.com customer on an account's first Bill.com invoice and never looks for an
 * existing one, so an account already in Bill.com with no External Customer row gets a duplicate.
 * The deal form warns when the rep picks such an account.
 */

const BILLCOM_TYPE = 'AAAAAAAA-0000-0000-0000-000000000001';
const STRIPE_TYPE = 'AAAAAAAA-0000-0000-0000-000000000002';
const billCom: BillComProviderRow = { ID: 'BBBBBBBB-0000-0000-0000-000000000001', PaymentProviderTypeID: BILLCOM_TYPE, Company: 'Acme Corp' };
const stripe: BillComProviderRow = { ID: 'BBBBBBBB-0000-0000-0000-000000000002', PaymentProviderTypeID: STRIPE_TYPE, Company: 'Acme Corp' };

describe('the Bill.com customer check', () => {
    it('warns when the company invoices through Bill.com and the account has no customer there', () => {
        const check = DecideBillComCustomer([billCom, stripe], [BILLCOM_TYPE], []);
        expect(check).toEqual({ Kind: 'Missing', CompanyName: 'Acme Corp' });
        expect(BillComCustomerWarning(check)).toContain('no Bill.com customer ID under Acme Corp');
    });

    it('is quiet once the account has a customer under the Bill.com provider', () => {
        const check = DecideBillComCustomer([billCom], [BILLCOM_TYPE], [billCom.ID]);
        expect(check.Kind).toBe('Linked');
        expect(BillComCustomerWarning(check)).toBeNull();
    });

    it('does not count a customer under another provider', () => {
        expect(DecideBillComCustomer([billCom, stripe], [BILLCOM_TYPE], [stripe.ID]).Kind).toBe('Missing');
    });

    it('is quiet for a company that does not invoice through Bill.com', () => {
        const check = DecideBillComCustomer([stripe], [BILLCOM_TYPE], []);
        expect(check.Kind).toBe('NotApplicable');
        expect(BillComCustomerWarning(check)).toBeNull();
    });

    it('matches IDs whatever their case', () => {
        const lowered = { ...billCom, PaymentProviderTypeID: BILLCOM_TYPE.toLowerCase() };
        expect(DecideBillComCustomer([lowered], [BILLCOM_TYPE], [billCom.ID.toLowerCase()]).Kind).toBe('Linked');
    });
});
