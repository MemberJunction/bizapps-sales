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
import type { DraftProductLookup, ProductLookup } from '@mj-biz-apps/sales-entities';

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
        ContainsSubscription: false,
    };
}

/**
 * `products` matching `query`, best first, with `dealCompanyID`'s products ahead of other companies'
 * within each tier. An empty query returns them all in that order. Nothing is dropped for its company:
 * a deal may sell any company's product (#29).
 *
 * Products whose company name contains the query follow the name and SKU matches, so typing "Sidecar"
 * on a Blue Cypress Consulting deal lists Sidecar's catalog: a bundle that adds another company's SKUs
 * is found by that company's name, not only by knowing each product's name.
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
    const ranked = RankCatalogMatches([...byStandIn.keys()], query, dealCompanyID).map(
        (option) => byStandIn.get(option) as ProductLookup,
    );
    return [...ranked, ...companyMatches(products, query, new Set(ranked))];
}

/** Products, by name, whose company name contains `query` and that `already` does not hold. */
function companyMatches(
    products: readonly ProductLookup[],
    query: string,
    already: ReadonlySet<ProductLookup>,
): ProductLookup[] {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return [];
    }
    return products
        .filter((p) => !already.has(p) && (p.Company ?? '').toLowerCase().includes(needle))
        .sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? ''));
}

/**
 * How many Draft products match `query` by the same rule the list uses (bc-aidp-next-golive#433).
 *
 * Zero for an empty query: with nothing typed there is no search for the hidden products to match,
 * and a count of every Draft product in the catalogue would tell the rep nothing about what they want.
 */
export function CountDraftMatches(drafts: readonly DraftProductLookup[], query: string): number {
    if (!query.trim() || !drafts.length) {
        return 0;
    }
    const asLookups = drafts.map((d): ProductLookup => ({
        ...d,
        CompanyID: '',
        Company: null,
        SubscriptionTypeID: null,
        ProductTypeID: null,
    }));
    return RankDealProducts(asLookups, query, null).length;
}
