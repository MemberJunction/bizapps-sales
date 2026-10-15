import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * THE DEAL'S ORDER BILLS THE BILLING CONTACT, FALLING BACK TO THE PRIMARY CONTACT (#312).
 *
 * Provisioning used to read only the primary contact, so a billing contact chosen on the deal never
 * reached the order. Empty still means "bill the primary contact".
 *
 * `Object.create` holds the server entity without standing up metadata, as `BornClosedNoOrder` does.
 */

const COMPANY = 'aaaaaaaa-0000-4000-8000-000000000001';
const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000002';
const PRIMARY = 'aaaaaaaa-0000-4000-8000-000000000003';
const BILLING = 'aaaaaaaa-0000-4000-8000-000000000004';

type Order = { CompanyID?: string; OrderType?: string; BillToOrganizationID?: string | null; BillToPersonID?: string | null };
type Harness = { provisionEmbeddedOrder(): void };

function provision(contacts: { PrimaryContactID: string | null; BillingContactID: string | null }): Order {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const order: Order = {};
    for (const [k, v] of Object.entries({
        OrderID_Object: null,
        CompanyID: COMPANY,
        AccountID: ACCOUNT,
        ...contacts,
        OrderID_EnsureObject: () => order,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    instance.provisionEmbeddedOrder();
    return order;
}

describe('the bill-to person on a newly provisioned order', () => {
    it('is the billing contact when the deal has one', () => {
        expect(provision({ PrimaryContactID: PRIMARY, BillingContactID: BILLING }).BillToPersonID).toBe(BILLING);
    });

    it('is the primary contact when the billing contact is empty', () => {
        expect(provision({ PrimaryContactID: PRIMARY, BillingContactID: null }).BillToPersonID).toBe(PRIMARY);
        expect(provision({ PrimaryContactID: PRIMARY, BillingContactID: '' }).BillToPersonID).toBe(PRIMARY);
    });

    it('is null when the deal names neither contact', () => {
        expect(provision({ PrimaryContactID: null, BillingContactID: null }).BillToPersonID).toBeNull();
    });

    it('leaves the bill-to organization on the account', () => {
        expect(provision({ PrimaryContactID: PRIMARY, BillingContactID: BILLING }).BillToOrganizationID).toBe(ACCOUNT);
    });
});
