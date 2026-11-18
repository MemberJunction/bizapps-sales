/**
 * A deal's forecast-weighted figure: amount times probability percent, or `null` when either is missing.
 *
 * ONE answer for the hero and the Overview. Both used `Number(x)` before checking for a missing value,
 * and `Number(null)` is 0, so a deal with no amount or no probability showed Weighted "$0" next to
 * Amount "—". A probability of 0 is a real value and still weights to 0.
 *
 * Forecast weighting, not pricing (#459): `metadata/queries/README.md` carves out weighted pipeline as
 * the one documented exception to Rule 1 because it is a likelihood statistic nothing bills from. The
 * deal roster view (`metadata/queries/SQL/deal-roster.sql`) defines the same formula in SQL, substituting
 * 0 for missing inputs so rollup sums add up; this helper returns `null` when an input is absent so a
 * single deal header renders "—" instead of "$0", and matches the SQL formula (`WeightedAmount ?? 0`)
 * across all inputs.
 */
export function WeightedAmount(
    amount: number | null | undefined,
    probability: number | null | undefined,
): number | null {
    if (amount == null || probability == null) return null;
    const a = Number(amount);
    const p = Number(probability);
    if (!Number.isFinite(a) || !Number.isFinite(p)) return null;
    return a * p / 100; // money-grep-allow: forecast weighting statistic per metadata/queries/README.md (#459)
}
