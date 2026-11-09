import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    MJSDealLineCardsComponent,
    type DealLineCardProduct,
    type DealLineCardRow,
} from '../lib/form-panels/deal-line-cards.component';

/**
 * "WHAT'S BEING SOLD" AS CARDS, LIKE THE ORDER FORM'S LINES.
 *
 * The display rules are asserted on the component's methods with its loader bypassed; the one template
 * rule that matters to money (no figure is computed in the template) is asserted on source.
 */

function line(over: Partial<DealLineCardRow> = {}): DealLineCardRow {
    return {
        ID: 'line-1',
        ProductID: 'prod-1',
        Product: 'Institutional Membership',
        CompanyID: 'co-1',
        Company: 'Example Co',
        Quantity: 1,
        UnitPrice: 1200,
        LineTotalNet: 1200,
        DiscountPct: 0,
        PriceOverridden: false,
        PriceOverrideReason: null,
        ProductPrice: null,
        ServicePeriodStart: null,
        OrderHeaderID: 'order-1',
        ProductPriceID: null,
        RenewsSubscriptionID: null,
        ...over,
    };
}

function cards(products: DealLineCardProduct[], dealCompanyID: string | null = 'co-1'): MJSDealLineCardsComponent {
    const c = Object.create(MJSDealLineCardsComponent.prototype) as MJSDealLineCardsComponent;
    Object.defineProperty(c, 'products', { value: new Map(products.map((p) => [p.ID, p])), writable: true });
    c.Deal = { CompanyID: dealCompanyID, OrderID_Object: { OrderDate: '2026-10-15' } } as unknown as MJSDealLineCardsComponent['Deal'];
    c.Locked = false;
    return c;
}

const PRODUCT: DealLineCardProduct = { ID: 'prod-1', SKU: 'MEM-INST', ProductType: 'Membership', IsTaxable: true, SubscriptionTypeID: null };

describe('the card names the product the way the order form does', () => {
    it('shows SKU and type under the name', () => {
        expect(cards([PRODUCT]).MetaFor(line())).toBe('MEM-INST · Membership');
    });

    it('leaves out a missing SKU rather than printing a separator with nothing beside it', () => {
        expect(cards([{ ...PRODUCT, SKU: null }]).MetaFor(line())).toBe('Membership');
    });

    it('still renders a line whose product could not be read', () => {
        expect(cards([]).MetaFor(line())).toBe('');
    });
});

describe('the discount pill', () => {
    it('shows the stored fraction as the percent the rep entered', () => {
        expect(cards([PRODUCT]).DiscountPercent(line({ DiscountPct: 0.1 }))).toBe(10);
    });

    it('hides when there is no discount', () => {
        expect(cards([PRODUCT]).DiscountPercent(line({ DiscountPct: 0 }))).toBeNull();
        expect(cards([PRODUCT]).DiscountPercent(line({ DiscountPct: null }))).toBeNull();
    });
});

describe('the chips', () => {
    it('flags an untaxable product', () => {
        const c = cards([{ ...PRODUCT, IsTaxable: false }]);
        expect(c.HasChips(line())).toBe(true);
    });

    it('flags revenue that books to another company, compared by ID', () => {
        expect(cards([PRODUCT], 'co-2').BooksElsewhere(line())).toBe(true);
        expect(cards([PRODUCT], 'co-1').BooksElsewhere(line())).toBe(false);
    });

    it('treats an unset taxability as untaxable, as the order form does', () => {
        expect(cards([{ ...PRODUCT, IsTaxable: null }]).IsUntaxable(line())).toBe(true);
    });

    it('makes no taxability claim about a product it could not read', () => {
        expect(cards([]).IsUntaxable(line())).toBe(false);
    });

    it('shows none for a taxable, same-company, one-off product', () => {
        expect(cards([PRODUCT]).HasChips(line())).toBe(false);
    });
});

describe('the term start', () => {
    const SUB: DealLineCardProduct = { ...PRODUCT, SubscriptionTypeID: 'sub-type-1' };

    it('shows on a subscription line, following the order date when the line states none', () => {
        const c = cards([SUB]);
        expect(c.ShowsTermStart(line())).toBe(true);
        expect(c.HasOwnTermStart(line())).toBe(false);
        expect(c.TermStartDay(line())).toBe('2026-10-15');
    });

    it('shows the line\'s own date when it states one', () => {
        const c = cards([SUB]);
        const stated = line({ ServicePeriodStart: '2026-11-01T00:00:00Z' });
        expect(c.HasOwnTermStart(stated)).toBe(true);
        expect(c.TermStartDay(stated)).toBe('2026-11-01');
    });

    it('does not show on a one-off product', () => {
        expect(cards([PRODUCT]).ShowsTermStart(line())).toBe(false);
    });

    it('does not call an event line\'s stored dates a term start', () => {
        expect(cards([PRODUCT]).ShowsTermStart(line({ ServicePeriodStart: '2027-04-15' }))).toBe(false);
    });
});

describe('a locked deal', () => {
    it('does not ask to edit a line', () => {
        const c = cards([PRODUCT]);
        c.Locked = true;
        const asked: string[] = [];
        c.Edit = { emit: (id: string) => asked.push(id) } as unknown as MJSDealLineCardsComponent['Edit'];
        c.OpenLine(line());
        expect(asked).toEqual([]);
    });
});

describe('the cards compute no money (rule 1)', () => {
    const src = readFileSync(new URL('../lib/form-panels/deal-line-cards.component.ts', import.meta.url), 'utf8');
    const template = src.slice(src.indexOf('template: `'), src.indexOf('styles: ['));

    it('displays the unit price and line total orders stored, through the display formatter only', () => {
        expect(template).toContain('Money(line.UnitPrice)');
        expect(template).toContain('Money(line.LineTotalNet)');
        expect(template).not.toMatch(/Quantity\s*\*|\*\s*line\.UnitPrice/);
    });
});

describe('the concession line on a discounted card (golive#340)', () => {
    function withState(state: string | null) {
        const c = cards([PRODUCT]);
        Object.defineProperty(c, 'concessionStates', { value: new Map(state ? [['line-1', state]] : []), writable: true });
        return c;
    }

    it('says a concession waits for approval, with no retry', () => {
        expect(withState('Pending').ConcessionBadge(line({ DiscountPct: 0.1 }))).toMatchObject({ Retry: false, Tone: 'pending' });
    });

    it('offers Record again for a rejected or unrecorded discount', () => {
        expect(withState('Rejected').ConcessionBadge(line({ DiscountPct: 0.1 }))).toMatchObject({ Label: 'Discount rejected', Retry: true });
        expect(withState('NotRecorded').ConcessionBadge(line({ DiscountPct: 0.1 }))).toMatchObject({ Retry: true });
    });

    it('says nothing for an approved discount, a line orders does not value, or an unknown one', () => {
        for (const state of ['Approved', 'NotNeeded', 'Unknown', null]) {
            expect(withState(state).ConcessionBadge(line({ DiscountPct: 0.1 }))).toBeNull();
        }
    });

    it('Record again opens the editor on the line', () => {
        const c = withState('Rejected');
        const opened: string[] = [];
        Object.defineProperty(c, 'Edit', { value: { emit: (id: string) => opened.push(id) } });
        c.RecordAgain(line());
        expect(opened).toEqual(['line-1']);
    });
});
