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

type Product = { ID: string; Name: string; SKU: string | null; CompanyID: string; Company: string | null };

const SELLING_CO = 'CO-BLUE-CYPRESS';
const OTHER_CO = 'CO-ANOTHER-ENTITY';

const WIDGET: Product = { ID: 'P-1', Name: 'Widget', SKU: 'W-100', CompanyID: SELLING_CO, Company: 'Blue Cypress' };
const FOREIGN: Product = { ID: 'P-2', Name: 'Foreign Service', SKU: 'F-200', CompanyID: OTHER_CO, Company: 'Betty' };
const NO_SKU: Product = { ID: 'P-3', Name: 'Bare Product', SKU: null, CompanyID: SELLING_CO, Company: 'Blue Cypress' };

/** A component with a catalogue and a recording `Touch`, and nothing else it does not need. */
function componentWith(catalogue: Product[]) {
    const c = Object.create(DealWorkspaceComponent.prototype) as DealWorkspaceComponent & {
        Catalogue: Product[];
        Touch: () => void;
        Touched: number;
    };
    c.Catalogue = catalogue;
    /**
     * `ActiveCompanyID` is a getter on the prototype reading `Deal` and `Lookups`, both of which are
     * getters too — so they cannot be assigned. Shadowing the one the code actually calls keeps the test
     * coupled to the contract (`OnProductChange` falls back to the active company) rather than to the
     * two hops it currently takes to compute it.
     */
    Object.defineProperty(c, 'ActiveCompanyID', { value: SELLING_CO, configurable: true });
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

describe('#29 — the picker names each product\'s owner', () => {
    /**
     * Before #29 the catalogue was scoped to one company, so name-plus-SKU identified a product to a
     * reader. It does not any more. Two companies can each sell an "Onboarding Fee", and `SKU` is
     * nullable with only a FILTERED unique index, so a rep faced two identical rows — and which one
     * they picked decided whose books the revenue landed in.
     */
    const c = () => componentWith([]);

    it('OL1: shows the owning company alongside the product', () => {
        expect(c().ProductOptionLabel(WIDGET)).toBe('Widget (W-100) — Blue Cypress');
    });

    it('OL2: two same-named, SKU-less products from different companies are distinguishable', () => {
        const a = { ID: 'x', Name: 'Onboarding Fee', SKU: null, CompanyID: SELLING_CO, Company: 'Blue Cypress' };
        const b = { ID: 'y', Name: 'Onboarding Fee', SKU: null, CompanyID: OTHER_CO, Company: 'Betty' };
        expect(
            c().ProductOptionLabel(a),
            'identical labels here mean the rep is guessing which company they are selling for',
        ).not.toBe(c().ProductOptionLabel(b));
    });

    it('OL3: keeps the SKU, which is what separates two products WITHIN a company', () => {
        expect(c().ProductOptionLabel(WIDGET)).toContain('(W-100)');
    });

    it('OL4: falls back to the bare name when the view returns no company', () => {
        // `Company` is a virtual field; a caller that forgets it in Fields gets null rather than a crash.
        const orphan = { ID: 'z', Name: 'Orphan', SKU: null, CompanyID: SELLING_CO, Company: null };
        expect(c().ProductOptionLabel(orphan)).toBe('Orphan');
    });
});

describe('#29 — a line is never invalid for a reason the form cannot show', () => {
    /**
     * ── THE DEFECT THIS EXISTS FOR ────────────────────────────────────────────────────────────────
     *
     * #29 deleted `AddLine`'s `CompanyID` stamp, reasoning that the line's company is the PRODUCT's and
     * no product is chosen yet. `OrderLine.CompanyID` is NOT NULL and `CanSave` gates on
     * `deal.Validate()`, which runs in the browser — so a freshly added line was invalid immediately,
     * and `SaveBlockedReason` surfaced the raw entity error ahead of the friendly one. The rep read
     * "Company ID cannot be null" against a form with no company control anywhere on it.
     *
     * The disabled Save is CORRECT while no product is chosen — "Choose a product for this line" is the
     * right message. What was wrong is that a second, unactionable error preceded it.
     *
     * No check caught this: the integration suite writes lines server-side where the stamp exists, and
     * every unit fixture seeded `CompanyID` by hand. It took a line-by-line audit. This is the guard.
     */
    function addLineHarness() {
        const stamped: Record<string, unknown> = {};
        const line = { Set: (f: string, v: unknown) => { stamped[f] = v; } };
        const order = { Set: () => undefined, Lines: { Create: async () => line }, IsSaved: true };
        const c = Object.create(DealWorkspaceComponent.prototype) as DealWorkspaceComponent;
        Object.defineProperty(c, 'Deal', { value: { OrderID_EnsureObject: () => order }, configurable: true });
        Object.defineProperty(c, 'ActiveCompanyID', { value: SELLING_CO, configurable: true });
        (c as unknown as { Touch(): void }).Touch = () => undefined;
        return { c, stamped };
    }

    it('AL1: a newly added line carries a company, so Save is never blocked on an invisible field', async () => {
        const { c, stamped } = addLineHarness();
        await c.AddLine();
        expect(
            stamped['CompanyID'],
            'a null here is the "Company ID cannot be null" defect, on a form with no company control',
        ).toBe(SELLING_CO);
    });

    it('AL2: and that company is a PLACEHOLDER the product later overrides', async () => {
        // The stamp must not re-assert the pre-#29 claim that the deal's company IS the line's. It is a
        // stand-in that keeps the line valid; picking a product replaces it with the product's company.
        const { c, stamped } = addLineHarness();
        await c.AddLine();
        expect(stamped['CompanyID']).toBe(SELLING_CO);

        const picker = componentWith([WIDGET, FOREIGN]);
        const line = lineWith({ CompanyID: SELLING_CO });
        picker.OnProductChange(line, 'P-2');
        expect(line.Get('CompanyID'), 'the product wins over the placeholder').toBe(OTHER_CO);
    });
});

describe('#29 — the picker list keeps a stable identity when it is empty', () => {
    it('AL3: an unloaded catalogue returns the SAME array each read, not a fresh one', () => {
        /**
         * The frozen-empty constant exists so Angular's `@for` does not tear down and rebuild the picker
         * on every change-detection pass. An audit measured that replacing it with a fresh `[]` per call
         * — the exact regression it prevents — left the suite green, because nothing ever read `Products`
         * with an empty catalogue.
         */
        const c = componentWith([]);
        expect(c.Products, 'two reads must be the same array object').toBe(c.Products);
        expect(c.Products).toHaveLength(0);
    });
});

describe('#29 — ProductLabel resolves names across the whole catalogue', () => {
    it('PL1: shows name and SKU for a product that is still offered', () => {
        const c = componentWith([WIDGET, FOREIGN]);
        expect(c.ProductLabel(lineWith({ ProductID: 'P-1' }))).toBe('Widget (W-100)');
    });

    it('PL2: an UNLOADED catalogue does not claim a valid product was withdrawn', () => {
        /**
         * ── WHAT THIS CHECK USED TO BE, AND WHY IT WAS WORTHLESS ──────────────────────────────
         *
         * It rendered a foreign-company product and asserted the label came back — billed as "the point
         * of #29". An audit measured it: setting the fixture's foreign product to the SELLING company,
         * so nothing about it was foreign at all, left the check green. `ProductLabel` and the
         * `Products` getter read no `CompanyID` anywhere, and `ProductLabel` is byte-identical to the
         * version before #29. There was no mutation that failed it without also failing PL1.
         *
         * The real hazard in this method is the one below. `Products` returns a frozen empty whenever
         * `Catalogue` is empty, and empty has three causes: not loaded yet, load failed, and genuinely
         * no products. `ProductLabel` collapses all three into a positive, specific, FALSE claim about
         * the product on the line.
         */
        const c = componentWith([]);
        expect(
            c.ProductLabel(lineWith({ ProductID: 'P-1' })),
            'an empty catalogue means we do not know, not that the product was withdrawn',
        ).not.toBe('(no longer offered)');
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

    it('PC5: an unknown product falls back to a company rather than leaving the line unsaveable', () => {
        /**
         * ── THIS CHECK USED TO PASS WITH THE ENTIRE FIX DELETED ───────────────────────────────
         *
         * It seeded `CompanyID` by hand and asserted the value was still there afterwards, which cannot
         * distinguish "the code deliberately declined to write" from "the code does not exist". An audit
         * measured it: removing the whole stamp block from `OnProductChange` killed PC1, PC2 and PC3 and
         * left this one green.
         *
         * It now starts from NULL, which is the state a real line is in, and asserts the line ends up
         * saveable. A product can be missing from the catalogue for reasons unrelated to the product --
         * a refresh resolving empty while the picker is open -- and leaving null there is unrecoverable,
         * because re-selecting the same option emits no change event.
         */
        const c = componentWith([WIDGET]);
        const line = lineWith({ CompanyID: null });
        c.OnProductChange(line, 'P-GONE');
        expect(line.ProductID).toBe('P-GONE');
        expect(
            line.Get('CompanyID'),
            'a null company here is a line the rep can only escape by deleting it',
        ).toBe(SELLING_CO);
    });

    it('PC7: a known product still wins over the fallback', () => {
        // Guards the fallback from swallowing the real rule: the product's company must take priority.
        const c = componentWith([WIDGET, FOREIGN]);
        const line = lineWith({ CompanyID: null });
        c.OnProductChange(line, 'P-2');
        expect(line.Get('CompanyID')).toBe(OTHER_CO);
    });

    it('PC6: a real selection marks the deal dirty', () => {
        const c = componentWith([WIDGET]);
        c.OnProductChange(lineWith(), 'P-1');
        expect(touched(c)).toBe(1);
    });
});
