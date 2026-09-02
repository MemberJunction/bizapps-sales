/**
 * @fileoverview Pure inspect / chart projections for the Sales command-center dashboard.
 *
 * Kept out of the Angular component so the filter and slice rules can be tested without a provider,
 * and so the dashboard cannot quietly invent a second definition of "commit" or "slipped".
 *
 * Forecast slices use ForecastCategoryType FLAGS (IncludeInCommit / IncludeInBestCase), never the
 * category name. Status uses DealStatusType flags already stamped on the roster row.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { DealRosterRow } from '../workspace/deal-workspace.service';

export type InspectKey =
    | 'closing'
    | 'commit'
    | 'best'
    | 'pipe'
    | 'slipped'
    | 'noowner'
    | 'won'
    | 'week'
    | 'month'
    | 'later';

/** UTC date-only `YYYY-MM-DD`. Accepts an ISO string or a `Date` — v6 RunQuery can hand back either. */
export function UtcDatePart(value: string | Date): string {
    if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
}

export function TodayUtc(): string {
    return UtcDatePart(new Date());
}

function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m - 1, d + days)));
}

function monthEnd(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m, 0)));
}

function nextMonthEnd(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m + 1, 0)));
}

function amount(d: DealRosterRow): number {
    const n = Number(d.Amount);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Soonest expected close first, open deals only. The dashboard's default inspect — and the order
 * `75-dashboard.spec.ts` asserts against the database.
 */
export function ClosingSoon(deals: readonly DealRosterRow[], limit = 8): DealRosterRow[] {
    return deals
        .filter((d) => d.IsOpen && !!d.ExpectedCloseDate)
        .slice()
        .sort((a, b) => UtcDatePart(a.ExpectedCloseDate!).localeCompare(UtcDatePart(b.ExpectedCloseDate!)))
        .slice(0, limit);
}

export function FilterInspect(
    deals: readonly DealRosterRow[],
    key: InspectKey,
    today: string = TodayUtc(),
): DealRosterRow[] {
    const weekEnd = addDays(today, 7);
    const restMonth = monthEnd(today);
    const octEnd = nextMonthEnd(today);
    switch (key) {
        case 'closing':
            return ClosingSoon(deals, 8);
        case 'commit':
            return deals.filter((d) => d.IsOpen && d.IncludeInCommit);
        case 'best':
            return deals.filter((d) => d.IsOpen && d.IncludeInBestCase);
        case 'pipe':
            return deals.filter((d) => d.IsOpen);
        case 'slipped':
            return deals.filter((d) => d.IsPastExpectedClose);
        case 'noowner':
            return deals.filter((d) => d.IsOpen && !d.OwnerEmployee);
        case 'won':
            return deals.filter((d) => d.IsWon);
        case 'week':
            return deals.filter((d) => {
                if (!d.IsOpen || !d.ExpectedCloseDate) return false;
                const c = UtcDatePart(d.ExpectedCloseDate);
                return c >= today && c <= weekEnd;
            });
        case 'month':
            return deals.filter((d) => {
                if (!d.IsOpen || !d.ExpectedCloseDate) return false;
                const c = UtcDatePart(d.ExpectedCloseDate);
                return c > weekEnd && c <= restMonth;
            });
        case 'later':
            return deals.filter((d) => {
                if (!d.IsOpen) return false;
                if (!d.ExpectedCloseDate) return true;
                return UtcDatePart(d.ExpectedCloseDate) > octEnd;
            });
        default:
            return ClosingSoon(deals, 8);
    }
}

export interface ForecastSlice {
    Closed: number;
    Commit: number;
    BestOnly: number;
    PipeOnly: number;
}

/**
 * Incremental slices of the CUMULATIVE forecast flags.
 *
 * Commit ⊂ Best Case ⊂ Pipeline, so adding the three query columns is meaningless. The bar is
 * Closed (won) + Commit + (BestCase − Commit) + (open remainder).
 */
export function ForecastSlices(deals: readonly DealRosterRow[]): ForecastSlice {
    let Closed = 0;
    let Commit = 0;
    let BestOnly = 0;
    let PipeOnly = 0;
    for (const d of deals) {
        const amt = amount(d);
        if (d.IsWon) {
            Closed += amt;
        } else if (d.IsOpen) {
            if (d.IncludeInCommit) Commit += amt;
            else if (d.IncludeInBestCase) BestOnly += amt;
            else PipeOnly += amt;
        }
    }
    return { Closed, Commit, BestOnly, PipeOnly };
}

export interface FunnelStage {
    Label: string;
    Count: number;
    Amount: number;
}

export function StageFunnel(deals: readonly DealRosterRow[]): FunnelStage[] {
    const map = new Map<string, FunnelStage & { Order: number }>();
    for (const d of deals.filter((x) => x.IsOpen)) {
        const label = d.PipelineStage || 'Unstaged';
        const cur = map.get(label) ?? { Label: label, Count: 0, Amount: 0, Order: d.StageOrder ?? 999 };
        cur.Count += 1;
        cur.Amount += amount(d);
        map.set(label, cur);
    }
    return [...map.values()]
        .sort((a, b) => a.Order - b.Order)
        .map(({ Label, Count, Amount }) => ({ Label, Count, Amount }));
}

export interface CloseBucket {
    Key: InspectKey;
    Label: string;
    Count: number;
    Amount: number;
    Tone?: 'warn';
}

export function CloseBuckets(deals: readonly DealRosterRow[], today: string = TodayUtc()): CloseBucket[] {
    const sum = (rows: DealRosterRow[]): { Count: number; Amount: number } => ({
        Count: rows.length,
        Amount: rows.reduce((n, d) => n + amount(d), 0),
    });
    const past = sum(FilterInspect(deals, 'slipped', today));
    const week = sum(FilterInspect(deals, 'week', today));
    const month = sum(FilterInspect(deals, 'month', today));
    const later = sum(FilterInspect(deals, 'later', today));
    return [
        { Key: 'slipped', Label: 'Already past', ...past, Tone: past.Count ? 'warn' : undefined },
        { Key: 'week', Label: 'Next 7 days', ...week },
        { Key: 'month', Label: 'Rest of month', ...month },
        { Key: 'later', Label: 'Later / none', ...later },
    ];
}

export interface OwnerBar {
    Name: string;
    Amount: number;
}

export function OwnerCoverage(deals: readonly DealRosterRow[]): OwnerBar[] {
    const map = new Map<string, number>();
    for (const d of deals.filter((x) => x.IsOpen && x.IncludeInCommit)) {
        const name = d.OwnerEmployee?.trim() || 'Unowned';
        map.set(name, (map.get(name) ?? 0) + amount(d));
    }
    return [...map.entries()]
        .map(([Name, Amount]) => ({ Name, Amount }))
        .sort((a, b) => b.Amount - a.Amount); // money-grep-allow: comparator only — the subtraction yields a sort order, never a money value that is stored or shown
}

export function WeightedOpen(deals: readonly DealRosterRow[]): number {
    return deals.filter((d) => d.IsOpen).reduce((n, d) => n + (Number(d.WeightedAmount) || 0), 0);
}
