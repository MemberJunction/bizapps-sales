/**
 * @fileoverview A product's subscription type as orders' confirm resolves it (golive #339).
 *
 * A product either names its subscription type or inherits its product type's
 * `DefaultSubscriptionTypeID`. Confirm honors both and builds a term either way. Read only from the
 * product's own column, an inheriting product looks like a one-time sale: the deal line shows no term
 * start and never asks whether it extends a subscription the customer already holds, and confirm then
 * makes that choice by itself.
 *
 * @module @mj-biz-apps/sales-entities
 */
import { RunView, type IRunViewProvider, type UserInfo } from '@memberjunction/core';

export const E_ORDERS_PRODUCT_TYPE = 'MJ_BizApps_Orders: Product Types';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The two columns the resolution reads. */
export interface SubscriptionTypeSource {
    SubscriptionTypeID: string | null;
    ProductTypeID: string | null;
}

/**
 * Fills each product's `SubscriptionTypeID` from its product type's default when the product names
 * none, in place, and returns the same rows. One read, and only when some product inherits.
 *
 * Throws when the product types cannot be read. Leaving the column empty would present every
 * inheriting product as a one-time sale, which is the silent outcome this exists to prevent.
 */
export async function WithInheritedSubscriptionType<T extends SubscriptionTypeSource>(
    products: T[],
    provider?: IRunViewProvider,
    user?: UserInfo,
): Promise<T[]> {
    const inheriting = products.filter((p) => !p.SubscriptionTypeID?.trim() && UUID_PATTERN.test(p.ProductTypeID ?? ''));
    if (inheriting.length === 0) return products;

    const typeIDs = [...new Set(inheriting.map((p) => (p.ProductTypeID as string).toLowerCase()))];
    const result = await new RunView(provider).RunView<{ ID: string; DefaultSubscriptionTypeID: string | null }>(
        {
            EntityName: E_ORDERS_PRODUCT_TYPE,
            ExtraFilter: `ID IN (${typeIDs.map((id) => `'${id}'`).join(',')})`,
            Fields: ['ID', 'DefaultSubscriptionTypeID'],
            ResultType: 'simple',
        },
        user,
    );
    if (!result?.Success) {
        throw new Error(`Could not read the product types' subscription defaults: ${result?.ErrorMessage ?? 'no result'}`);
    }
    const defaults = new Map(result.Results.map((t) => [t.ID.toLowerCase(), t.DefaultSubscriptionTypeID?.trim() || null]));
    for (const p of inheriting) {
        p.SubscriptionTypeID = defaults.get((p.ProductTypeID as string).toLowerCase()) ?? null;
    }
    return products;
}
