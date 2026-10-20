/**
 * @fileoverview The dashboard's filter bar: selling company, product company, deal owner, pipeline
 * (bc-aidp-next-golive#350).
 *
 * Pure, like the other dashboard modules, so the rules can be tested without a provider.
 *
 * ── THE FILTERS ARE APPLIED BY THE QUERIES ──────────────────────────────────────────────────────
 *
 * Every list goes to `Sales: Dashboard Summary`, `Sales: Win Rate by Count and Value` and
 * `Sales: Deal Roster` as a query parameter, and each query narrows its rows with it. The browser never
 * re-filters what a query returned. The Inspect grid reads the same lists through `InspectCriteriaWhere`,
 * so a tile and the deals listed under it are narrowed by the same rule.
 *
 * An empty list is "All". It is left out of the parameters rather than sent empty, because the queries
 * test each list with `{% if %}` and `sqlIn` renders an empty list as `(NULL)`, which matches nothing.
 *
 * ── PRODUCT COMPANY IS A DIFFERENT QUESTION FROM SELLING COMPANY ────────────────────────────────
 *
 * A deal's selling company is `Deal.CompanyID`. Its product companies are the companies stamped on the
 * lines of its order (`OrderLine.CompanyID`, which orders copies from the product). One company sells
 * products that belong to others, so both filters exist. A deal matches the product filter when at
 * least one of its lines belongs to a selected company, and then counts once at its full amount. A deal
 * with no lines cannot match, so it drops out when a product company is chosen; the summary reports how
 * many did (`NoLinesDealCount`) so the filter chip can say so.
 *
 * @module @mj-biz-apps/sales-ng
 */

export interface DashboardFilters {
    /** Selling companies, `Deal.CompanyID`. Empty is every company. */
    CompanyIDs: readonly string[];
    /** Companies that own a product on the deal's lines, `OrderLine.CompanyID`. Empty is every deal. */
    ProductCompanyIDs: readonly string[];
    /** Deal owners, `Deal.OwnerEmployeeID`. Empty is every owner. */
    OwnerEmployeeIDs: readonly string[];
    /** Pipelines, `Deal.PipelineID`. Empty is every pipeline that counts toward the forecast. */
    PipelineIDs: readonly string[];
}

/** No filter: every figure spans the whole book, as the dashboard did before the filter bar. */
export const NO_FILTERS: DashboardFilters = { CompanyIDs: [], ProductCompanyIDs: [], OwnerEmployeeIDs: [], PipelineIDs: [] };

/** The query parameter each list is sent as. The three queries declare the same four names. */
const PARAMETER: Record<keyof DashboardFilters, string> = {
    CompanyIDs: 'CompanyIDs',
    ProductCompanyIDs: 'ProductCompanyIDs',
    OwnerEmployeeIDs: 'OwnerEmployeeIDs',
    PipelineIDs: 'PipelineIDs',
};

const FILTER_KEYS = Object.keys(PARAMETER) as (keyof DashboardFilters)[];

/** Ids round-trip through JSON and SQL in different cases. */
const idKey = (id: string): string => id.trim().toLowerCase();

/** A list without blanks or repeats, in the order it was given. */
export function CleanIDs(ids: readonly (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ids) {
        const id = String(raw ?? '').trim();
        if (id && !seen.has(idKey(id))) {
            seen.add(idKey(id));
            out.push(id);
        }
    }
    return out;
}

/** True when any filter narrows the book. */
export function HasFilters(filters: DashboardFilters): boolean {
    return FILTER_KEYS.some((k) => filters[k].length > 0);
}

/** True when two filter sets select the same deals. Order and case do not matter. */
export function SameFilters(a: DashboardFilters, b: DashboardFilters): boolean {
    return FILTER_KEYS.every((k) => {
        const x = new Set(a[k].map(idKey));
        const y = new Set(b[k].map(idKey));
        return x.size === y.size && [...x].every((id) => y.has(id));
    });
}

/**
 * The filters as query parameters: one array per list that narrows anything, nothing for a list that
 * is "All". Pass the result alongside the period parameters.
 */
export function FilterParameters(filters: DashboardFilters): Record<string, string[]> {
    const parameters: Record<string, string[]> = {};
    for (const key of FILTER_KEYS) {
        const ids = CleanIDs(filters[key]);
        if (ids.length) {
            parameters[PARAMETER[key]] = ids;
        }
    }
    return parameters;
}

/** True when `id` is in `ids`, ignoring case. */
export function HasID(ids: readonly string[], id: string | null | undefined): boolean {
    return !!id && ids.some((x) => idKey(x) === idKey(id));
}

/** `ids` with `id` added, or removed when it is already there. */
export function ToggleID(ids: readonly string[], id: string): string[] {
    return HasID(ids, id) ? ids.filter((x) => idKey(x) !== idKey(id)) : [...ids, id];
}

/** One choice in a filter list. */
export interface FilterOption {
    ID: string;
    Name: string;
}

/** Options with duplicates removed, sorted by name, so each list reads the same way every load. */
export function SortedOptions(options: readonly FilterOption[]): FilterOption[] {
    const byID = new Map<string, FilterOption>();
    for (const o of options) {
        if (o.ID && !byID.has(idKey(o.ID))) {
            byID.set(idKey(o.ID), o);
        }
    }
    return [...byID.values()].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }));
}

/**
 * The pipelines the Pipeline filter offers: those of the selected selling companies, or every pipeline
 * when no company is selected. A selected pipeline outside the companies is dropped by
 * {@link PipelinesWithinCompanies} rather than kept as a filter the list no longer shows.
 */
export function PipelineOptionsFor<T extends { ID: string; CompanyID: string }>(pipelines: readonly T[], companyIDs: readonly string[]): T[] {
    return companyIDs.length ? pipelines.filter((p) => HasID(companyIDs, p.CompanyID)) : [...pipelines];
}

/** The selected pipelines that still belong to one of the selected companies. */
export function PipelinesWithinCompanies(
    pipelineIDs: readonly string[],
    pipelines: readonly { ID: string; CompanyID: string }[],
    companyIDs: readonly string[],
): string[] {
    if (!companyIDs.length || !pipelines.length) {
        return [...pipelineIDs];
    }
    const allowed = PipelineOptionsFor(pipelines, companyIDs).map((p) => p.ID);
    return pipelineIDs.filter((id) => HasID(allowed, id));
}

/** "Acme" for one, "Acme +2" for three, "All" for none: a filter button's label. */
export function SelectionLabel(ids: readonly string[], options: readonly FilterOption[]): string {
    if (!ids.length) {
        return 'All';
    }
    const first = options.find((o) => HasID([o.ID], ids[0]))?.Name ?? '1 selected';
    return ids.length === 1 ? first : `${first} +${ids.length - 1}`;
}
