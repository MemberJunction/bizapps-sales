/**
 * @fileoverview The currency a digest amount is shown in.
 *
 * The server-side equivalent of `ReadCurrencyCodes` / `CurrencyCodeFor` in the Angular package's
 * `deal-workspace.service.ts`, which is not reachable from here. The names and the stated default are
 * kept the same on purpose, so the deal board and the executive's email agree.
 */
import { LogStatus, Metadata, RunView, type UserInfo } from '@memberjunction/core';

const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

/**
 * A display default, not a fact about the money. One named constant rather than scattered 'USD'
 * literals so the assumption is stated once, in a place a reader meets it. Same value, same reasoning
 * as `DEFAULT_DISPLAY_CURRENCY` in `deal-workspace.service.ts`.
 */
export const DEFAULT_DISPLAY_CURRENCY = 'USD';

/**
 * The currency code a deal is shown in: the code `currencyID` names in `codes`, or the display default
 * when the deal has none or names one this host cannot resolve. `codes` is keyed by upper-cased ID.
 */
export function CurrencyCodeFor(currencyID: string | null | undefined, codes: ReadonlyMap<string, string>): string {
    return (currencyID && codes.get(String(currencyID).toUpperCase())) || DEFAULT_DISPLAY_CURRENCY;
}

/**
 * One read of accounting's currency codes, keyed by upper-cased ID. Never throws: empty when accounting
 * is not installed, not readable by this user, or the read fails, so every deal then reads as the
 * display default.
 *
 * WHY THIS ONE DOES NOT THROW, unlike every other read in the digest. Those reads decide who gets mail
 * and which deals they see, so a failure must stop the run rather than pass for "nothing to send". A
 * missing currency table only changes a formatting detail; it is no reason to send nobody their digest.
 * The accounting app is optional, so a host without it must still get its emails.
 */
export async function ReadCurrencyCodes(contextUser: UserInfo): Promise<Map<string, string>> {
    // Everything inside the try, the metadata check included: a label lookup must never take the run down.
    try {
        if (!new Metadata().Entities.some((e) => e.Name === CURRENCY_ENTITY)) return new Map();
        const r = await new RunView().RunView<{ ID: string; Code: string }>({
            EntityName: CURRENCY_ENTITY, ResultType: 'simple', Fields: ['ID', 'Code'],
        }, contextUser);
        if (r?.Success) {
            return new Map((r.Results ?? []).map((c) => [String(c.ID).toUpperCase(), String(c.Code).trim()]));
        }
        LogStatus(`${CURRENCY_ENTITY} read failed, showing ${DEFAULT_DISPLAY_CURRENCY} - ${r?.ErrorMessage ?? 'unknown error'}`);
    } catch (e) {
        LogStatus(`${CURRENCY_ENTITY} read threw, showing ${DEFAULT_DISPLAY_CURRENCY} - ${e instanceof Error ? e.message : String(e)}`);
    }
    return new Map();
}
