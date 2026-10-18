import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';

/**
 * THE HEADER'S AMOUNT HONOURS FIELD-LEVEL READ SECURITY (#403).
 *
 * The header draws Amount and the weighted figure itself, so it asks what `mj-form-field` asks before
 * reading. `BaseEntity.Get()` throws for a denied field, so without the check a viewer denied Amount
 * would lose the whole header rather than one figure.
 */
function hero(denied: string[]) {
    const viewer = { Name: 'someone' };
    const p = Object.create(MJSDealHeroPanel.prototype) as MJSDealHeroPanel;
    Object.defineProperty(p, 'FormComponent', { value: { ProviderToUse: { CurrentUser: viewer } } });
    Object.defineProperty(p, 'Record', {
        value: {
            EntityInfo: {
                IsFieldReadableByUser: (name: string, user: unknown) => user !== viewer || !denied.includes(name),
            },
        },
    });
    return p;
}

describe('the deal header and a viewer who may not read Amount', () => {
    it('hides the amount stats', () => {
        expect(hero(['Amount']).AmountReadable).toBe(false);
    });

    it('shows them to a viewer who may read it', () => {
        expect(hero([]).AmountReadable).toBe(true);
        expect(hero(['MRR']).AmountReadable).toBe(true);
    });

    it('hides Weighted when either Amount or Probability is denied', () => {
        expect(hero(['Amount']).WeightedReadable).toBe(false);
        expect(hero(['Probability']).WeightedReadable).toBe(false);
        expect(hero(['Probability']).AmountReadable).toBe(true);
        expect(hero([]).WeightedReadable).toBe(true);
    });
});
