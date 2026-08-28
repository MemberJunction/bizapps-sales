import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { OrderLineEntity } from '@mj-biz-apps/orders-entities';
import { DealWorkspaceComponent } from '../lib/workspace/deal-workspace.component';

/**
 * The product-selection half of bizapps-sales#29 — "a deal may reference products from ANY company".
 *
 * WHY THESE ARE UNIT TESTS AND NOT INTEGRATION CHECKS. Sales' integration suite proves the data tier:
 * `ProductFilterFor` no longer constrains by company (PP1–PP5), and orders' `OrderLineEntityServer`
 * derives `CompanyID` from the product at save (PP5, which sets no `CompanyID` deliberately). Neither
 * can reach a component method, so two acceptance criteria had no coverage at all:
 *
 *   - "the line's company comes from the product" — the CLIENT-side stamp in `OnProductChange`. PP5
 *     proves the server's derivation, which is the issue's OTHER option; it does not exercise this code.
 *     The stamp exists for a reason the server cannot cover: `CanSave` runs `deal.Validate()` in the
 *     browser where the server subclass does not exist, and `OrderLine.CompanyID` is NOT NULL, so an
 *     unstamped line disables Save with "Company ID cannot be null" on a form that looks complete.
 *   - "ProductLabel still resolves names for lines whose product is no longer offered" — no coverage
 *     anywhere, in any tier.
 *
 * Both were covered only by Playwright spec 80, which cannot run against a host carrying the `Root*ID`
 * metadata drift. A criterion whose only proof is a spec that cannot execute is an unproven criterion.
 *
 * The component is instantiated through `Object.create` rather than Angular DI: these two methods read
 * exactly one instance field between them (`Catalogue`) and call one other (`Touch`), so standing up an
 * injector would add ceremony without adding assurance. The real class is imported — not a copy of its
 * logic — so a change to either method reaches these tests.
 */

type Product = { ID: string; Name: string; SKU: string | null; CompanyID: string };

const SELLING_CO = 'CO-BLUE-CYPRESS';
const OTHER_CO = 'CO-ANOTHER-ENTITY';

const WIDGET: Product = { ID: 'P-1', Name: 'Widget', SKU: 'W-100', CompanyID: SELLING_CO };
const FOREIGN: Product = { ID: 'P-2', Name: 'Foreign Service', SKU: 'F-200', CompanyID: OTHER_CO };
const NO_SKU: Product = { ID: 'P-3', Name: 'Bare Product', SKU: null, CompanyID: SELLING_CO };

/** A component with a catalogue and a recording `Touch`, and nothing else it does not need. */
function componentWith(catalogue: Product[]) {
    const c = Object.create(DealWorkspaceComponent.prototype) as DealWorkspaceComponent & {
        Catalogue: Product[];
        Touch: () => void;
        Touched: number;
    };
    c.Catalogue = catalogue;
    c.Touched = 0;
    c.Touch = () => {
        c.Touched++;
    };
    return c;
}

/** A line that records `Set` the way `BaseEntity` would, so the stamp is observable. */
function lineWith(fields: Record<string, unknown> = {}) {
    const store: Record<string, unknown> = { ProductID: null, CompanyID: null, ...fields };
    return {
        get ProductID() {
            return store['ProductID'] as string | null;
        },
        set ProductID(v: string | null) {
            store['ProductID'] = v;
        },
        Set(field: string, value: unknown) {
            store[field] = value;
        },
        Get(field: string) {
            return store[field];
        },
    } as unknown as OrderLineEntity & { Get(f: string): unknown };
}

/** How many times the component marked the deal dirty. */
function touched(c: unknown): number {
    return (c as { Touched: number }).Touched;
}

describe('#29 — ProductLabel resolves names across the whole catalogue', () => {
    it('PL1: shows name and SKU for a product that is still offered', () => {
        const c = componentWith([WIDGET, FOREIGN]);
        expect(c.ProductLabel(lineWith({ ProductID: 'P-1' }))).toBe('Widget (W-100)');
    });

    it('PL2: shows a FOREIGN-company product by name, not as unknown — the point of #29', () => {
        // Before #29 the catalogue was filtered to the deal's company, so a line booked against another
        // company's product read as "(no longer offered)" even though it was perfectly sellable.
        const c = componentWith([WIDGET, FOREIGN]);
        expect(c.ProductLabel(lineWith({ ProductID: 'P-2' }))).toBe('Foreign Service (F-200)');
    });

    it('PL3: falls back to the bare name when the product has no SKU', () => {
        const c = componentWith([NO_SKU]);
        expect(c.ProductLabel(lineWith({ ProductID: 'P-3' }))).toBe('Bare Product');
    });

    it('PL4: says a withdrawn product is no longer offered rather than reading as unset', () => {
        // The acceptance criterion with no coverage in any other tier. A line quoted against a product
        // that has since been discontinued must not render blank -- blank reads as "no product chosen",
        // which is a different and recoverable state. The rep needs to know the line references
        // something that can no longer be sold.
        const c = componentWith([WIDGET]);
        expect(c.ProductLabel(lineWith({ ProductID: 'P-GONE' }))).toBe('(no longer offered)');
    });

    it('PL5: renders empty for a line with no product at all', () => {
        const c = componentWith([WIDGET]);
        expect(c.ProductLabel(lineWith({ ProductID: null }))).toBe('');
    });
});

describe("#29 — OnProductChange stamps the line's company from the PRODUCT", () => {
    it('PC1: a same-company product stamps that company', () => {
        const c = componentWith([WIDGET, FOREIGN]);
        const line = lineWith();
        c.OnProductChange(line, 'P-1');
        expect(line.ProductID).toBe('P-1');
        expect(line.Get('CompanyID')).toBe(SELLING_CO);
    });

    it("PC2: a FOREIGN-company product stamps the PRODUCT's company, not the deal's", () => {
        // The heart of #29. The stamp must follow the product across the company boundary; a line that
        // kept the deal's company would fail `Validate()` in the browser against a form that looks
        // complete, which is the defect the old per-company stamp existed to prevent.
        const c = componentWith([WIDGET, FOREIGN]);
        const line = lineWith({ CompanyID: SELLING_CO });
        c.OnProductChange(line, 'P-2');
        expect(line.Get('CompanyID')).toBe(OTHER_CO);
    });

    it('PC3: re-picking back to a same-company product moves the stamp back', () => {
        // Guards against a stamp written once and then never corrected -- a rep who picks the foreign
        // product by mistake and fixes it must not leave the line booked to the wrong company.
        const c = componentWith([WIDGET, FOREIGN]);
        const line = lineWith();
        c.OnProductChange(line, 'P-2');
        expect(line.Get('CompanyID')).toBe(OTHER_CO);
        c.OnProductChange(line, 'P-1');
        expect(line.Get('CompanyID')).toBe(SELLING_CO);
    });

    it('PC4: a null selection is ignored — the product cannot be cleared', () => {
        // `OrderLine.ProductID` is NOT NULL with a real FK. Refusing here beats a database error naming
        // a constraint; the way to express "this line should not exist" is RemoveLine.
        const c = componentWith([WIDGET]);
        const line = lineWith({ ProductID: 'P-1', CompanyID: SELLING_CO });
        c.OnProductChange(line, null);
        expect(line.ProductID).toBe('P-1');
        expect(line.Get('CompanyID')).toBe(SELLING_CO);
        expect(touched(c)).toBe(0);
    });

    it('PC5: an unknown product sets the ID but leaves the company alone rather than blanking it', () => {
        // The server still stamps `CompanyID` from the product at save, so a value we cannot improve on
        // is better left than cleared -- blanking it would turn a display gap into a NOT NULL failure
        // that disables Save.
        const c = componentWith([WIDGET]);
        const line = lineWith({ CompanyID: SELLING_CO });
        c.OnProductChange(line, 'P-GONE');
        expect(line.ProductID).toBe('P-GONE');
        expect(line.Get('CompanyID')).toBe(SELLING_CO);
    });

    it('PC6: a real selection marks the deal dirty', () => {
        const c = componentWith([WIDGET]);
        c.OnProductChange(lineWith(), 'P-1');
        expect(touched(c)).toBe(1);
    });
});
