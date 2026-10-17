/**
 * @fileoverview What the Sales section keeps in the tab's query params (bizapps-sales#371).
 *
 * Page, reporting period, Inspect slice and the Board's company and pipeline. A reload or a shared
 * link opens the section where it was left rather than on Dashboard with every default.
 *
 * A null field is the DEFAULT, and a default is left out of the URL, so a section on its defaults has
 * a clean address. Every param is checked against the values the section offers: a hand-edited or
 * stale link falls back to the default for that field rather than selecting something that does not
 * exist. Company and pipeline are record IDs, checked by the board against what it loaded.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { InspectKey } from '../pages/dashboard-inspect';
import { PERIOD_OPTIONS, type PeriodKey } from '../pages/dashboard-period';

export interface SalesUrlState {
    Page: string | null;
    Period: PeriodKey | null;
    Inspect: InspectKey | null;
    Company: string | null;
    Pipeline: string | null;
}

/** The query param each field is written to. */
const PARAM = {
    Page: 'page',
    Period: 'period',
    Inspect: 'inspect',
    Company: 'company',
    Pipeline: 'pipeline',
} as const;

const INSPECT_KEYS: readonly InspectKey[] = [
    'closing', 'commit', 'best', 'pipe', 'open', 'remainder', 'slipped', 'noowner', 'won', 'week', 'month', 'later',
];

/** A section on its defaults. */
export const DEFAULT_SALES_URL_STATE: SalesUrlState = { Page: null, Period: null, Inspect: null, Company: null, Pipeline: null };

/** Reads the state from query params. `pages` is the section's page IDs, so an unknown page is ignored. */
export function ParseSalesUrlState(params: Record<string, string>, pages: readonly string[]): SalesUrlState {
    const pick = <T extends string>(value: string | undefined, allowed: readonly T[]): T | null =>
        value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null;
    const id = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);
    return {
        Page: pick(params[PARAM.Page], pages),
        Period: pick(params[PARAM.Period], PERIOD_OPTIONS.map((o) => o.Key)),
        Inspect: pick(params[PARAM.Inspect], INSPECT_KEYS),
        Company: id(params[PARAM.Company]),
        Pipeline: id(params[PARAM.Pipeline]),
    };
}

/** The params to write. Every key is present; null removes it from the URL. */
export function SalesUrlParams(state: SalesUrlState): Record<string, string | null> {
    return {
        [PARAM.Page]: state.Page,
        [PARAM.Period]: state.Period,
        [PARAM.Inspect]: state.Inspect,
        [PARAM.Company]: state.Company,
        [PARAM.Pipeline]: state.Pipeline,
    };
}

/** True when two states would write the same URL. */
export function SameSalesUrlState(a: SalesUrlState, b: SalesUrlState): boolean {
    return a.Page === b.Page && a.Period === b.Period && a.Inspect === b.Inspect && a.Company === b.Company && a.Pipeline === b.Pipeline;
}
