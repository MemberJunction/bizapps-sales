import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeLimitExceeded, WithinTimeLimit } from '../lib/data/time-limit';

/** A read with no limit of its own, raced against a timer (bc-aidp-next-golive#414). */
describe('WithinTimeLimit', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("passes a read's value through when it answers in time", async () => {
        await expect(WithinTimeLimit(Promise.resolve(7), 1_000, 'too slow')).resolves.toBe(7);
    });

    it("passes a read's own failure through", async () => {
        await expect(WithinTimeLimit(Promise.reject(new Error('504')), 1_000, 'too slow')).rejects.toThrow('504');
    });

    it('rejects with the message once the limit passes first', async () => {
        const raced = WithinTimeLimit(new Promise<number>(() => undefined), 1_000, 'too slow');
        const outcome = expect(raced).rejects.toBeInstanceOf(TimeLimitExceeded);
        await vi.advanceTimersByTimeAsync(1_000);
        await outcome;
        await expect(raced).rejects.toThrow('too slow');
    });

    it('leaves no timer behind once the read answers', async () => {
        await WithinTimeLimit(Promise.resolve(1), 1_000, 'too slow');
        expect(vi.getTimerCount()).toBe(0);
    });
});
