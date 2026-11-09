import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata } from '@memberjunction/core';

/**
 * The deal line editor asks orders three things while a rep edits: the line's price, the product's
 * named prices and whether the customer already holds the product. Each answer is applied only if no
 * newer ask has started since (bizapps-sales#355 items 16-18), and Save waits for a pending reprice
 * before it judges whether the discount needs a reason (#509).
 */

const holding = vi.hoisted(() => ({ impl: (() => Promise.resolve(null)) as (...args: unknown[]) => Promise<unknown> }));
const applicable = vi.hoisted(() => ({ impl: (() => Promise.resolve([])) as (...args: unknown[]) => Promise<unknown> }));

vi.mock('@mj-biz-apps/orders-ng', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    GetExistingHolding: (...args: unknown[]) => holding.impl(...args),
}));
vi.mock('@mj-biz-apps/orders-entities', async (importOriginal) => {
    const real = await importOriginal<Record<string, unknown>>();
    return {
        ...real,
        LoadOrdersEngine: () => Promise.resolve(),
        OrdersEngine: { Instance: { ProductByID: () => ({ CompanyID: 'c-1', ProductCategoryID: null }), ServicePeriodSource: () => 'NotRequired' } },
        loadApplicabilityContext: () => Promise.resolve({}),
        ListApplicablePrices: (...args: unknown[]) => applicable.impl(...args),
    };
});

import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

type Editor = MJSDealLineEditorComponent & {
    refreshPrice(): Promise<void>;
    refreshApplicable(): Promise<void>;
    refreshHolding(): Promise<void>;
    priceTimer: ReturnType<typeof setTimeout> | null;
};

/** A promise and the hand that settles it, so a test decides which reply lands first. */
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

const priced = (UnitPrice: number, DiscountAmount = 0) => ({
    Success: true,
    Output: {
        Success: true,
        Lines: [{ ProductID: 'p-1', UnitPrice, LineTotalNet: UnitPrice, DiscountAmount, Default: { UnitPrice, ProductPriceID: null, PriceName: null } }],
    },
});

const orderSave = vi.fn(() => Promise.resolve(true));

function editor(): Editor {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as Editor;
    Object.assign(e, {
        IsLocked: false,
        DiscountRefusal: null,
        DiscountCategory: null,
        DiscountReason: '',
        EngineDefault: undefined,
        Applicable: [],
        Holding: null,
        OverrideKind: 'any',
        Products: [{ ID: 'p-1', CompanyID: 'c-1', SubscriptionTypeID: 'st-1' }, { ID: 'p-2', CompanyID: 'c-1', SubscriptionTypeID: 'st-1' }],
        Deal: { CompanyID: 'c-1', OrderID_Object: { BillToOrganizationID: 'o-1', Save: orderSave, Lines: { Items: [] } } },
        Working: {
            ID: 'l-1', ProductID: 'p-1', Quantity: 1, DiscountPct: 0.1, UnitPrice: null,
            ServicePeriodStart: null, ServicePeriodEnd: null, GetFieldByName: () => undefined,
        },
    });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => {} }, writable: true });
    for (const [k, v] of Object.entries({
        savedDiscountPct: 0.1, coveredValue: 100, pricedDiscount: null, pricePending: false,
        priceTimer: null, priceSeq: 0, priceRequest: null, coveredRequest: null, applicableSeq: 0, holdingSeq: 0,
        pricedUnit: null, pricedTotal: null,
    })) {
        Object.defineProperty(e, k, { value: v, writable: true, configurable: true });
    }
    return e;
}

const REAL_PROVIDER = Metadata.Provider;
afterEach(() => {
    Metadata.Provider = REAL_PROVIDER;
    holding.impl = () => Promise.resolve(null);
    applicable.impl = () => Promise.resolve([]);
    orderSave.mockClear();
});

function routeWith(replies: Array<Promise<unknown>>): void {
    let n = 0;
    Metadata.Provider = {
        RouteOperation: () => replies[n++],
        CurrentUser: { ID: 'u-1' },
    } as unknown as typeof Metadata.Provider;
}

describe('the line price (#355 item 16)', () => {
    it('keeps the newer ask\'s price when the older reply lands last', async () => {
        const first = deferred<unknown>();
        const second = deferred<unknown>();
        routeWith([first.promise, second.promise]);
        const e = editor();
        const older = e.refreshPrice();
        const newer = e.refreshPrice();
        second.resolve(priced(80));
        await newer;
        first.resolve(priced(500));
        await older;
        expect(e.DisplayUnitPrice).toBe(80);
        expect(e.Pricing).toBe(false);
    });
});

describe('the named prices (#355 item 17)', () => {
    it('shows the list for the quantity typed last, not the one whose reply came last', async () => {
        const forOne = deferred<unknown>();
        const forTwelve = deferred<unknown>();
        const replies = [forOne.promise, forTwelve.promise];
        let n = 0;
        applicable.impl = () => replies[n++];
        Metadata.Provider = { CurrentUser: { ID: 'u-1' } } as unknown as typeof Metadata.Provider;
        const e = editor();
        const older = e.refreshApplicable();
        if (e.Working) e.Working.Quantity = 12;
        const newer = e.refreshApplicable();
        await Promise.resolve();
        forTwelve.resolve([{ ID: 'band-12' }]);
        await newer;
        forOne.resolve([{ ID: 'band-1' }]);
        await older;
        expect(e.Applicable).toEqual([{ ID: 'band-12' }]);
    });
});

describe('the existing-subscription prompt (#355 item 18)', () => {
    it('clears the previous product\'s prompt when the product changes', () => {
        const e = editor();
        e.Holding = { LatestTermEnd: '2026-12-31' } as unknown as Editor['Holding'];
        holding.impl = () => new Promise(() => {});
        Metadata.Provider = { CurrentUser: null } as unknown as typeof Metadata.Provider;
        e.OnProductChange('p-2');
        expect(e.Holding).toBeNull();
        if (e.priceTimer) clearTimeout(e.priceTimer);
    });

    it('hides the prompt when the read fails, rather than rejecting', async () => {
        const e = editor();
        e.Holding = { LatestTermEnd: '2026-12-31' } as unknown as Editor['Holding'];
        holding.impl = () => Promise.reject(new Error('network'));
        await expect(e.refreshHolding()).resolves.toBeUndefined();
        expect(e.Holding).toBeNull();
    });

    it('drops a reply for an ask that a newer one replaced', async () => {
        const first = deferred<unknown>();
        const second = deferred<unknown>();
        const replies = [first.promise, second.promise];
        let n = 0;
        holding.impl = () => replies[n++];
        const e = editor();
        const older = e.refreshHolding();
        const newer = e.refreshHolding();
        second.resolve(null);
        await newer;
        first.resolve({ LatestTermEnd: '2026-12-31' });
        await older;
        expect(e.Holding).toBeNull();
    });
});

describe('Save waits for a pending reprice (#509)', () => {
    it('asks for a reason when the fresh price shows the discount now exceeds its concession', async () => {
        // Covered: 100. After the quantity rise orders prices the discount at 500.
        routeWith([Promise.resolve(priced(1000, 500))]);
        const e = editor();
        e.SchedulePrice();
        expect(e.CanSave).toBe(true);   // judged on the old figures, as before the fix
        await e.Save();
        expect(orderSave).not.toHaveBeenCalled();
        expect(e.NeedsDiscountReason).toBe(true);
        expect(e.BlockedReason).toMatch(/reason for the discount/);
        expect(e.Saving).toBe(false);
    });

    it('saves once the fresh price is still covered', async () => {
        routeWith([Promise.resolve(priced(1000, 100))]);
        const e = editor();
        e.SchedulePrice();
        await e.Save();
        expect(orderSave).toHaveBeenCalledTimes(1);
    });
});
