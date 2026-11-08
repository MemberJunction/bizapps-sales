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
import { OrderPipelinesByCompany, type CompanyPipeline } from '../data/company-pipelines';
import { BusinessToday, UtcDatePart } from './dashboard-dates';
import { WithinWindow, type PeriodWindow } from './dashboard-period';

/**
 * Re-exported so every existing import path (and `public-api.ts`'s `export *`) keeps working. The
 * definitions moved to `dashboard-dates.ts` to break the inspect <-> period import cycle -- see that
 * file's header for what the cycle would have cost.
 */
export { BusinessToday, UtcDatePart };

/**
 * The rows the dashboard's current-book figures read: every closed deal, plus every open deal whose
 * pipeline counts toward the forecast (`Pipeline.IncludeInForecast`).
 *
 * A pipeline that holds historical deals is flagged out so its open rows cannot be counted beside the
 * live ones. Its closed deals stay: a win there is still a win. The board does NOT go through this --
 * it shows every deal, so such a pipeline is still viewable. `dashboard-summary.sql` applies the same
 * rule to the headline tiles.
 */
export function InForecast(deals: readonly DealRosterRow[]): DealRosterRow[] {
    return deals.filter((d) => !d.IsOpen || d.PipelineIncludeInForecast);
}

/**
 * The rail badge's count: open deals in the forecast past their expected close date, across the whole
 * book.
 *
 * The badge sits in the rail, outside the dashboard, so the filter bar must not move it. With no filter
 * set the summary's count already describes the whole book and is used as is. With a filter set the
 * summary is narrowed, so the count comes from the section's unfiltered roster instead, which the filter
 * bar never narrows (the Board reads its own, filtered one since bc-aidp-next-golive#351). The period
 * plays no part: a deal past its close date is past it whatever period is selected.
 */
export function BookSlippedCount(
    bookDeals: readonly DealRosterRow[],
    summaryCount: number | null | undefined,
    filtered: boolean,
): number {
    if (!filtered && summaryCount != null) {
        return summaryCount;
    }
    return InForecast(bookDeals).filter((d) => d.IsPastExpectedClose).length;
}

/**
 * The summary the headline tiles may show: none while the roster is refused (bizapps-sales#137).
 *
 * Tiles reduced from `Sales: Dashboard Summary` above an empty roster is two figures disagreeing with
 * no error, which is the state the refusal exists to prevent. Both places that set the summary — a
 * refresh and a period change — go through this, so a period change cannot put numbers back.
 */
export function TileSummary<T>(summary: T | null, rosterError: string | null): T | null {
    return rosterError ? null : summary;
}

/**
 * Whether a WON deal falls inside the dashboard's selected period.
 *
 * ── ONE PREDICATE, TWO CALLERS, ON PURPOSE ──────────────────────────────────────────────────────
 *
 * {@link ForecastSlices} totals the stack's Closed segment and {@link FilterInspect}'s `won` case
 * lists the deals behind it. If those two ever branched differently, the Won tile would report a
 * figure whose own drill-through showed a different set of deals — and nothing on screen would say
 * which was wrong. Sharing the predicate makes that disagreement unrepresentable rather than merely
 * unlikely.
 *
 * NO WINDOW MEANS EVERY WON DEAL, which is what the "All time" option selects. A bounded window
 * excludes a deal with no `ActualCloseDate`: the question is "did this land in the period", and a
 * deal that never recorded when it closed cannot answer it. It is still counted under All time, so
 * such a deal is never invisible everywhere at once. `dashboard-summary.sql` applies the identical
 * rule server-side, which is what keeps the tile and this list in agreement.
 */
export function WonInPeriod(d: DealRosterRow, window?: PeriodWindow): boolean {
    if (!d.IsWon) {
        return false;
    }
    if (!window || (window.Start === null && window.End === null)) {
        return true;
    }
    if (!d.ActualCloseDate) {
        return false;
    }
    return WithinWindow(UtcDatePart(d.ActualCloseDate), window);
}

/**
 * Whether an OPEN deal belongs to the selected period: its expected close date is inside the window
 * (bc-aidp-next-golive#350).
 *
 * An open deal has not closed, so the date that places it in a period is the one it is expected to
 * close on. A forecast for "this quarter" is the deals expected to close this quarter. With no window
 * ("All time") every open deal belongs; with a bounded one, a deal with no expected close date belongs
 * to none, and the dashboard reports those separately as a count. `dashboard-summary.sql` applies the
 * identical rule in its `OpenInPeriod` flag, which is what keeps the tiles and these lists in agreement.
 */
export function OpenInPeriod(d: DealRosterRow, window?: PeriodWindow): boolean {
    // A won deal is never open pipeline, even under a status that sets both flags: it is counted once,
    // as Won. The summary query's OpenInPeriod flag says the same.
    if (!d.IsOpen || d.IsWon) {
        return false;
    }
    if (!window || (window.Start === null && window.End === null)) {
        return true;
    }
    if (!d.ExpectedCloseDate) {
        return false;
    }
    return WithinWindow(UtcDatePart(d.ExpectedCloseDate), window);
}

/**
 * Whether an open deal counts toward the pipeline: its forecast category does not leave it out
 * (`ForecastCategoryType.IncludeInPipeline`). Omitted deals stay open and stay in the open count, but
 * the pipeline money figures leave them out, as the forecast queries and the snapshot do.
 * `dashboard-summary.sql` applies the same rule to the Open pipeline tile.
 */
export function InPipeline(d: DealRosterRow): boolean {
    return d.IsOpen && d.IncludeInPipeline;
}

/** A pipeline deal in a Commit category: the Commit tile and the forecast's Commit segment. */
export function InCommit(d: DealRosterRow): boolean {
    return InPipeline(d) && d.IncludeInCommit;
}

/**
 * A pipeline deal in Best case but not in Commit: the forecast's Best case segment. Commit ⊂ Best case,
 * so a Commit deal is already counted in its own segment.
 */
export function InBestCaseOnly(d: DealRosterRow): boolean {
    return InPipeline(d) && !d.IncludeInCommit && d.IncludeInBestCase;
}

/**
 * The forecast's Pipeline segment: pipeline deals in neither Commit nor Best case.
 *
 * {@link ForecastSlices} totals the segment with it and {@link FilterInspect}'s `remainder` case
 * lists the deals behind it, so the segment and its drill-down count the same deals.
 */
export function InRemainder(d: DealRosterRow): boolean {
    return InPipeline(d) && !d.IncludeInCommit && !d.IncludeInBestCase;
}

/**
 * What the deal list under the dashboard can show. Each key is one figure on the page, and the list it
 * selects is the deals that figure counts.
 *
 * `stage` and `owner` take an argument (the stage ID, or the owner's employee ID with
 * {@link NO_OWNER_ARG} for deals with none); see {@link FilterInspect}.
 */
export type InspectKey =
    | 'closing'
    | 'commit'
    | 'best'
    | 'pipe'
    | 'weighted'
    | 'remainder'
    | 'slipped'
    | 'noowner'
    | 'nodate'
    | 'idle'
    | 'won'
    | 'closed'
    | 'week'
    | 'month'
    | 'later'
    | 'stage'
    | 'owner';

/** Every {@link InspectKey}, for the URL parser. */
export const INSPECT_KEYS: readonly InspectKey[] = [
    'closing', 'commit', 'best', 'pipe', 'weighted', 'remainder', 'slipped', 'noowner', 'nodate', 'idle',
    'won', 'closed', 'week', 'month', 'later', 'stage', 'owner',
];

/** The keys whose figures the period bounds. Every other key ignores it (see each case). */
export const PERIOD_BOUND_KEYS: readonly InspectKey[] = [
    'commit', 'best', 'pipe', 'weighted', 'remainder', 'won', 'closed', 'week', 'month', 'later', 'stage', 'owner',
];

/** The `owner` argument for deals with no owner. */
export const NO_OWNER_ARG = 'none';

function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m - 1, d + days)));
}

function monthEnd(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m, 0)));
}

function amount(d: DealRosterRow): number {
    const n = Number(d.Amount);
    return Number.isFinite(n) ? n : 0;
}

/** The business-day bounds the close-date buckets split on. */
export interface InspectDayBounds {
    /** Seven days on from today: the end of "next 7 days". */
    WeekEnd: string;
    /** The last day of today's month: the end of "rest of month". */
    MonthEnd: string;
    /**
     * Where "later" starts: after the month, or after the week when the week runs past month end, so
     * the buckets cover every dated open deal from today on.
     */
    LaterFrom: string;
    /** Thirty days on from today: the end of the default list, "closing in the next 30 days". */
    ClosingEnd: string;
}

/** {@link InspectDayBounds} for `today`. Shared by the roster filter and the grid's server-side filter. */
export function InspectDateBounds(today: string): InspectDayBounds {
    const WeekEnd = addDays(today, 7);
    const MonthEnd = monthEnd(today);
    return { WeekEnd, MonthEnd, LaterFrom: WeekEnd > MonthEnd ? WeekEnd : MonthEnd, ClosingEnd: addDays(today, 30) };
}

/**
 * Open deals expected to close from today through 30 days on, soonest first: the dashboard's default
 * list. Not bounded by the period: it answers "what is about to close", whatever period is selected.
 */
export function ClosingSoon(deals: readonly DealRosterRow[], today: string = BusinessToday()): DealRosterRow[] {
    const end = InspectDateBounds(today).ClosingEnd;
    return deals
        .filter((d) => {
            if (!d.IsOpen || !d.ExpectedCloseDate) return false;
            const c = UtcDatePart(d.ExpectedCloseDate);
            return c >= today && c <= end;
        })
        .slice()
        .sort((a, b) => UtcDatePart(a.ExpectedCloseDate!).localeCompare(UtcDatePart(b.ExpectedCloseDate!)));
}

/** Ids round-trip through JSON and SQL in different cases. */
const idKey = (id: string | null | undefined): string => String(id ?? '').toLowerCase();

/** Whether a dated open deal's expected close falls in `[from, to]`, either end optional. */
function closesBetween(d: DealRosterRow, from: string | null, to: string | null, fromExclusive = false): boolean {
    if (!d.IsOpen || !d.ExpectedCloseDate) return false;
    const c = UtcDatePart(d.ExpectedCloseDate);
    if (from !== null && (fromExclusive ? c <= from : c < from)) return false;
    return !(to !== null && c > to);
}

/**
 * The deals one figure on the dashboard counts, from roster rows the filter bar has already narrowed.
 *
 * Each case is the client form of the same case in `InspectCriteriaWhere` (the grid's server filter)
 * and of the matching column in `dashboard-summary.sql`, so the figure, this list and the grid agree.
 *
 * @param window The selected period. The forecast, pipeline, stage, owner and date-bucket cases count
 * open deals expected to close in it ({@link OpenInPeriod}); `won` reads `ActualCloseDate`. The
 * attention cases (`slipped`, `noowner`, `nodate`, `idle`) and `closing` ignore it: they are about the
 * open book today. `closed` is the win rate's deals and needs closed rows, which the dashboard's open
 * roster does not hold, so the grid reads it from the server.
 * @param arg The stage ID for `stage`; the owner's employee ID, or {@link NO_OWNER_ARG}, for `owner`.
 * @param idle The IDs of open deals idle past their stage's limit, for `idle`.
 */
export function FilterInspect(
    deals: readonly DealRosterRow[],
    key: InspectKey,
    today: string = BusinessToday(),
    window?: PeriodWindow,
    arg: string | null = null,
    idle: ReadonlySet<string> = new Set(),
): DealRosterRow[] {
    const { WeekEnd: weekEnd, MonthEnd: restMonth, LaterFrom: laterFrom } = InspectDateBounds(today);
    const inPeriod = (d: DealRosterRow): boolean => OpenInPeriod(d, window);
    switch (key) {
        case 'closing':
            return ClosingSoon(deals, today);
        case 'commit':
            return deals.filter((d) => inPeriod(d) && InCommit(d));
        case 'best':
            return deals.filter((d) => inPeriod(d) && InBestCaseOnly(d));
        case 'pipe':
        case 'weighted':
            return deals.filter((d) => inPeriod(d) && InPipeline(d));
        case 'remainder':
            return deals.filter((d) => inPeriod(d) && InRemainder(d));
        case 'slipped':
            return deals.filter((d) => d.IsPastExpectedClose);
        case 'noowner':
            return deals.filter((d) => d.IsOpen && !d.OwnerEmployeeID);
        case 'nodate':
            return deals.filter((d) => d.IsOpen && !d.ExpectedCloseDate);
        case 'idle':
            return deals.filter((d) => d.IsOpen && idle.has(idKey(d.ID)));
        case 'won':
            return deals.filter((d) => WonInPeriod(d, window));
        case 'closed':
            return deals.filter((d) => d.IsClosed && ClosedInPeriod(d, window));
        case 'week':
            return deals.filter((d) => inPeriod(d) && closesBetween(d, today, weekEnd));
        case 'month':
            return deals.filter((d) => inPeriod(d) && closesBetween(d, weekEnd, restMonth, true));
        case 'later':
            return deals.filter((d) => inPeriod(d) && closesBetween(d, laterFrom, null, true));
        case 'stage':
            return deals.filter((d) => inPeriod(d) && InStage(d, arg));
        case 'owner':
            return deals.filter((d) => inPeriod(d) && InCommit(d) && OwnerKey(d) === idKey(arg));
        default:
            return ClosingSoon(deals, today);
    }
}

/** Whether a CLOSED deal closed inside the window, on `ActualCloseDate`; the win rate's denominator. */
export function ClosedInPeriod(d: DealRosterRow, window?: PeriodWindow): boolean {
    if (!d.IsClosed) {
        return false;
    }
    if (!window || (window.Start === null && window.End === null)) {
        return true;
    }
    return !!d.ActualCloseDate && WithinWindow(UtcDatePart(d.ActualCloseDate), window);
}

/**
 * Whether a deal is in the stage a `stage` argument names: a stage ID, or `unstaged:<pipeline ID>` for
 * the deals of that pipeline that have no stage.
 */
export function InStage(d: DealRosterRow, arg: string | null): boolean {
    const key = idKey(arg);
    if (key.startsWith('unstaged')) {
        const pipeline = key.slice('unstaged:'.length);
        return !d.PipelineStageID && (!pipeline || idKey(d.PipelineID) === pipeline);
    }
    return StageKey(d) === key;
}

/** A deal's stage as a {@link FunnelStage} key: its stage ID, or `unstaged`. */
export function StageKey(d: DealRosterRow): string {
    return d.PipelineStageID ? idKey(d.PipelineStageID) : 'unstaged';
}

/** A deal's owner as an `owner` argument: the employee ID, or {@link NO_OWNER_ARG}. */
export function OwnerKey(d: DealRosterRow): string {
    return d.OwnerEmployeeID ? idKey(d.OwnerEmployeeID) : NO_OWNER_ARG;
}

export interface ForecastSlice {
    Closed: number;
    Commit: number;
    BestOnly: number;
    PipeOnly: number;
}

/**
 * Incremental slices of the CUMULATIVE forecast flags, over the deals {@link InPipeline} keeps.
 *
 * Commit ⊂ Best Case ⊂ Pipeline, so adding the three query columns is meaningless. The bar is
 * Won + Commit + (Best case − Commit) + (the rest of the pipeline).
 *
 * ── ONE PERIOD FOR EVERY SEGMENT (bc-aidp-next-golive#350) ──────────────────────────────────────
 *
 * `Closed` is bounded on `ActualCloseDate`, the day a win landed; the three open segments on
 * `ExpectedCloseDate`, the day each deal is expected to close ({@link OpenInPeriod}). So the bar is
 * one question: what was won in the period, and what is expected to close in it. "All time" is the
 * whole book. The dashboard renders these figures from `Sales: Dashboard Summary`, which applies the
 * same rule; this is the client form, kept for the deal lists and the measures harness.
 *
 * @param window Omitted means every won deal and every open deal, which is the "All time" option.
 */
export function ForecastSlices(deals: readonly DealRosterRow[], window?: PeriodWindow): ForecastSlice {
    let Closed = 0;
    let Commit = 0;
    let BestOnly = 0;
    let PipeOnly = 0;
    for (const d of deals) {
        const amt = amount(d);
        if (d.IsWon) {
            // A won deal outside the window contributes to NOTHING here -- not to Closed, and not to
            // the open segments either, because it is not open.
            if (WonInPeriod(d, window)) {
                Closed += amt;
            }
        } else if (OpenInPeriod(d, window) && InPipeline(d)) {
            if (d.IncludeInCommit) Commit += amt;
            else if (d.IncludeInBestCase) BestOnly += amt;
            else PipeOnly += amt;
        }
    }
    return { Closed, Commit, BestOnly, PipeOnly };
}

export interface FunnelStage {
    /** The stage's ID, or `unstaged`. Names are not unique across pipelines, so they do not key. */
    Key: string;
    Label: string;
    Count: number;
    Amount: number;
}

/** A pipeline the Stage mix card can show: one that has open deals. */
export interface FunnelPipeline {
    ID: string;
    Name: string;
}

/**
 * The pipelines with open deals, in the board's picker order (default pipeline first) when the
 * pipeline lookups have loaded. Before they have, or for a pipeline missing from them, in order of
 * name, so the card still has a choice to offer.
 */
export function FunnelPipelines(
    deals: readonly DealRosterRow[],
    pipelines: readonly CompanyPipeline[] = [],
): FunnelPipeline[] {
    const open = new Map<string, FunnelPipeline>();
    for (const d of deals) {
        if (d.IsOpen && d.PipelineID && !open.has(idKey(d.PipelineID))) {
            open.set(idKey(d.PipelineID), { ID: d.PipelineID, Name: d.Pipeline || 'Pipeline' });
        }
    }
    const ordered: FunnelPipeline[] = [];
    for (const p of OrderPipelinesByCompany(pipelines)) {
        const hit = open.get(idKey(p.ID));
        if (hit) {
            ordered.push(hit);
            open.delete(idKey(p.ID));
        }
    }
    const rest = [...open.values()].sort((a, b) => a.Name.localeCompare(b.Name));
    return [...ordered, ...rest];
}

/**
 * One pipeline's open deals by stage, in that pipeline's stage order.
 *
 * Each pipeline numbers its own stages, so stages from two pipelines cannot share one sequence, and
 * two pipelines may name a stage the same. The card therefore shows one pipeline at a time, keyed on
 * the stage's ID. Omitting `pipelineID` takes every open deal, still keyed on stage ID. `window` keeps
 * the open deals expected to close in the period ({@link OpenInPeriod}); omitted, every open deal.
 */
export function StageFunnel(deals: readonly DealRosterRow[], pipelineID?: string | null, window?: PeriodWindow): FunnelStage[] {
    const map = new Map<string, FunnelStage & { Order: number }>();
    const inPipeline = (d: DealRosterRow): boolean => pipelineID == null || idKey(d.PipelineID) === idKey(pipelineID);
    for (const d of deals.filter((x) => OpenInPeriod(x, window) && inPipeline(x))) {
        const key = StageKey(d);
        const cur = map.get(key) ?? {
            Key: key,
            Label: d.PipelineStageID ? d.PipelineStage || 'Stage' : 'Unstaged',
            Count: 0,
            Amount: 0,
            Order: d.PipelineStageID ? (d.StageOrder ?? 999) : 1000,
        };
        cur.Count += 1;
        cur.Amount += amount(d);
        map.set(key, cur);
    }
    return [...map.values()]
        .sort((a, b) => a.Order - b.Order)
        .map(({ Key, Label, Count, Amount }) => ({ Key, Label, Count, Amount }));
}

export interface CloseBucket {
    Key: InspectKey;
    Label: string;
    Count: number;
    Amount: number;
}

/**
 * The Expected to close buckets: Next 7 days, Rest of month, Later, and No date.
 *
 * THE DATED BUCKETS FOLLOW THE PERIOD. Each holds the open deals expected to close in its span AND in
 * the selected period, so under a past period "Next 7 days" and "Rest of month" read empty: nothing
 * expected to close in a past quarter is still ahead. "No date" lists every undated open deal whatever
 * the period, since no period can place them. Deals already past their expected close are not a
 * bucket: they are Needs attention's "Past close date".
 */
export function CloseBuckets(
    deals: readonly DealRosterRow[],
    today: string = BusinessToday(),
    window?: PeriodWindow,
): CloseBucket[] {
    const sum = (rows: DealRosterRow[]): { Count: number; Amount: number } => ({
        Count: rows.length,
        Amount: rows.reduce((n, d) => n + amount(d), 0),
    });
    return [
        { Key: 'week', Label: 'Next 7 days', ...sum(FilterInspect(deals, 'week', today, window)) },
        { Key: 'month', Label: 'Rest of month', ...sum(FilterInspect(deals, 'month', today, window)) },
        { Key: 'later', Label: 'Later', ...sum(FilterInspect(deals, 'later', today, window)) },
        { Key: 'nodate', Label: 'No date', ...sum(FilterInspect(deals, 'nodate', today, window)) },
    ];
}

export interface OwnerBar {
    /** The owner's employee ID, or {@link NO_OWNER_ARG}: the `owner` list's argument. */
    Key: string;
    Name: string;
    Amount: number;
}

/**
 * Commit by deal owner: the Commit deals expected to close in the period, summed per owner. Each
 * deal counts once, under `Deal.OwnerEmployeeID`, the owner-role team member `DealEntityServer`
 * stamps, so a deal with several team members is not counted several times.
 */
export function OwnerCoverage(deals: readonly DealRosterRow[], window?: PeriodWindow): OwnerBar[] {
    const map = new Map<string, OwnerBar>();
    for (const d of deals.filter((x) => OpenInPeriod(x, window) && InCommit(x))) {
        const key = OwnerKey(d);
        // golive#207 replaced "Unowned" with "No owner" on the deal form's Situation card. This is
        // the same label on a chart axis, so it says the same thing.
        const name = (d.OwnerEmployeeID && d.OwnerEmployee?.trim()) || 'No owner';
        const bar = map.get(key) ?? { Key: key, Name: name, Amount: 0 };
        bar.Amount += amount(d);
        map.set(key, bar);
    }
    return [...map.values()]
        .sort((a, b) => b.Amount - a.Amount); // money-grep-allow: comparator only — the subtraction yields a sort order, never a money value that is stored or shown
}

/** Weighted pipeline: `WeightedAmount` over the pipeline deals expected to close in the period. */
export function WeightedOpen(deals: readonly DealRosterRow[], window?: PeriodWindow): number {
    return deals.filter((d) => OpenInPeriod(d, window) && InPipeline(d)).reduce((n, d) => n + (Number(d.WeightedAmount) || 0), 0);
}
