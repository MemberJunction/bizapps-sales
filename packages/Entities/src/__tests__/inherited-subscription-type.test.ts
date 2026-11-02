import { describe, expect, it, vi } from 'vitest';
import type { IRunViewProvider, RunViewParams } from '@memberjunction/core';
import { E_ORDERS_PRODUCT_TYPE, WithInheritedSubscriptionType } from '../inherited-subscription-type';
import { IsSubscriptionProduct } from '../term-start';

/**
 * A product naming no subscription type inherits its product type's default, as orders' confirm
 * resolves it (golive #339). Read from the product alone, such a line offered no term start and was
 * never asked whether it extends a subscription the customer holds.
 */
const SUBSCRIPTION_TYPE = '11111111-1111-4111-8111-111111111111';
const MERCH_TYPE = '22222222-2222-4222-8222-222222222222';

function provider(rows: unknown[], fail = false): IRunViewProvider & { RunView: ReturnType<typeof vi.fn> } {
    return {
        RunView: vi.fn(async () => (fail ? { Success: false, Results: [], ErrorMessage: 'boom' } : { Success: true, Results: rows })),
    } as unknown as IRunViewProvider & { RunView: ReturnType<typeof vi.fn> };
}

const types = [
    { ID: SUBSCRIPTION_TYPE, DefaultSubscriptionTypeID: 'annual' },
    { ID: MERCH_TYPE, DefaultSubscriptionTypeID: null },
];

describe('WithInheritedSubscriptionType', () => {
    it("fills a product's missing type from its product type's default, and keeps its own", async () => {
        const products = [
            { ID: 'inherits', SubscriptionTypeID: null, ProductTypeID: SUBSCRIPTION_TYPE },
            { ID: 'own', SubscriptionTypeID: 'monthly', ProductTypeID: SUBSCRIPTION_TYPE },
            { ID: 'merch', SubscriptionTypeID: null, ProductTypeID: MERCH_TYPE },
        ];
        await WithInheritedSubscriptionType(products, provider(types));
        expect(products.map((p) => p.SubscriptionTypeID)).toEqual(['annual', 'monthly', null]);
        expect(products.map((p) => IsSubscriptionProduct(p))).toEqual([true, true, false]);
    });

    it('reads the product types once, and not at all when every product names its own', async () => {
        const p = provider(types);
        await WithInheritedSubscriptionType([{ SubscriptionTypeID: 'monthly', ProductTypeID: SUBSCRIPTION_TYPE }], p);
        expect(p.RunView).not.toHaveBeenCalled();

        await WithInheritedSubscriptionType(
            [
                { SubscriptionTypeID: null, ProductTypeID: SUBSCRIPTION_TYPE },
                { SubscriptionTypeID: '', ProductTypeID: SUBSCRIPTION_TYPE.toUpperCase() },
            ],
            p,
        );
        expect(p.RunView).toHaveBeenCalledTimes(1);
        const params = p.RunView.mock.calls[0][0] as RunViewParams;
        expect(params.EntityName).toBe(E_ORDERS_PRODUCT_TYPE);
        expect(params.ExtraFilter).toBe(`ID IN ('${SUBSCRIPTION_TYPE}')`);
    });

    it('throws when the product types cannot be read rather than calling the product one-time', async () => {
        await expect(
            WithInheritedSubscriptionType([{ SubscriptionTypeID: null, ProductTypeID: SUBSCRIPTION_TYPE }], provider([], true)),
        ).rejects.toThrow(/boom/);
    });
});
