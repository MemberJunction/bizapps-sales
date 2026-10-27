import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';

/**
 * THE FORM COMPONENT DOES NOT ASK WHETHER THE AMOUNT IS STALE (#386).
 *
 * The deal header works out and shows the stale-amount notice. The form component used to work it out
 * too, on open and after every save and refresh, and its template showed nothing of it: an extra
 * order-total read per event on every unlocked deal with an order. This pins that the form's own
 * resolve no longer reaches the freshness rule, while still resolving the lock.
 */
const calls = vi.hoisted(() => ({ freshness: 0, lock: 0 }));

vi.mock('@mj-biz-apps/sales-entities', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mj-biz-apps/sales-entities')>();
    return {
        ...actual,
        ResolveDealAmountFreshness: async () => {
            calls.freshness += 1;
            return { IsStale: false, Notice: null };
        },
        ResolveDealLockState: async () => {
            calls.lock += 1;
            return { IsLocked: false, StatusName: null, IsLost: false, IsWon: false, Notice: null };
        },
    };
});

const { DealFormComponentExtended } = await import('../lib/custom/deal-form.component');

describe('the deal form resolves the lock and nothing the header already shows', () => {
    it('reads the lock and never the order total, at open and after a save', async () => {
        const instance = Object.create(DealFormComponentExtended.prototype) as {
            ngOnInit(): Promise<void>;
            RecordSaved: { subscribe(fn: () => void): void };
            RecordRefreshed: { subscribe(fn: () => void): void };
        };
        const saved: Array<() => void> = [];
        for (const [k, v] of Object.entries({
            RecordSaved: { subscribe: (fn: () => void) => { saved.push(fn); } },
            RecordRefreshed: { subscribe: () => undefined },
            record: {
                Get: (name: string) => ({ ID: 'deal-1', OrderID: 'order-1', AmountIsComputed: true, Amount: 10 })[name],
                GetFieldByName: () => ({ OldValue: 'status-open' }),
            },
            cdr: { detectChanges: () => undefined },
        })) {
            Object.defineProperty(instance, k, { value: v, writable: true });
        }
        const base = Object.getPrototypeOf(Object.getPrototypeOf(instance));
        Object.defineProperty(base, 'ngOnInit', { value: async () => undefined, writable: true, configurable: true });

        await instance.ngOnInit();
        for (const fn of saved) fn();
        await Promise.resolve();
        await Promise.resolve();

        expect(calls.lock, 'the lock is still resolved at open and after the save').toBe(2);
        expect(calls.freshness, 'the header owns the stale-amount notice').toBe(0);
    });
});
