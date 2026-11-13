import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import type { DraftProductLookup, ProductLookup } from '@mj-biz-apps/sales-entities';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';
import { CountDraftMatches, RankDealProducts } from '../lib/form-panels/deal-product-ranking';

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

    it("finds another company's products by that company's name, after name and SKU matches", () => {
        expect(ids(RankDealProducts(CATALOG, 'betty', SOUNDPOST))).toEqual(['p1', 'p4']);
        // "Betty.Core" matches by name; "Core Bot" only by its company, so it comes after.
        expect(ids(RankDealProducts(CATALOG, 'betty.', SOUNDPOST))).toEqual(['p1']);
        expect(ids(RankDealProducts(CATALOG, 'soundpost', BETTY))).toEqual(['p2', 'p3']);
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

/**
 * golive#433: a product created in orders starts as Draft, and the picker offers only Active ones. A
 * rep who searched for the product they had just made found nothing and could not tell why, so the
 * list now says how many Draft products match and where to activate them.
 */
const DRAFTS: DraftProductLookup[] = [
    { ID: 'd1', Name: 'Core Analytics Add-on', SKU: 'SP-ANALYTICS' },
    { ID: 'd2', Name: 'Premium Support', SKU: 'SP-CORE-SUPPORT' },
];

describe('CountDraftMatches', () => {
    it('counts by the list\'s own rule: a name or a SKU containing the text', () => {
        expect(CountDraftMatches(DRAFTS, 'core')).toBe(2);
        expect(CountDraftMatches(DRAFTS, 'premium')).toBe(1);
        expect(CountDraftMatches(DRAFTS, 'betty')).toBe(0);
    });

    it('counts nothing when nothing is typed, since there is no search to match', () => {
        expect(CountDraftMatches(DRAFTS, '')).toBe(0);
        expect(CountDraftMatches(DRAFTS, '   ')).toBe(0);
    });
});

/** An editor with the catalogue and the Draft rows in place, the list closed. */
function searchingEditor(drafts: DraftProductLookup[]) {
    const e = editor('');
    Object.assign(e, { draftProducts: drafts, PickerOpen: false });
    return e;
}

describe('the note for Draft products the search matches', () => {
    it('shows beside Active matches, not only when none match', () => {
        const e = searchingEditor(DRAFTS);
        e.OnProductQuery('core');
        expect(e.PickerResults.length).toBeGreaterThan(0);
        expect(e.DraftMatchNote).toBe(
            '2 Draft products match but cannot be sold yet. Activate them in Orders → Catalog to add them here.',
        );
    });

    it('shows when no Active product matches, in the singular for one', () => {
        const e = searchingEditor(DRAFTS);
        e.OnProductQuery('premium');
        expect(e.PickerResults).toEqual([]);
        expect(e.DraftMatchNote).toBe(
            '1 Draft product matches but cannot be sold yet. Activate it in Orders → Catalog to add it here.',
        );
    });

    it('says nothing when no Draft product matches, or nothing is typed', () => {
        const e = searchingEditor(DRAFTS);
        e.OnProductQuery('betty');
        expect(e.DraftMatchNote).toBeNull();
        e.OnProductQuery('');
        expect(e.DraftMatchNote).toBeNull();
    });

    it('counts Draft rows that arrive after the rep has started typing', async () => {
        const e = searchingEditor([]);
        const detectChanges = vi.fn();
        Object.assign(e, {
            service: { LoadDraftProducts: async () => DRAFTS },
            cdr: { detectChanges },
        });
        e.OnProductQuery('core');
        expect(e.DraftMatchNote).toBeNull();

        await (e as unknown as { loadDraftProducts(): Promise<void> }).loadDraftProducts();

        expect(e.DraftMatches).toBe(2);
        expect(detectChanges).toHaveBeenCalled();
    });

    it('leaves the note off when the Draft read fails, and the list still works', async () => {
        const e = searchingEditor([]);
        Object.assign(e, {
            service: { LoadDraftProducts: async () => { throw new Error('network down'); } },
            cdr: { detectChanges: vi.fn() },
        });
        e.OnProductQuery('core');

        await (e as unknown as { loadDraftProducts(): Promise<void> }).loadDraftProducts();

        expect(e.DraftMatchNote).toBeNull();
        expect(e.PickerResults.length).toBeGreaterThan(0);
    });
});
