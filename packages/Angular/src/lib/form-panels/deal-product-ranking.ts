/**
 * @fileoverview Ranks the deal line editor's products with orders' own ranking (golive#360).
 *
 * The order screen's add-product box and this one must agree on what "best match" means, so the rule
 * is orders' `RankCatalogMatches`, not a second copy here: a name that starts with the text, then a SKU
 * that does, then either containing it, with the selling company first within each tier.
 *
 * The orders-ng release sales builds against types that function's rows as the full
 * `MJOProductOption`, which a deal's `ProductLookup` is not. It reads only `Name`, `SKU` and
 * `CompanyID`, so each lookup row is carried through the ranking beside a stand-in holding those three,
 * and the ranked order is read back by reference. Once sales takes an orders-ng whose ranker accepts
 * any row with those fields, pass `products` straight in and delete the stand-ins.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { RankCatalogMatches, type MJOProductOption } from '@mj-biz-apps/orders-ng';
import type { ProductLookup } from '@mj-biz-apps/sales-entities';

/** A ranking stand-in: the three fields the ranker reads, and inert values for the rest. */
function standIn(p: ProductLookup): MJOProductOption {
    return {
        ID: p.ID,
        Name: p.Name ?? '',
        SKU: p.SKU ?? '',
        CompanyID: p.CompanyID ?? '',
        CompanyName: p.Company ?? '',
        TypeName: '',
        ProductTypeID: '',
        OrderLineExtensionEntity: null,
        ListPrice: null,
        Taxable: false,
        MaxQuantityPerLine: null,
        SubscriptionTypeID: p.SubscriptionTypeID ?? null,
    };
}

/**
 * `products` matching `query`, best first, with `dealCompanyID`'s products ahead of other companies'
 * within each tier. An empty query returns them all in that order. Nothing is dropped for its company:
 * a deal may sell any company's product (#29).
 */
export function RankDealProducts(
    products: readonly ProductLookup[],
    query: string,
    dealCompanyID: string | null,
): ProductLookup[] {
    const byStandIn = new Map<MJOProductOption, ProductLookup>();
    for (const p of products) {
        byStandIn.set(standIn(p), p);
    }
    return RankCatalogMatches([...byStandIn.keys()], query, dealCompanyID).map(
        (option) => byStandIn.get(option) as ProductLookup,
    );
}
