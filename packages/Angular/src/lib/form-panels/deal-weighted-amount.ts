/**
 * A deal's forecast-weighted figure: amount times probability percent, or `null` when either is missing.
 *
 * ONE answer for the hero and the Overview. Both used `Number(x)` before checking for a missing value,
 * and `Number(null)` is 0, so a deal with no amount or no probability showed Weighted "$0" next to
 * Amount "—". A probability of 0 is a real value and still weights to 0.
 *
 * Forecast weighting, not pricing: the deal view's `WeightedAmount` does the same in SQL, where a
 * missing value counts as 0 so rollup sums still add up.
 */
export function WeightedAmount(
    amount: number | null | undefined,
    probability: number | null | undefined,
): number | null {
    if (amount == null || probability == null) return null;
    const a = Number(amount);
    const p = Number(probability);
    if (!Number.isFinite(a) || !Number.isFinite(p)) return null;
    return a * p / 100;
}
