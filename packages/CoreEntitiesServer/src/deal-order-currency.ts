/**
 * The currency a deal's order is in (golive #492).
 *
 * Orders reads `OrderHeader.CurrencyCode` as the currency of every amount on the order, and NULL as the
 * selling company's functional currency (its accounting profile's `FunctionalCurrencyCode`). A deal names
 * its currency as `Deal.CurrencyID`, a row in accounting's `Currency` table. The order takes the deal's
 * currency code, and stays NULL when that code is the functional currency or the deal has none, so an
 * order in the company's own currency looks exactly as every order did before currencies existed.
 *
 * A company with no accounting profile has no functional currency for orders to read. The deal's own
 * default reads USD for such a company, so USD stays NULL there: writing it would make orders refuse the
 * confirm for want of a functional currency, on deals that confirm today. Any other currency is still
 * written, so orders refuses that confirm and asks for the profile, rather than booking a foreign amount
 * as if it were USD.
 */

/** Upper-cased and trimmed, or null when blank. Accounting stores codes upper-case (CK_Currency_Code). */
export function NormalizeCurrencyCode(code: string | null | undefined): string | null {
    const trimmed = (code ?? '').trim().toUpperCase();
    return trimmed.length ? trimmed : null;
}

/**
 * The `CurrencyCode` an order takes from its deal.
 *
 * @param dealCurrencyCode The code of the deal's `CurrencyID`, or null when the deal has none.
 * @param functionalCurrencyCode The selling company's functional currency, or null when it has no profile.
 * @param fallbackCurrencyCode What the deal defaults to when the company names no functional currency.
 */
export function OrderCurrencyFor(
    dealCurrencyCode: string | null | undefined,
    functionalCurrencyCode: string | null | undefined,
    fallbackCurrencyCode: string,
): string | null {
    const code = NormalizeCurrencyCode(dealCurrencyCode);
    if (!code) return null;
    const functional = NormalizeCurrencyCode(functionalCurrencyCode) ?? NormalizeCurrencyCode(fallbackCurrencyCode);
    return code === functional ? null : code;
}

/**
 * Whether two order currencies mean the same thing to orders: NULL and the functional code are one
 * currency, as orders' own booking-rate decision treats them.
 */
export function SameOrderCurrency(
    a: string | null | undefined,
    b: string | null | undefined,
    functionalCurrencyCode: string | null | undefined,
    fallbackCurrencyCode: string,
): boolean {
    return (
        OrderCurrencyFor(a, functionalCurrencyCode, fallbackCurrencyCode) ===
        OrderCurrencyFor(b, functionalCurrencyCode, fallbackCurrencyCode)
    );
}
