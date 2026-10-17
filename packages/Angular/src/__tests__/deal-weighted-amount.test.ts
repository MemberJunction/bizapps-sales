import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { WeightedAmount } from '../lib/form-panels/deal-weighted-amount';
import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';

/**
 * A deal with no amount, or no probability, showed Weighted "$0" next to Amount "—".
 *
 * Both panels turned each input into a number before checking whether it was missing, and `Number(null)`
 * is 0. The weighted figure is now one helper the hero and the Overview share, so the two copies cannot
 * drift apart again.
 */
describe('WeightedAmount', () => {
    it('is null when both inputs are missing', () => {
        expect(WeightedAmount(null, null)).toBeNull();
        expect(WeightedAmount(undefined, undefined)).toBeNull();
    });

    it('is null when either input is missing', () => {
        expect(WeightedAmount(null, 50)).toBeNull();
        expect(WeightedAmount(1000, null)).toBeNull();
    });

    it('weights the amount by the probability percent when both are present', () => {
        expect(WeightedAmount(1000, 25)).toBe(250);
    });

    it('treats a probability of 0 as a real value', () => {
        expect(WeightedAmount(1000, 0)).toBe(0);
    });
});

const deal = (amount: number | null, probability: number | null) =>
    ({ Amount: amount, Probability: probability }) as unknown as DealEntity;

const overview = (record: DealEntity) => {
    const p = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(p, 'Record', { value: record });
    return p;
};

const hero = (record: DealEntity) => {
    const p = Object.create(MJSDealHeroPanel.prototype) as MJSDealHeroPanel;
    Object.defineProperty(p, 'Record', { value: record });
    return p;
};

describe('the Weighted figure on the hero and the Overview', () => {
    it('shows "—", not "$0", when the amount is missing', () => {
        expect(overview(deal(null, 50)).Weighted).toBe('—');
        expect(hero(deal(null, 50)).WeightedText).toBe('—');
    });

    it('shows "—", not "$0", when the probability is missing', () => {
        expect(overview(deal(1000, null)).Weighted).toBe('—');
        expect(hero(deal(1000, null)).WeightedText).toBe('—');
    });

    it('still shows "$0" for a probability of 0', () => {
        expect(overview(deal(1000, 0)).Weighted).toMatch(/0/);
        expect(overview(deal(1000, 0)).Weighted).not.toBe('—');
        expect(hero(deal(1000, 0)).WeightedText).not.toBe('—');
    });

    /** Same figure, two precisions: whole units in the hero, cents below it (#371 item 5). */
    it('shows the same figure on both panels, whole units in the hero and cents on the Overview', () => {
        const record = deal(1000, 25);
        expect(hero(record).WeightedText).toBe('$250');
        expect(overview(record).Weighted).toBe('$250.00');
    });
});
