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
 * `SetDiscountPercent` in `deal-line-editor.component.ts` (sales-ng).
 *
 * @param fraction The value as stored on `OrderLine.DiscountPct` (0–1).
 */
export function DiscountFractionToPercent(fraction: number | null | undefined): number {
    if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
        return 0;
    }
    return RoundDiscountPercent(fraction * 100);
}

/**
 * Converts a rep-entered DOLLAR discount on a line into the PERCENT the line records.
 *
 * A signed order form often says "less $500" rather than a percent. The line still stores only
 * `DiscountPct`, so the amount is turned into a percent of the line's list amount here and then held to
 * the percent rules: bounded to 0–100 (no more than the list amount), rounded to
 * `DISCOUNT_PERCENT_DECIMALS`, and, because it lands on `DiscountPct` like a typed percent, asked for a
 * concession reason by the editor when it raises the discount.
 *
 * THE LIST AMOUNT IS ORDERS' FIGURE, never one sales builds. The caller passes what `Orders.PriceOrder`
 * reported for the line before any discount; sales does not multiply quantity by price to get it.
 *
 * THE PERCENT IS HELD TO A HUNDREDTH, so the discount orders applies can differ from the typed amount
 * by a few cents ($500 off $3,333.00 is 15.0015%, stored as 15.00%, which orders prices as $499.95).
 * The caller shows orders' resulting discount so the rep sees the figure that will be booked.
 *
 * Not subject to the `(0, 1)` ambiguity refusal: that guards a typed percent that might already be a
 * fraction. A percent derived from a dollar amount has no second reading, so `$1` off a `$240` line
 * records 0.42% rather than being refused. The fraction is returned with the percent for that reason:
 * feeding the derived percent back through `DiscountPercentToFraction` would refuse it.
 *
 * @param amount The dollar discount for the whole line, as typed. `null`/`undefined` means "not stated".
 * @param listAmount The line's amount before any discount, as orders priced it.
 * @returns the percent to show and the fraction to store, or a refusal naming what to do about it.
 */
export function DiscountAmountToPercent(
    amount: number | null | undefined,
    listAmount: number | null | undefined,
): DiscountAmountConversion {
    if (amount === null || amount === undefined) {
        return { Ok: true, Percent: 0, Fraction: 0 };
    }
    if (!Number.isFinite(amount)) {
        return { Ok: false, Reason: 'A discount must be a number.' };
    }
    if (amount < 0) {
        return { Ok: false, Reason: 'A discount cannot be negative.' };
    }
    if (listAmount === null || listAmount === undefined || !Number.isFinite(listAmount) || listAmount <= 0) {
        return {
            Ok: false,
            Reason: 'Orders has no list amount for this line yet, so a dollar discount cannot be converted. Enter a percent.',
        };
    }
    if (amount > listAmount) {
        return { Ok: false, Reason: `A discount of ${amount} is more than the line's list amount of ${listAmount}.` };
    }
    const percent = RoundDiscountPercent((amount / listAmount) * 100); // money-grep-allow: dollar-to-percent unit conversion, the one place D-DL2 allows it
    if (amount > 0 && percent === 0) {
        return {
            Ok: false,
            Reason: `A discount of ${amount} is under 0.01% of the line, the smallest discount a line can record.`,
        };
    }
    return { Ok: true, Percent: percent, Fraction: round(percent / 100, DISCOUNT_FRACTION_DECIMALS) };
}

/**
 * The line's amount before any discount, from what `Orders.PriceOrder` reported for it.
 *
 * Orders reports the line's net and its whole discount, and derives that discount as list minus net
 * (`ReadPricedLineAmounts`). Adding them back is that same derivation read the other way, so the list
 * amount is orders' own figure, including a tier's stored extended amount, which quantity times unit
 * price would miss.
 */
export function PricedLineListAmount(
    pricedNet: number | null | undefined,
    pricedDiscount: number | null | undefined,
): number | null {
    if (pricedNet === null || pricedNet === undefined || !Number.isFinite(pricedNet)) {
        return null;
    }
    const discount = pricedDiscount !== null && pricedDiscount !== undefined && Number.isFinite(pricedDiscount)
        ? pricedDiscount
        : 0;
    return round(pricedNet + discount, 2); // money-grep-allow: orders' list − net read back as list, not a price sales builds
}

/** The outcome of converting one dollar discount entry. */
export type DiscountAmountConversion =
    | { Ok: true; Percent: number; Fraction: number }
    | { Ok: false; Reason: string };
