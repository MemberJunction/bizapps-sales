/**
 * @fileoverview Whether `Deal.Amount` still describes the order it was cached from.
 *
 * `Deal.Amount` is a CACHED ANSWER from Orders, stamped with `AmountIsComputed` / `AmountComputedAt` /
 * `AmountSourceHash`. Sales never recomputes it. The only question a sales surface may ask is whether
 * the cached number still matches the order — and that is a COMPARISON of two stored figures, not
 * arithmetic. Nothing here multiplies, discounts, prorates, sums or rounds.
 *
 * ── WHY THIS IS NOT A TIMESTAMP COMPARE ANY MORE (bc-aidp-next-golive#230) ──────────────────────
 *
 * Both surfaces used to read the newest `__mj_UpdatedAt` across the order's lines and call the amount
 * stale if it was later than `AmountComputedAt`. That asks "was a line TOUCHED", and the answer to that
 * is yes for reasons that have nothing to do with the price: closing a deal books the order, which moves
 * the lines' status and stamps `__mj_UpdatedAt` without a figure changing. So every Won deal warned,
 * permanently, that its frozen amount needed repricing.
 *
 * It is the failure shape CLAUDE.md rule 8 names: a claim that was true when it was written -- a touched
 * line usually DID mean a moved price -- and stayed asserted after the close flow started touching lines
 * for its own reasons. The guard was keyed on a PROXY (the timestamp) rather than on the thing it
 * actually cared about (the number). A proxy can be outgrown; the number cannot.
 *
 * So the test is now the one the question deserves: does the cached amount equal the order's current
 * total? That is also EXACTLY the test `DealEntityServer.refreshAmountFromOrder()` uses to decide the
 * cache is already current, so this surface and the server agree by construction rather than by
 * coincidence — if the server would rewrite the cache, this says stale; if it would no-op, this says
 * fresh.
 *
 * @module @mj-biz-apps/sales-entities
 */
import { RunView, type UserInfo } from '@memberjunction/core';

const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';

/**
 * The notice a surface shows when the cached amount no longer matches its order.
 *
 * golive#230: the previous wording — "A line has changed since this amount was last priced. Reprice the
 * order to update the total." — named an action that DOES NOT EXIST. There is no reprice control
 * anywhere in this codebase, so the sentence asked the reader to do something impossible.
 *
 * Saving the deal genuinely is the fix, and that is verifiable rather than hopeful:
 * `DealEntityServer.Save()` sets `amountMayHaveMoved` when `AmountIsComputed === true`, which is
 * precisely the state this notice appears in, and then re-reads `OrderHeader.TotalGross` into the cache.
 */
export const DEAL_AMOUNT_STALE_NOTICE =
    'The products on this deal changed after the amount was calculated. Save the deal to update it.';

/** The answer, plus the notice to show. `Notice` is null whenever `IsStale` is false. */
export interface DealAmountFreshness {
    IsStale: boolean;
    Notice: string | null;
}

/** What the caller must already know about the deal. Both surfaces hold all four. */
export interface DealAmountFreshnessInput {
    /**
     * Whether the PERSISTED status locks the deal, as `ResolveDealLockState` reports it.
     *
     * Required rather than optional on purpose. A caller that forgot to pass it would get the old
     * always-warns behaviour back, silently, on exactly the screen the bug was reported against.
     */
    IsLocked: boolean;
    AmountIsComputed: boolean | null | undefined;
    Amount: number | string | null | undefined;
    OrderID: string | null | undefined;
}

const FRESH: DealAmountFreshness = Object.freeze({ IsStale: false, Notice: null });
const STALE: DealAmountFreshness = Object.freeze({ IsStale: true, Notice: DEAL_AMOUNT_STALE_NOTICE });

/**
 * Whether the deal's cached amount still matches its order's total.
 *
 * Returns FRESH — never warns — in every case where the question is meaningless: a locked deal (the
 * amount is frozen and no edit could change it), a deal whose amount was typed rather than computed,
 * a deal with no order, and an order with no usable total.
 */
export async function ResolveDealAmountFreshness(
    input: DealAmountFreshnessInput,
    contextUser?: UserInfo,
): Promise<DealAmountFreshness> {
    /**
     * A CLOSED DEAL NEVER WARNS, and this is the first test rather than one of several.
     *
     * The amount is frozen by the close lock, so there is no edit that could resolve the notice and no
     * reason to read it. golive#230 is precisely this case: the close books the order, the order's
     * lines move, and the deal is simultaneously forbidden from doing anything about it. A warning
     * nobody can act on is worse than silence — it trains the reader to ignore the flag that matters.
     */
    if (input.IsLocked) {
        return FRESH;
    }

    // A typed amount claims nothing about the order, so it cannot disagree with one.
    if (!input.AmountIsComputed || !input.OrderID) {
        return FRESH;
    }

    const result = await new RunView().RunView<{ TotalGross: number | string | null }>(
        {
            EntityName: E_ORDER_HEADER,
            ExtraFilter: `ID = '${String(input.OrderID).replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['TotalGross'],
        },
        contextUser,
    );
    if (!result?.Success) {
        // A failed read is not evidence of staleness. Saying nothing is the honest answer.
        return FRESH;
    }

    const raw = (result.Results ?? [])[0]?.TotalGross;
    const total = raw === null || raw === undefined ? null : Number(raw);
    if (total === null || !Number.isFinite(total)) {
        /**
         * `OrderHeader.TotalGross` is NULL for an order with no lines — `SUM` over no rows is NULL —
         * so this is the empty-order case, not an error. There is no total to disagree with.
         */
        return FRESH;
    }

    const cachedRaw = input.Amount;
    const cached = cachedRaw === null || cachedRaw === undefined ? null : Number(cachedRaw);
    if (cached === null || !Number.isFinite(cached)) {
        /**
         * A deal claiming a COMPUTED amount that is not a number is the corrupt state `SD23` was written
         * for. Reporting it stale is both true and useful: the notice's own instruction — save the deal
         * — is exactly what repairs it, because the save re-reads the total into the cache.
         */
        return STALE;
    }

    return cached === total ? FRESH : STALE;
}
