/**
 * @fileoverview Converting a rep's discount entry into the fraction an order line stores.
 *
 * ── WHY THIS IS ITS OWN FILE WITH ITS OWN TEST ──────────────────────────────────────────────────
 *
 * `DealLine.RequestedDiscountPct` was a PERCENTAGE: `CK_DealLine_RequestedDiscountPct` bounded it
 * `0..100`. `OrderLine.DiscountPct` is a FRACTION: `CK_OrderLine_DiscountPct CHECK (DiscountPct >= 0
 * AND DiscountPct <= 1)`. Retiring `DealLine` moves every discount across that boundary, so the
 * conversion is now on the write path of every line a rep touches (docs/DECISIONS.md D-DL1).
 *
 * A hundred-fold error here is not a crash. It is an order that silently discounts by the wrong
 * amount, priced by the real engine, printed on a real quote.
 *
 * ── THE DANGEROUS INPUT IS NOT THE OBVIOUS ONE ──────────────────────────────────────────────────
 *
 * Sending a raw percentage is the SAFE failure: 10 becomes 10, the CHECK constraint refuses it, and
 * the save fails loudly. Ugly — it fails at the database naming a constraint — but nothing is wrong
 * in the data.
 *
 * The dangerous input is a value **between 0 and 1**. A rep entering `0.5` means half a percent.
 * Treated as a fraction it is fifty percent, and `0.5` satisfies `CK_OrderLine_DiscountPct`
 * perfectly — so nothing anywhere refuses it. That is the case this module exists for, and it is why
 * the conversion refuses rather than guesses.
 *
 * @module @mj-biz-apps/sales-entities
 */

/**
 * ── THE STORED PRECISION, WHICH IS WHAT MAKES THE ROUND TRIP EXACT ──────────────────────────────
 *
 * `OrderLine.DiscountPct` is `DECIMAL(7,4)`. Four decimals on a FRACTION is one hundredth of one
 * percent, so the percent a rep works in has exactly two decimals -- the same scale the retired
 * `DealLine.RequestedDiscountPct decimal(5,2)` used, which is not a coincidence: both describe the
 * same quantity.
 *
 * Naming it is what fixes the round trip. `29 / 100 * 100` is `28.999999999999996` in binary
 * floating point, and 8 of the 101 whole percents drift that way -- 7, 14, 28, 29, 55, 56, 57 and
 * 58. Rounding at the precision the column can actually hold makes every one of the 10,001
 * two-decimal percents from 0.00 to 100.00 survive the trip unchanged; measured, not assumed.
 *
 * A value finer than this cannot be stored: `DECIMAL(7,4)` would round it on the way in. Rounding
 * here rather than letting the database do it silently means the number on screen is the number
 * that will be persisted.
 */
export const DISCOUNT_PERCENT_DECIMALS = 2;
export const DISCOUNT_FRACTION_DECIMALS = 4;

/** Round at a stated number of decimals. Not exported: the two helpers below are the API. */
function round(value: number, decimals: number): number {
    const scale = 10 ** decimals;
    return Math.round(value * scale) / scale;
}

/** The percent a rep types, at the precision the column can hold. */
export function RoundDiscountPercent(percent: number): number {
    return round(percent, DISCOUNT_PERCENT_DECIMALS);
}

/** The outcome of converting one discount entry. */
export type DiscountConversion =
    | { Ok: true; Fraction: number }
    | { Ok: false; Reason: string };

/**
 * Converts a rep-entered PERCENTAGE (0–100) into the FRACTION an `OrderLine` stores (0–1).
 *
 * Deliberately NOT a bare `value / 100`. Two inputs must not be silently divided:
 *
 *   · a value in `(0, 1)` — ambiguous between "half a percent" and "somebody already converted",
 *     and the wrong reading passes every constraint downstream. Refused, so a human decides.
 *   · anything outside `0..100` — not a percentage at all.
 *
 * `0` and `1` are accepted and unambiguous: zero is no discount, and one percent is one percent
 * (`1` in, `0.01` out) — a caller who meant "all of it" types `100`.
 *
 * @param percent The value as typed by the rep, in percent. `null`/`undefined` means "not stated".
 * @returns the fraction to store, or a refusal naming what to do about it.
 */
export function DiscountPercentToFraction(percent: number | null | undefined): DiscountConversion {
    if (percent === null || percent === undefined) {
        return { Ok: true, Fraction: 0 };
    }
    if (!Number.isFinite(percent)) {
        return { Ok: false, Reason: 'A discount must be a number.' };
    }
    if (percent < 0 || percent > 100) {
        return {
            Ok: false,
            Reason: `A discount of ${percent} is not a percentage. Enter a value between 0 and 100.`,
        };
    }
    if (percent > 0 && percent < 1) {
        return {
            Ok: false,
            Reason:
                `A discount of ${percent} is ambiguous: as a percentage it is a fraction of one percent, ` +
                `and as a fraction it would be ${percent * 100}%. Enter whole percent — ${percent * 100} ` +
                `for ${percent * 100}%, or 0 for no discount.`,
        };
    }
    /**
     * ROUNDING HAPPENS HERE, AFTER THE BAND CHECK, AND THE ORDER IS LOAD-BEARING.
     *
     * Round first and `0.996` becomes `1.00`, which this function ACCEPTS as one percent -- an
     * ambiguous entry converted into a confident answer by the very step meant to make the answer
     * exact. The refusal has to be decided on what the caller actually said.
     */
    const stated = RoundDiscountPercent(percent);
    return { Ok: true, Fraction: round(stated / 100, DISCOUNT_FRACTION_DECIMALS) };
}

/**
 * The inverse, for showing a stored order line back to a rep in the units they typed.
 *
 * Kept beside the forward conversion on purpose: the pair is what makes a round-trip checkable, and
 * a display helper that lived somewhere else would drift from the write path it has to mirror.
 *
 * Rounded at `DISCOUNT_PERCENT_DECIMALS`, so what this returns is what a rep could type back --
 * `0.29` reads as `29`, not as `28.999999999999996`. Without that, the workspace binds a number the
 * step-constrained percent input treats as invalid, and re-emits it on the next change so the value
 * walks away from itself one edit at a time.
 *
 * WHAT THIS DOES *NOT* DO IS AVOID THE AMBIGUOUS BAND. A stored `0.005` is a legitimately negotiated
 * half percent -- `DECIMAL(7,4)` holds it exactly -- and it reads back as `0.5`, which
 * `DiscountPercentToFraction` refuses. That refusal is correct for something a human TYPED and
 * cannot be relaxed here without reintroducing the hundred-fold error this module exists to stop.
 * The resolution is on the caller's side and is stated where it lives: a value this function
 * produced is not an entry, so it must not be fed back through the entry guard. See
 * `SetDiscountPercent` in `deal-workspace.component.ts`.
 *
 * @param fraction The value as stored on `OrderLine.DiscountPct` (0–1).
 */
export function DiscountFractionToPercent(fraction: number | null | undefined): number {
    if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
        return 0;
    }
    return RoundDiscountPercent(fraction * 100);
}
