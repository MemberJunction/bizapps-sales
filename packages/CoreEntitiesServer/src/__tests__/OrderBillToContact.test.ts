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

/**
 * A PARTY CHANGED AFTER THE ORDER EXISTS FOLLOWS ONTO IT, WHILE ORDERS SAYS IT IS EDITABLE (#319).
 *
 * Provisioning stamps the bill-to once, so a later change of billing contact, primary contact or account
 * never reached the order. The order now follows — but only a side that still bills the deal's PREVIOUS
 * party, so finance's own correction survives, and only while `IsEditable` holds. A refused order save
 * is a warning on the deal's save, never a failure of it.
 *
 * The order is reached by `OrderID`, as on a plain form save where `OrderID_Object` is null.
 */

const ORDER = 'bbbbbbbb-0000-4000-8000-000000000001';
const ACCOUNT_2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const PRIMARY_2 = 'bbbbbbbb-0000-4000-8000-000000000003';
const BILLING_2 = 'bbbbbbbb-0000-4000-8000-000000000004';
const FINANCE_PICK = 'bbbbbbbb-0000-4000-8000-000000000005';

type Parties = { AccountID: string | null; PrimaryContactID: string | null; BillingContactID: string | null };
type OrderFields = {
    Status: string;
    BillToPersonID: string | null;
    BillToOrganizationID: string | null;
    ShipToPersonID?: string | null;
    ShipToOrganizationID?: string | null;
};
type FakeOrder = OrderFields & {
    ID: string;
    IsSaved: boolean;
    Saves: number;
    Kept: string[];
    LatestResult: { CompleteMessage: string } | null;
    Get(field: string): string | null;
    Set(field: string, value: string | null): void;
    Load(id: string): Promise<boolean>;
    Save(): Promise<boolean>;
    KeepPartyOrganization(field: string): void;
};
type Scope = { Commits: number; Rollbacks: number };
type SyncHarness = {
    planOrderBillTo(): object | null;
    applyOrderBillTo(plan: object): Promise<void>;
    OrderStatusWarnings: readonly string[];
};

const PARTY_FIELDS = ['BillToPersonID', 'BillToOrganizationID', 'ShipToPersonID', 'ShipToOrganizationID'] as const;

function fakeOrder(fields: OrderFields, opts: { refuse?: boolean; onSave?: (o: FakeOrder) => void } = {}): FakeOrder {
    // The party columns live in one record so `Get`/`Set` by name and the typed properties agree.
    const party: Record<string, string | null> = {
        ShipToPersonID: null,
        ShipToOrganizationID: null,
        BillToPersonID: fields.BillToPersonID,
        BillToOrganizationID: fields.BillToOrganizationID,
    };
    const order = {
        ID: ORDER,
        IsSaved: true,
        Status: fields.Status,
        Saves: 0,
        Kept: [] as string[],
        LatestResult: null as { CompleteMessage: string } | null,
        Get: (field: string) => party[field] ?? null,
        Set: (field: string, value: string | null) => { party[field] = value; },
        Load: async () => true,
        Save: async () => {
            order.Saves++;
            opts.onSave?.(order as FakeOrder);
            if (opts.refuse) {
                order.LatestResult = { CompleteMessage: 'trigger 51013: the bill-to of a booked order cannot change' };
                return false;
            }
            return true;
        },
        KeepPartyOrganization: (field: string) => { order.Kept.push(field); },
    };
    for (const field of PARTY_FIELDS) {
        Object.defineProperty(order, field, {
            get: () => party[field],
            set: (value: string | null) => { party[field] = value; },
            enumerable: true,
        });
    }
    return order as FakeOrder;
}

function syncDeal(before: Parties, after: Parties, order: FakeOrder): { deal: SyncHarness; scope: Scope } {
    const instance = Object.create(DealEntityServer.prototype) as SyncHarness;
    const scope: Scope = { Commits: 0, Rollbacks: 0 };
    const provider = {
        GetEntityObject: async () => order,
        BeginEntityTransaction: async () => ({
            Commit: async () => { scope.Commits++; },
            Rollback: async () => { scope.Rollbacks++; },
        }),
    };
    for (const [k, v] of Object.entries({
        ID: 'deal-1',
        IsSaved: true,
        OrderID: ORDER,
        OrderID_Object: null,
        ContextCurrentUser: { ID: 'u1' },
        ProviderToUse: provider,
        _orderStatusWarnings: [],
        GetFieldByName: (name: keyof Parties) => ({ OldValue: before[name] }),
        ...after,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return { deal: instance, scope };
}

async function sync(deal: SyncHarness): Promise<void> {
    const plan = deal.planOrderBillTo();
    if (plan) {
        await deal.applyOrderBillTo(plan);
    }
}

const BEFORE: Parties = { AccountID: ACCOUNT, PrimaryContactID: PRIMARY, BillingContactID: BILLING };
const ORDER_AS_PROVISIONED = { BillToPersonID: BILLING, BillToOrganizationID: ACCOUNT };

describe('a party changed on a deal whose order already exists', () => {
    it('moves a Draft order to the new billing contact and keeps the account as its organization', async () => {
        const order = fakeOrder({ Status: 'Draft', ...ORDER_AS_PROVISIONED });
        const { deal, scope } = syncDeal(BEFORE, { ...BEFORE, BillingContactID: BILLING_2 }, order);
        await sync(deal);
        expect(order.BillToPersonID).toBe(BILLING_2);
        expect(order.BillToOrganizationID).toBe(ACCOUNT);
        expect(order.Kept).toEqual(['BillToOrganizationID']);
        expect(scope.Commits).toBe(1);
        expect(deal.OrderStatusWarnings).toEqual([]);
    });

    it('moves a Quoted order too', async () => {
        const order = fakeOrder({ Status: 'Quoted', ...ORDER_AS_PROVISIONED });
        const { deal } = syncDeal(BEFORE, { ...BEFORE, BillingContactID: BILLING_2 }, order);
        await sync(deal);
        expect(order.BillToPersonID).toBe(BILLING_2);
        expect(order.Saves).toBe(1);
    });

    it('leaves a Confirmed order alone and says so', async () => {
        const order = fakeOrder({ Status: 'Confirmed', ...ORDER_AS_PROVISIONED });
        const { deal } = syncDeal(BEFORE, { ...BEFORE, BillingContactID: BILLING_2 }, order);
        await sync(deal);
        expect(order.BillToPersonID).toBe(BILLING);
        expect(order.Saves).toBe(0);
        expect(deal.OrderStatusWarnings).toHaveLength(1);
        expect(deal.OrderStatusWarnings[0]).toContain('Confirmed');
    });

    it('leaves a bill-to finance changed by hand, without a warning', async () => {
        const order = fakeOrder({ Status: 'Draft', BillToPersonID: FINANCE_PICK, BillToOrganizationID: ACCOUNT });
        const { deal } = syncDeal(BEFORE, { ...BEFORE, BillingContactID: BILLING_2 }, order);
        await sync(deal);
        expect(order.BillToPersonID).toBe(FINANCE_PICK);
        expect(order.Saves).toBe(0);
        expect(deal.OrderStatusWarnings).toEqual([]);
    });

    it('follows a primary contact change when the billing contact is empty', async () => {
        const noBilling = { ...BEFORE, BillingContactID: null };
        const order = fakeOrder({ Status: 'Draft', BillToPersonID: PRIMARY, BillToOrganizationID: ACCOUNT });
        const { deal } = syncDeal(noBilling, { ...noBilling, PrimaryContactID: PRIMARY_2 }, order);
        await sync(deal);
        expect(order.BillToPersonID).toBe(PRIMARY_2);
    });

    it('ignores a primary contact change while a billing contact is set', () => {
        const order = fakeOrder({ Status: 'Draft', ...ORDER_AS_PROVISIONED });
        const { deal } = syncDeal(BEFORE, { ...BEFORE, PrimaryContactID: PRIMARY_2 }, order);
        expect(deal.planOrderBillTo()).toBeNull();
    });

    it('moves the bill-to organization with the account and leaves the person', async () => {
        const order = fakeOrder({ Status: 'Draft', ...ORDER_AS_PROVISIONED });
        const { deal } = syncDeal(BEFORE, { ...BEFORE, AccountID: ACCOUNT_2 }, order);
        await sync(deal);
        expect(order.BillToOrganizationID).toBe(ACCOUNT_2);
        expect(order.BillToPersonID).toBe(BILLING);
        expect(order.Kept).toEqual([]);
    });

    it('plans nothing when no party changed', () => {
        const order = fakeOrder({ Status: 'Draft', ...ORDER_AS_PROVISIONED });
        expect(syncDeal(BEFORE, BEFORE, order).deal.planOrderBillTo()).toBeNull();
    });

    it('turns a refused order save into a warning and puts the order back', async () => {
        const order = fakeOrder(
            { Status: 'Draft', ...ORDER_AS_PROVISIONED },
            // Orders' own party defaults may fill the ship-to during the attempt; that goes back too.
            { refuse: true, onSave: (o) => { o.ShipToPersonID = BILLING_2; } },
        );
        const { deal, scope } = syncDeal(BEFORE, { ...BEFORE, BillingContactID: BILLING_2 }, order);
        await expect(sync(deal)).resolves.toBeUndefined();
        expect(scope.Rollbacks).toBe(1);
        expect(scope.Commits).toBe(0);
        expect(order.BillToPersonID).toBe(BILLING);
        expect(order.ShipToPersonID).toBeNull();
        expect(deal.OrderStatusWarnings).toHaveLength(1);
        expect(deal.OrderStatusWarnings[0]).toContain('51013');
    });
});
