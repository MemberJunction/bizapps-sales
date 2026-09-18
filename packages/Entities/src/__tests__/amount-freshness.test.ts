import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    DEAL_AMOUNT_STALE_NOTICE,
    ResolveDealAmountFreshness,
    type DealAmountFreshnessInput,
} from '../amount-freshness';
import { RunView } from '@memberjunction/core';

/**
 * bc-aidp-next-golive#230 — a Won deal warned, permanently, that an amount it was forbidden to change
 * needed repricing, and named a "reprice" action that does not exist anywhere in the codebase.
 *
 * THE QUESTION THESE CHECKS ARE BUILT AROUND is CLAUDE.md rule 8's: what would make this pass while the
 * thing it names is broken? A check that only asserted "a locked deal is fresh" would pass against an
 * implementation that never warned at all — so every no-warning case below is paired with a case that
 * DOES warn on the same input but for the locked flag, and the stale path is pinned in both directions.
 */

/** Stubs the single Order Header read. Returns the total the order should report. */
const withOrderTotal = (total: number | string | null, success = true) =>
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
        Success: success,
        Results: total === null ? [{ TotalGross: null }] : [{ TotalGross: total }],
    } as never);

/** An open, lined deal whose cached amount matches its order — the baseline everything varies from. */
const input = (over: Partial<DealAmountFreshnessInput> = {}): DealAmountFreshnessInput => ({
    IsLocked: false,
    AmountIsComputed: true,
    Amount: 1000,
    OrderID: 'order-1',
    ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('a locked deal never warns', () => {
    it('is fresh even when the amount genuinely disagrees with the order', async () => {
        // THE PAIRING THAT GIVES THIS CHECK ITS VALUE: the same input warns when unlocked, below.
        const spy = withOrderTotal(9999);
        const result = await ResolveDealAmountFreshness(input({ IsLocked: true, Amount: 1000 }));
        expect(result.IsStale).toBe(false);
        expect(result.Notice).toBeNull();
    });

    it('does not even read the order — a frozen amount is not a question', async () => {
        const spy = withOrderTotal(9999);
        await ResolveDealAmountFreshness(input({ IsLocked: true }));
        expect(spy).not.toHaveBeenCalled();
    });

    it('and the very same deal DOES warn once it is unlocked', async () => {
        withOrderTotal(9999);
        const result = await ResolveDealAmountFreshness(input({ IsLocked: false, Amount: 1000 }));
        expect(result.IsStale).toBe(true);
    });
});

describe('freshness compares the NUMBER, not whether a line was touched', () => {
    it('is fresh when the cached amount equals the order total', async () => {
        withOrderTotal(1000);
        expect((await ResolveDealAmountFreshness(input({ Amount: 1000 }))).IsStale).toBe(false);
    });

    it('is stale when they differ', async () => {
        withOrderTotal(1250);
        const result = await ResolveDealAmountFreshness(input({ Amount: 1000 }));
        expect(result.IsStale).toBe(true);
        expect(result.Notice).toBe(DEAL_AMOUNT_STALE_NOTICE);
    });

    it('treats a string total from the provider as the number it is', async () => {
        // Decimals arrive as strings from some providers; a === on the raw values would report a
        // permanent false stale, which is the bug this issue is about wearing a different hat.
        withOrderTotal('1000');
        expect((await ResolveDealAmountFreshness(input({ Amount: 1000 }))).IsStale).toBe(false);
    });
});

describe('cases where the question is meaningless report fresh, never stale', () => {
    it('a typed amount cannot disagree with an order', async () => {
        const spy = withOrderTotal(9999);
        expect((await ResolveDealAmountFreshness(input({ AmountIsComputed: false }))).IsStale).toBe(false);
        expect(spy).not.toHaveBeenCalled();
    });

    it('a deal with no order', async () => {
        const spy = withOrderTotal(9999);
        expect((await ResolveDealAmountFreshness(input({ OrderID: null }))).IsStale).toBe(false);
        expect(spy).not.toHaveBeenCalled();
    });

    it('an order with no lines, whose TotalGross is NULL', async () => {
        withOrderTotal(null);
        expect((await ResolveDealAmountFreshness(input())).IsStale).toBe(false);
    });

    it('a failed read — not evidence of staleness', async () => {
        withOrderTotal(9999, false);
        expect((await ResolveDealAmountFreshness(input({ Amount: 1000 }))).IsStale).toBe(false);
    });
});

describe('a computed amount that is not a number is stale, because saving repairs it', () => {
    it('reports stale for a NULL amount stamped as computed', async () => {
        withOrderTotal(1000);
        const result = await ResolveDealAmountFreshness(input({ Amount: null }));
        expect(result.IsStale).toBe(true);
    });
});

describe('the notice names an action that exists', () => {
    it('tells the reader to save the deal, and never to "reprice"', () => {
        expect(DEAL_AMOUNT_STALE_NOTICE).toContain('Save the deal');
        // The old copy's instruction was unfollowable: no reprice control exists anywhere.
        expect(DEAL_AMOUNT_STALE_NOTICE.toLowerCase()).not.toContain('reprice');
    });
});
