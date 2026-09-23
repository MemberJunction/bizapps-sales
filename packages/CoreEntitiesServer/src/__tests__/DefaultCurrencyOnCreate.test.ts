import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A NEW DEAL WAS ALWAYS BORN WITH NO CURRENCY.
 *
 * Nothing set `Deal.CurrencyID` — not the pipeline, not the company, not a column default — so the
 * Commercial section opened with the field blank on every deal anyone created (bc-aidp-next-golive#259
 * item 3). The tester asked for USD, "ideally configurable by company"; the per-company answer already
 * exists as `AccountingCompanyProfile.FunctionalCurrencyCode`, keyed on the same id the deal's
 * `CompanyID` was just stamped to.
 *
 * WHAT THESE TESTS ARE REALLY GUARDING is not the happy path — it is the promise that this default can
 * never cost anyone a deal. Accounting absent, no profile row, a failed read, a currency code naming no
 * row: each one has to leave the field null and say nothing. A default that refuses a save is worse
 * than no default, so most of what follows is the shape of failure.
 *
 * `Object.create` holds the server entity without standing up metadata, the way `SeedOwnerOnCreate`
 * does. Only what `defaultCurrencyOnCreate` touches is shadowed.
 */

const COMPANY = 'aaaaaaaa-0000-4000-8000-000000000001';
const GBP_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const USD_ID = 'cccccccc-0000-4000-8000-000000000003';

const PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

type Opts = {
    IsSaved?: boolean;
    CurrencyID?: string | null;
    CompanyID?: string | null;
    /** Entity names this host has. Defaults to both accounting entities being present. */
    entities?: string[];
    /** `undefined` means the profile read returned NO ROW. */
    functionalCurrencyCode?: string | null;
    /** Codes the currency table will resolve. Anything else returns no row. */
    knownCurrencies?: Record<string, string>;
    profileReadSucceeds?: boolean;
    currencyReadSucceeds?: boolean;
};

function deal(opts: Opts) {
    const filters: string[] = [];
    const views: string[] = [];
    const known = opts.knownCurrencies ?? { USD: USD_ID, GBP: GBP_ID };

    const instance = Object.create(DealEntityServer.prototype) as {
        defaultCurrencyOnCreate(): Promise<void>;
        CurrencyID: string | null;
        Views: string[];
        Filters: string[];
    };

    Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved ?? false, writable: true });
    Object.defineProperty(instance, 'CurrencyID', {
        value: opts.CurrencyID ?? null, writable: true,
    });
    Object.defineProperty(instance, 'CompanyID', {
        value: opts.CompanyID === undefined ? COMPANY : opts.CompanyID, writable: true,
    });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: {}, writable: true });

    const entityNames = opts.entities ?? [PROFILE_ENTITY, CURRENCY_ENTITY];
    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            Entities: entityNames.map((Name) => ({ Name })),
            RunView: async (params: { EntityName: string; ExtraFilter: string }) => {
                views.push(params.EntityName);
                filters.push(params.ExtraFilter);
                if (params.EntityName === PROFILE_ENTITY) {
                    if (opts.profileReadSucceeds === false) {
                        return { Success: false, ErrorMessage: 'boom', Results: [] };
                    }
                    return {
                        Success: true,
                        Results: opts.functionalCurrencyCode === undefined
                            ? []
                            : [{ FunctionalCurrencyCode: opts.functionalCurrencyCode }],
                    };
                }
                if (opts.currencyReadSucceeds === false) {
                    return { Success: false, ErrorMessage: 'boom', Results: [] };
                }
                const code = /Code='([^']*)'/.exec(params.ExtraFilter)?.[1] ?? '';
                const id = known[code];
                return { Success: true, Results: id ? [{ ID: id }] : [] };
            },
        },
        writable: true,
    });

    Object.defineProperty(instance, 'Views', { get: () => views });
    Object.defineProperty(instance, 'Filters', { get: () => filters });
    return instance;
}

describe('the currency a new deal is born with', () => {
    it('takes the selling company functional currency when accounting names one', async () => {
        const d = deal({ functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBe(GBP_ID);
    });

    it('falls back to USD when the company has no accounting profile', async () => {
        const d = deal({ functionalCurrencyCode: undefined });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBe(USD_ID);
    });

    it('asks the company before it assumes USD', async () => {
        const d = deal({ functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        // The profile is consulted first, and USD is never looked up once the company answered.
        expect(d.Views).toEqual([PROFILE_ENTITY, CURRENCY_ENTITY]);
        expect(d.Filters.some((f) => f.includes("Code='USD'"))).toBe(false);
    });

    it('resolves the code to an ACTIVE currency row', async () => {
        const d = deal({ functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        expect(d.Filters.at(-1)).toBe("Code='GBP' AND IsActive=1");
    });

    it('leaves a caller-supplied currency alone', async () => {
        const d = deal({ CurrencyID: GBP_ID, functionalCurrencyCode: 'EUR' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBe(GBP_ID);
        expect(d.Views).toEqual([]);
    });

    it('does not fill a currency somebody cleared on a saved deal', async () => {
        const d = deal({ IsSaved: true, functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBeNull();
        expect(d.Views).toEqual([]);
    });
});

describe('when the currency cannot be resolved, the deal is still created', () => {
    it('reads nothing on a host without accounting', async () => {
        const d = deal({ entities: ['MJ_BizApps_Sales: Deals'], functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBeNull();
        expect(d.Views).toEqual([]);
    });

    it('still reaches the USD fallback when the profile read fails', async () => {
        // A failed read is not "this company uses USD" — but USD is still the stated global
        // fallback, so the default proceeds to it rather than inventing a refusal.
        const d = deal({ profileReadSucceeds: false });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBe(USD_ID);
    });

    it('leaves the field null when the currency read fails', async () => {
        const d = deal({ functionalCurrencyCode: 'GBP', currencyReadSucceeds: false });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBeNull();
    });

    it('leaves the field null when the code names no currency row', async () => {
        const d = deal({ functionalCurrencyCode: 'ZZZ' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBeNull();
    });

    it('leaves the field null when no selling company was stamped', async () => {
        const d = deal({ CompanyID: null, functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        expect(d.CurrencyID).toBeNull();
        expect(d.Views).toEqual([]);
    });

    it('does not query on a company id that is not a guid', async () => {
        const d = deal({ CompanyID: "x' OR 1=1--", functionalCurrencyCode: 'GBP' });
        await d.defaultCurrencyOnCreate();
        // No profile read at all, and the fallback still lands rather than the save breaking.
        expect(d.Views).toEqual([CURRENCY_ENTITY]);
        expect(d.CurrencyID).toBe(USD_ID);
    });

    it('does not query on a currency code that is not three letters', async () => {
        const d = deal({ functionalCurrencyCode: "US' OR 1=1--" });
        await d.defaultCurrencyOnCreate();
        expect(d.Views).toEqual([PROFILE_ENTITY]);
        expect(d.CurrencyID).toBeNull();
    });
});
