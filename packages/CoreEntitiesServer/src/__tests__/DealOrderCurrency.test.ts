import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';
import { OrderCurrencyFor, SameOrderCurrency } from '../deal-order-currency.js';

/**
 * A DEAL'S CURRENCY REACHES ITS ORDER (golive #492).
 *
 * Orders reads `OrderHeader.CurrencyCode` as the currency of the order's amounts, NULL meaning the
 * selling company's functional currency. A deal names its currency as `Deal.CurrencyID`; nothing passed
 * it to the order, so a deal contracted in a foreign currency produced an order read as the company's
 * own currency. The order now takes the deal's code when it is provisioned, and follows a change of it
 * while orders still lets the currency change (Draft or Quoted, never confirmed).
 *
 * `Object.create` holds the server entity without standing up metadata, as `OrderBillToContact` does.
 */

const COMPANY = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORDER = 'bbbbbbbb-0000-4000-8000-000000000001';
const USD_ID = 'cccccccc-0000-4000-8000-000000000001';
const AUD_ID = 'cccccccc-0000-4000-8000-000000000002';
const EUR_ID = 'cccccccc-0000-4000-8000-000000000003';
const CODES: Record<string, string> = { [USD_ID]: 'USD', [AUD_ID]: 'AUD', [EUR_ID]: 'EUR' };

const PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

describe('the currency code an order takes from its deal', () => {
    it('is the deal currency when it differs from the functional currency', () => {
        expect(OrderCurrencyFor('AUD', 'USD', 'USD')).toBe('AUD');
    });

    it('is null when the deal is in the functional currency, as orders reads NULL', () => {
        expect(OrderCurrencyFor('USD', 'USD', 'USD')).toBeNull();
        expect(OrderCurrencyFor('gbp ', 'GBP', 'USD')).toBeNull();
    });

    it('is null when the deal has no currency', () => {
        expect(OrderCurrencyFor(null, 'USD', 'USD')).toBeNull();
    });

    it('reads the deal default as functional when the company has no profile', () => {
        // Writing USD there would make orders refuse a confirm that works today.
        expect(OrderCurrencyFor('USD', null, 'USD')).toBeNull();
        // A foreign currency is still written, so orders asks for the profile instead of booking it as USD.
        expect(OrderCurrencyFor('AUD', null, 'USD')).toBe('AUD');
    });

    it('treats NULL and the functional code as the same order currency', () => {
        expect(SameOrderCurrency(null, 'USD', 'USD', 'USD')).toBe(true);
        expect(SameOrderCurrency('AUD', null, 'USD', 'USD')).toBe(false);
    });
});

type FakeOrder = {
    ID: string;
    IsSaved: boolean;
    Status: string;
    ConfirmedAt: Date | null;
    CurrencyCode: string | null;
    BillToPersonID: string | null;
    BillToOrganizationID: string | null;
    Saves: number;
    LatestResult: { CompleteMessage: string } | null;
    Get(field: string): string | null;
    Set(field: string, value: string | null): void;
    Load(id: string): Promise<boolean>;
    Save(): Promise<boolean>;
};

function fakeOrder(fields: Partial<FakeOrder>, opts: { refuse?: boolean } = {}): FakeOrder {
    const order: FakeOrder = {
        ID: ORDER,
        IsSaved: true,
        Status: 'Draft',
        ConfirmedAt: null,
        CurrencyCode: null,
        BillToPersonID: null,
        BillToOrganizationID: null,
        Saves: 0,
        LatestResult: null,
        Get: (field) => (order as unknown as Record<string, string | null>)[field] ?? null,
        Set: (field, value) => { (order as unknown as Record<string, string | null>)[field] = value; },
        Load: async () => true,
        Save: async () => {
            order.Saves++;
            if (opts.refuse) {
                order.LatestResult = { CompleteMessage: 'Order is Confirmed, so its currency cannot change.' };
                return false;
            }
            return true;
        },
        ...fields,
    };
    return order;
}

type Opts = {
    before?: string | null;
    after?: string | null;
    functional?: string | null;
    currencyReadFails?: boolean;
    overrides?: Record<string, unknown>;
};

type Harness = {
    planOrderCurrency(): Promise<object | null>;
    applyOrderFollow(plan: object): Promise<void>;
    stampProvisionedOrderCurrency(): Promise<void>;
    OrderStatusWarnings: readonly string[];
};

function deal(order: FakeOrder, opts: Opts): { deal: Harness; scope: { Commits: number; Rollbacks: number } } {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const scope = { Commits: 0, Rollbacks: 0 };
    const provider = {
        Entities: [{ Name: PROFILE_ENTITY }, { Name: CURRENCY_ENTITY }],
        GetEntityObject: async () => order,
        BeginEntityTransaction: async () => ({
            Commit: async () => { scope.Commits++; },
            Rollback: async () => { scope.Rollbacks++; },
        }),
        RunView: async (params: { EntityName: string; ExtraFilter: string }) => {
            if (params.EntityName === PROFILE_ENTITY) {
                return { Success: true, Results: opts.functional ? [{ FunctionalCurrencyCode: opts.functional }] : [] };
            }
            if (opts.currencyReadFails) {
                return { Success: false, ErrorMessage: 'boom', Results: [] };
            }
            const id = /ID='([^']*)'/.exec(params.ExtraFilter)?.[1] ?? '';
            return { Success: true, Results: CODES[id] ? [{ Code: CODES[id] }] : [] };
        },
    };
    for (const [k, v] of Object.entries({
        ID: 'deal-1',
        IsSaved: true,
        CompanyID: COMPANY,
        OrderID: ORDER,
        OrderID_Object: null,
        CurrencyID: opts.after ?? null,
        ContextCurrentUser: { ID: 'u1' },
        ProviderToUse: provider,
        _orderStatusWarnings: [],
        GetFieldByName: (name: string) => (name === 'CurrencyID' ? { OldValue: opts.before ?? null } : { OldValue: null }),
        ...opts.overrides,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return { deal: instance, scope };
}

async function follow(d: Harness): Promise<void> {
    const plan = await d.planOrderCurrency();
    if (plan) {
        await d.applyOrderFollow({ Person: null, Organization: null, Currency: plan });
    }
}

describe('the order a deal provisions', () => {
    function provisioned(after: string | null, functional: string | null, orderFields: Partial<FakeOrder> = {}) {
        const order = fakeOrder({ IsSaved: false, ...orderFields });
        const { deal: d } = deal(order, {
            after,
            functional,
            overrides: { IsSaved: false, OrderID_Object: order, _orderJustProvisioned: true },
        });
        return { order, d };
    }

    it('takes a foreign deal currency', async () => {
        const { order, d } = provisioned(AUD_ID, 'USD');
        await d.stampProvisionedOrderCurrency();
        expect(order.CurrencyCode).toBe('AUD');
    });

    it('stays NULL for a deal in the functional currency', async () => {
        const { order, d } = provisioned(USD_ID, 'USD');
        await d.stampProvisionedOrderCurrency();
        expect(order.CurrencyCode).toBeNull();
    });

    it('stays NULL for a deal with no currency, keeping what a caller set on the order', async () => {
        const { order, d } = provisioned(null, 'USD', { CurrencyCode: 'EUR' });
        await d.stampProvisionedOrderCurrency();
        expect(order.CurrencyCode).toBe('EUR');
    });

    it('leaves an order this save did not provision', async () => {
        const order = fakeOrder({});
        const { deal: d } = deal(order, { after: AUD_ID, functional: 'USD', overrides: { OrderID_Object: order } });
        await d.stampProvisionedOrderCurrency();
        expect(order.CurrencyCode).toBeNull();
    });

    it('saves the deal with a warning when the currency cannot be read', async () => {
        const order = fakeOrder({ IsSaved: false });
        const { deal: d } = deal(order, {
            after: AUD_ID,
            functional: 'USD',
            currencyReadFails: true,
            overrides: { IsSaved: false, OrderID_Object: order, _orderJustProvisioned: true },
        });
        await expect(d.stampProvisionedOrderCurrency()).resolves.toBeUndefined();
        expect(order.CurrencyCode).toBeNull();
        expect(d.OrderStatusWarnings).toHaveLength(1);
    });
});

describe('a currency changed on a deal whose order already exists', () => {
    it('moves a Draft order to the new currency', async () => {
        const order = fakeOrder({ Status: 'Draft' });
        const { deal: d, scope } = deal(order, { before: USD_ID, after: AUD_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBe('AUD');
        expect(scope.Commits).toBe(1);
        expect(d.OrderStatusWarnings).toEqual([]);
    });

    it('moves a Quoted order too', async () => {
        const order = fakeOrder({ Status: 'Quoted', CurrencyCode: 'AUD' });
        const { deal: d } = deal(order, { before: AUD_ID, after: EUR_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBe('EUR');
    });

    it('clears the order currency when the deal moves to the functional currency', async () => {
        const order = fakeOrder({ CurrencyCode: 'AUD' });
        const { deal: d } = deal(order, { before: AUD_ID, after: USD_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBeNull();
        expect(order.Saves).toBe(1);
    });

    it('leaves a Confirmed order alone and says so', async () => {
        const order = fakeOrder({ Status: 'Confirmed', ConfirmedAt: new Date() });
        const { deal: d } = deal(order, { before: USD_ID, after: AUD_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBeNull();
        expect(order.Saves).toBe(0);
        expect(d.OrderStatusWarnings[0]).toContain('Confirmed');
    });

    it('leaves an order that was confirmed and is back in Draft', async () => {
        const order = fakeOrder({ Status: 'Draft', ConfirmedAt: new Date() });
        const { deal: d } = deal(order, { before: USD_ID, after: AUD_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBeNull();
        expect(order.Saves).toBe(0);
        expect(d.OrderStatusWarnings[0]).toContain('confirmed');
    });

    it('keeps a currency set on the order itself, with a warning', async () => {
        const order = fakeOrder({ CurrencyCode: 'EUR' });
        const { deal: d } = deal(order, { before: USD_ID, after: AUD_ID, functional: 'USD' });
        await follow(d);
        expect(order.CurrencyCode).toBe('EUR');
        expect(order.Saves).toBe(0);
        expect(d.OrderStatusWarnings).toHaveLength(1);
    });

    it('puts the order back and warns when orders refuses the change', async () => {
        const order = fakeOrder({}, { refuse: true });
        const { deal: d, scope } = deal(order, { before: USD_ID, after: AUD_ID, functional: 'USD' });
        await expect(follow(d)).resolves.toBeUndefined();
        expect(scope.Rollbacks).toBe(1);
        expect(order.CurrencyCode).toBeNull();
        expect(d.OrderStatusWarnings[0]).toContain('currency');
    });
});

describe('when the currency follow plans nothing', () => {
    it('plans nothing when the currency did not change', async () => {
        const { deal: d } = deal(fakeOrder({}), { before: AUD_ID, after: AUD_ID, functional: 'USD' });
        expect(await d.planOrderCurrency()).toBeNull();
    });

    it('plans nothing when the deal moves from no currency to the functional one', async () => {
        const { deal: d } = deal(fakeOrder({}), { before: null, after: USD_ID, functional: 'USD' });
        expect(await d.planOrderCurrency()).toBeNull();
    });

    it('plans nothing for a deal the close lock holds', async () => {
        const { deal: d } = deal(fakeOrder({}), {
            before: USD_ID, after: AUD_ID, functional: 'USD', overrides: { _lockedAtSave: true },
        });
        expect(await d.planOrderCurrency()).toBeNull();
    });

    it('plans nothing for a deal that is not saved yet; provisioning covers it', async () => {
        const { deal: d } = deal(fakeOrder({}), {
            before: null, after: AUD_ID, functional: 'USD', overrides: { IsSaved: false },
        });
        expect(await d.planOrderCurrency()).toBeNull();
    });

    it('plans nothing and warns when the currency cannot be read', async () => {
        const { deal: d } = deal(fakeOrder({}), {
            before: USD_ID, after: AUD_ID, functional: 'USD', currencyReadFails: true,
        });
        expect(await d.planOrderCurrency()).toBeNull();
        expect(d.OrderStatusWarnings).toHaveLength(1);
    });
});
