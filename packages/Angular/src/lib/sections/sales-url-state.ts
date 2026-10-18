/**
 * @fileoverview What the Sales section keeps in the tab's query params (bizapps-sales#371).
 *
 * Page, reporting period (and a custom range's dates), the dashboard's filter bar
 * (bc-aidp-next-golive#350), the deal list's slice, and the Board's company and pipeline. A reload or
 * a shared link opens the section where it was left rather than on Dashboard with every default.
 *
 * A null field (or an empty list) is the DEFAULT, and a default is left out of the URL, so a section on
 * its defaults has a clean address. Every param is checked against the values the section offers: a
 * hand-edited or stale link falls back to the default for that field rather than selecting something
 * that does not exist. Record IDs are checked by the page that uses them against what it loaded.
 *
 * The filter lists are comma-separated IDs. The Board's `company` and `pipeline` are separate from the
 * dashboard's lists: the Board shows one company and one pipeline at a time.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { INSPECT_KEYS, type InspectKey } from '../pages/dashboard-inspect';
import { IsoDay, PERIOD_OPTIONS, type PeriodKey } from '../pages/dashboard-period';
import { CleanIDs } from '../pages/dashboard-filters';

export interface SalesUrlState {
    Page: string | null;
    Period: PeriodKey | null;
    /** A custom range's first and last day, `YYYY-MM-DD`. Read only with Period `custom`. */
    PeriodStart: string | null;
    PeriodEnd: string | null;
    /** The dashboard's filter bar. Empty is "All". */
    Companies: string[];
    ProductCompanies: string[];
    Owners: string[];
    Pipelines: string[];
    Inspect: InspectKey | null;
    /** The deal list's argument: a stage ID for `stage`, an owner for `owner`. */
    InspectArg: string | null;
    Company: string | null;
    Pipeline: string | null;
}

/** The query param each field is written to. */
const PARAM = {
    Page: 'page',
    Period: 'period',
    PeriodStart: 'from',
    PeriodEnd: 'to',
    Companies: 'companies',
    ProductCompanies: 'productCompanies',
    Owners: 'owners',
    Pipelines: 'pipelines',
    Inspect: 'inspect',
    InspectArg: 'inspectArg',
    Company: 'company',
    Pipeline: 'pipeline',
} as const;

type ListField = 'Companies' | 'ProductCompanies' | 'Owners' | 'Pipelines';
const LIST_FIELDS: readonly ListField[] = ['Companies', 'ProductCompanies', 'Owners', 'Pipelines'];

/** A section on its defaults. */
export const DEFAULT_SALES_URL_STATE: SalesUrlState = {
    Page: null,
    Period: null,
    PeriodStart: null,
    PeriodEnd: null,
    Companies: [],
    ProductCompanies: [],
    Owners: [],
    Pipelines: [],
    Inspect: null,
    InspectArg: null,
    Company: null,
    Pipeline: null,
};

/** Reads the state from query params. `pages` is the section's page IDs, so an unknown page is ignored. */
export function ParseSalesUrlState(params: Record<string, string>, pages: readonly string[]): SalesUrlState {
    const pick = <T extends string>(value: string | undefined, allowed: readonly T[]): T | null =>
        value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null;
    const id = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);
    const list = (value: string | undefined): string[] => CleanIDs((value ?? '').split(','));
    const period = pick(params[PARAM.Period], PERIOD_OPTIONS.map((o) => o.Key));
    const inspect = pick(params[PARAM.Inspect], INSPECT_KEYS);
    return {
        Page: pick(params[PARAM.Page], pages),
        Period: period,
        // Dates mean something only on a custom range; elsewhere they are stale and dropped.
        PeriodStart: period === 'custom' ? IsoDay(params[PARAM.PeriodStart]) : null,
        PeriodEnd: period === 'custom' ? IsoDay(params[PARAM.PeriodEnd]) : null,
        Companies: list(params[PARAM.Companies]),
        ProductCompanies: list(params[PARAM.ProductCompanies]),
        Owners: list(params[PARAM.Owners]),
        Pipelines: list(params[PARAM.Pipelines]),
        Inspect: inspect,
        // An argument means something only on a slice that takes one.
        InspectArg: inspect === 'stage' || inspect === 'owner' ? id(params[PARAM.InspectArg]) : null,
        Company: id(params[PARAM.Company]),
        Pipeline: id(params[PARAM.Pipeline]),
    };
}

/** The params to write. Every key is present; null removes it from the URL. */
export function SalesUrlParams(state: SalesUrlState): Record<string, string | null> {
    const list = (ids: readonly string[]): string | null => (ids.length ? CleanIDs(ids).join(',') : null);
    return {
        [PARAM.Page]: state.Page,
        [PARAM.Period]: state.Period,
        [PARAM.PeriodStart]: state.PeriodStart,
        [PARAM.PeriodEnd]: state.PeriodEnd,
        [PARAM.Companies]: list(state.Companies),
        [PARAM.ProductCompanies]: list(state.ProductCompanies),
        [PARAM.Owners]: list(state.Owners),
        [PARAM.Pipelines]: list(state.Pipelines),
        [PARAM.Inspect]: state.Inspect,
        [PARAM.InspectArg]: state.InspectArg,
        [PARAM.Company]: state.Company,
        [PARAM.Pipeline]: state.Pipeline,
    };
}

/** True when two states would write the same URL. */
export function SameSalesUrlState(a: SalesUrlState, b: SalesUrlState): boolean {
    const pa = SalesUrlParams(a);
    const pb = SalesUrlParams(b);
    return Object.keys(pa).every((k) => pa[k] === pb[k]) && LIST_FIELDS.every((f) => a[f].length === b[f].length);
}
