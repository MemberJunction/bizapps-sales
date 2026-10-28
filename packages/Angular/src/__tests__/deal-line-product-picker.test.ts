import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { ProductLookup } from '@mj-biz-apps/sales-entities';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';
import { RankDealProducts } from '../lib/form-panels/deal-product-ranking';

/**
 * golive#360: the deal's Add a product was a plain list of every product in the catalogue, with no
 * search and no sign of which company a product belongs to. It is now a type-ahead ranked by orders'
 * own rule, the deal's company first, and a product from another company carries a warning.
 */

const SOUNDPOST = 'aaaaaaaa-0000-4000-8000-000000000001';
const BETTY = 'bbbbbbbb-0000-4000-8000-000000000002';

function product(over: Partial<ProductLookup> & { ID: string; Name: string }): ProductLookup {
    return { SKU: null, CompanyID: SOUNDPOST, Company: 'SoundPost', SubscriptionTypeID: null, ...over } as ProductLookup;
}

const CATALOG: ProductLookup[] = [
    product({ ID: 'p1', Name: 'Betty.Core Under $1M', CompanyID: BETTY, Company: 'Betty' }),
    product({ ID: 'p2', Name: 'SoundPost Core $10M-$15M', SKU: 'SP-CORE-10' }),
    product({ ID: 'p3', Name: 'Core Listing', SKU: 'SP-LIST' }),
    product({ ID: 'p4', Name: 'Core Bot', CompanyID: BETTY, Company: 'Betty', SKU: 'BB-CORE' }),
];

const ids = (rows: ProductLookup[]): string[] => rows.map((r) => r.ID);

describe('RankDealProducts', () => {
    it("puts the deal's company first when nothing is typed, and keeps the others", () => {
        expect(ids(RankDealProducts(CATALOG, '', SOUNDPOST))).toEqual(['p3', 'p2', 'p1', 'p4']);
    });

    it('ranks a name that starts with the text above one that only contains it', () => {
        expect(ids(RankDealProducts(CATALOG, 'core', SOUNDPOST))).toEqual(['p3', 'p4', 'p2', 'p1']);
    });

    it('finds a product by SKU', () => {
        expect(ids(RankDealProducts(CATALOG, 'sp-list', SOUNDPOST))).toEqual(['p3']);
    });

    it('returns the lookup rows themselves, not copies', () => {
        expect(RankDealProducts(CATALOG, 'listing', SOUNDPOST)[0]).toBe(CATALOG[2]);
    });
});

function editor(productID: string) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    e.Products = CATALOG;
    Object.defineProperty(e, 'Working', { value: { ProductID: productID }, writable: true, configurable: true });
    Object.defineProperty(e, 'Deal', {
        value: { CompanyID: SOUNDPOST, Company: 'SoundPost' },
        writable: true, configurable: true,
    });
    return e;
}

describe('the warning for another company\'s product', () => {
    it('names the owner and where the revenue books', () => {
        expect(editor('p1').ForeignCompanyWarning).toBe(
            "Sold by Betty, not this deal's company (SoundPost). This line's revenue books to Betty.",
        );
    });

    it("says nothing for the deal's own company", () => {
        expect(editor('p3').ForeignCompanyWarning).toBeNull();
    });

    it('says nothing before a product is chosen', () => {
        expect(editor('').ForeignCompanyWarning).toBeNull();
    });
});
