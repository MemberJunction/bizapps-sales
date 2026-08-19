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
    return { Ok: true, Fraction: percent / 100 };
}

/**
 * The inverse, for showing a stored order line back to a rep in the units they typed.
 *
 * Kept beside the forward conversion on purpose: the pair is what makes a round-trip checkable, and
 * a display helper that lived somewhere else would drift from the write path it has to mirror.
 *
 * @param fraction The value as stored on `OrderLine.DiscountPct` (0–1).
 */
export function DiscountFractionToPercent(fraction: number | null | undefined): number {
    if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
        return 0;
    }
    return fraction * 100;
}
