import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunView, type RunViewParams, type RunViewResult } from '@memberjunction/core';
import {
    BillComCustomerWarning,
    CheckBillComCustomer,
    DecideBillComCustomer,
    type BillComProviderRow,
} from '../lib/data/billcom-customer';

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

/**
 * A new deal may have no company yet, so the check falls back to the pipeline's. A pipeline serves every
 * company it is actively linked to (`PipelineCompany`), so the fallback is only an answer when there is
 * exactly one link; with several, the deal's own company decides and the check waits for it.
 */
describe('the company a new deal is checked under', () => {
    const ACCOUNT = 'CCCCCCCC-0000-0000-0000-000000000001';
    const PIPELINE = 'DDDDDDDD-0000-0000-0000-000000000001';
    const COMPANY = 'EEEEEEEE-0000-0000-0000-000000000001';
    const OTHER_COMPANY = 'EEEEEEEE-0000-0000-0000-000000000002';

    afterEach(() => vi.restoreAllMocks());

    /** Answers the link read with `links`, and the provider reads with no Bill.com provider. */
    function stubReads(links: RunViewResult) {
        const one = vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue(links);
        const many = vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
            params.map(() => ({ Success: true, Results: [] }) as unknown as RunViewResult),
        );
        return { one, many };
    }

    it('reads the pipeline\'s active links and checks under its only company', async () => {
        const { one, many } = stubReads({ Success: true, Results: [{ CompanyID: COMPANY }] } as unknown as RunViewResult);
        expect((await CheckBillComCustomer(ACCOUNT, null, PIPELINE)).Kind).toBe('NotApplicable');

        const linkRead = one.mock.calls[0][0] as RunViewParams;
        expect(linkRead.EntityName).toBe('MJ_BizApps_Sales: Pipeline Companies');
        expect(linkRead.ExtraFilter).toBe(`PipelineID = '${PIPELINE}' AND IsActive = 1`);
        const providers = (many.mock.calls[0][0] as RunViewParams[]).find((p) => /Payment Providers$/.test(p.EntityName ?? ''));
        expect(providers?.ExtraFilter).toContain(`CompanyID = '${COMPANY}'`);
    });

    it('checks nothing when the pipeline serves several companies', async () => {
        const { many } = stubReads({
            Success: true,
            Results: [{ CompanyID: COMPANY }, { CompanyID: OTHER_COMPANY }],
        } as unknown as RunViewResult);
        expect((await CheckBillComCustomer(ACCOUNT, null, PIPELINE)).Kind).toBe('NotApplicable');
        expect(many).not.toHaveBeenCalled();
    });

    it('uses the deal\'s own company without reading the pipeline', async () => {
        const { one, many } = stubReads({ Success: true, Results: [] } as unknown as RunViewResult);
        await CheckBillComCustomer(ACCOUNT, OTHER_COMPANY, PIPELINE);
        expect(one).not.toHaveBeenCalled();
        const providers = (many.mock.calls[0][0] as RunViewParams[]).find((p) => /Payment Providers$/.test(p.EntityName ?? ''));
        expect(providers?.ExtraFilter).toContain(`CompanyID = '${OTHER_COMPANY}'`);
    });

    it('throws when the links cannot be read', async () => {
        stubReads({ Success: false, Results: [], ErrorMessage: 'boom' } as unknown as RunViewResult);
        await expect(CheckBillComCustomer(ACCOUNT, null, PIPELINE)).rejects.toThrow('boom');
    });
});
