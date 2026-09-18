/**
 * @fileoverview Fiscal period windows for the Sales command-center dashboard.
 *
 * Pure, for the same reason `dashboard-inspect.ts` is pure: every claim in here is a boundary claim,
 * and a boundary is the one thing that can be proved in milliseconds without a provider or a browser.
 *
 * ── WHERE THE FISCAL YEAR START COMES FROM, AND WHY IT IS NOT DEFINED HERE ──────────────────────
 *
 * It is READ, never invented. `__mj_BizAppsAccounting.AccountingCompanyProfile` already carries
 * `FiscalYearStartMonth` / `FiscalYearStartDay` per company — that table is an IsA child of
 * `__mj.Company`, so its `ID` IS the company's — and bizapps-accounting already derives a fiscal year
 * from those two columns in `JournalEntryEntityServer.deriveFiscalYear()`. Sales declares accounting
 * as a dependency in `mj-app.json` and its own `scripts/dev/seed-revenue-stack.sql` writes those very
 * columns, so this is a fact the workspace already holds in one place.
 *
 * Storing a second fiscal year start in sales would give the same fact two homes, which is how two
 * apps come to disagree about what "FY26" means while both look right. `DealWorkspaceService` fetches
 * the rows; {@link ResolveFiscalYearStart} decides what they amount to; everything below is arithmetic.
 *
 * THE YEAR LABEL MATCHES ACCOUNTING'S CONVENTION — a fiscal year is labelled by the calendar year it
 * STARTS in, which is what `deriveFiscalYear` documents. Diverging would be worse than having no
 * label, because both would be plausible.
 *
 * ── EVERYTHING IS UTC, AND EVERYTHING IS A DATE-ONLY STRING ─────────────────────────────────────
 *
 * `YYYY-MM-DD` throughout, built with `Date.UTC` / `getUTC*`. Two reasons, both load-bearing: the
 * columns these bound (`ActualCloseDate`, `ExpectedCloseDate`) are SQL DATEs, and a local-time
 * boundary moves the first and last day of every period for anyone west of Greenwich. Lexical
 * comparison on this format IS chronological, so no `Date` object survives past construction.
 *
 * @module @mj-biz-apps/sales-ng
 */
// From the leaf date module, NOT from `dashboard-inspect` -- importing it here would close an
// ES-module cycle, because inspect imports `WithinWindow` from this file. See `dashboard-dates.ts`.
import { TodayUtc, UtcDatePart } from './dashboard-dates';

/** The four windows the dashboard offers. `alltime` is unbounded, not a very wide bound. */
export type PeriodKey = 'quarter' | 'lastquarter' | 'year' | 'alltime';

/** A fiscal year start, as `AccountingCompanyProfile` stores it. Month is 1-12, day 1-31. */
export interface FiscalYearStart {
    Month: number;
    Day: number;
}

/** 1 January — what the dashboard falls back to when no single fiscal start can be established. */
export const CALENDAR_YEAR_START: FiscalYearStart = { Month: 1, Day: 1 };

/**
 * Why the dashboard is using the fiscal start it is using.
 *
 * Carried rather than collapsed to a boolean because the three non-`profile` cases are different
 * facts about the deployment, and the selector says which one it hit. A period control whose
 * boundaries are invisible is the same defect class this whole feature exists to fix.
 */
export type FiscalBasis =
    /**
     * NOTHING HAS BEEN READ YET -- the component's state before `LoadFiscalYearStart` resolves.
     *
     * {@link ResolveFiscalYearStart} never returns it; only a caller holding a pre-load value does.
     * It exists because the selector renders outside the dashboard's loading guard, so seeding that
     * state with `no-accounting` made the basis line assert "BizApps Accounting not installed" on
     * every load of a host where it IS installed -- and left that assertion on screen permanently if
     * the read threw. An unresolved basis is a different fact from an absent app and says so.
     */
    | 'pending'
    /** Every active profile agreed, and this is what they said. */
    | 'profile'
    /** bizapps-accounting is not installed on this host. */
    | 'no-accounting'
    /** Accounting is installed, but no active company profile exists yet. */
    | 'no-profiles'
    /** Two or more active profiles name DIFFERENT fiscal starts, so there is no single answer. */
    | 'mixed';

export interface FiscalYearStartResolution {
    Start: FiscalYearStart;
    Basis: FiscalBasis;
}

/**
 * An inclusive date window, or an unbounded one.
 *
 * `null` means NO BOUND, which is exactly what the queries want: `dashboard-summary.sql`,
 * `win-rate.sql` and `deal-roster.sql` all wrap their period predicates in `{% if PeriodStart %}`,
 * so omitting the parameter omits the clause. It does not mean "unknown".
 */
export interface PeriodWindow {
    Key: PeriodKey;
    /** The selector's own label, e.g. "This quarter". */
    Label: string;
    /** Inclusive UTC `YYYY-MM-DD`, or null for no lower bound. */
    Start: string | null;
    /** Inclusive UTC `YYYY-MM-DD`, or null for no upper bound. */
    End: string | null;
}

/** The selector's options, in the order the issue asked for them. First is the default. */
export const PERIOD_OPTIONS: readonly { Key: PeriodKey; Label: string }[] = [
    { Key: 'quarter', Label: 'This quarter' },
    { Key: 'lastquarter', Label: 'Last quarter' },
    { Key: 'year', Label: 'This year' },
    { Key: 'alltime', Label: 'All time' },
];

function labelFor(key: PeriodKey): string {
    return PERIOD_OPTIONS.find((o) => o.Key === key)?.Label ?? 'This quarter';
}

/**
 * What a set of company fiscal starts amounts to, as one answer or none.
 *
 * ── WHY DISAGREEMENT FALLS BACK RATHER THAN PICKING ─────────────────────────────────────────────
 *
 * The fiscal start is per-COMPANY and this dashboard is not company-scoped — `Sales: Dashboard
 * Summary` accepts a `CompanyID` the UI does not pass, so every figure spans every company. If two
 * companies start their year in different months, "this quarter" has no single correct answer, and
 * picking one silently would produce a window that is right for one company's numbers and wrong for
 * the other's with nothing on screen saying so.
 *
 * `deal-board.component.ts` already reaches for this rule with mixed currency — it refuses to total a
 * set holding more than one distinct value rather than presenting a total that means nothing. Same
 * shape, same reason.
 *
 * Rows are compared on (Month, Day), not on identity, so five companies that all start in January are
 * agreement and not a conflict.
 */
export function ResolveFiscalYearStart(
    rows: readonly FiscalYearStart[] | null,
): FiscalYearStartResolution {
    // null is "the entity is not in metadata" — accounting is not installed here. An EMPTY array is a
    // different fact: accounting is present and nobody has set a profile up. Both fall back, and the
    // selector says which, because the fix is different for each.
    if (rows === null) {
        return { Start: CALENDAR_YEAR_START, Basis: 'no-accounting' };
    }
    if (!rows.length) {
        return { Start: CALENDAR_YEAR_START, Basis: 'no-profiles' };
    }
    const distinct = new Set(rows.map((r) => `${r.Month}-${r.Day}`));
    if (distinct.size > 1) {
        return { Start: CALENDAR_YEAR_START, Basis: 'mixed' };
    }
    return { Start: { Month: rows[0].Month, Day: rows[0].Day }, Basis: 'profile' };
}

/** One line a reader can act on, naming the boundary in force and how it was arrived at. */
export function DescribeFiscalBasis(resolution: FiscalYearStartResolution): string {
    const start = MonthDayLabel(resolution.Start);
    switch (resolution.Basis) {
        case 'pending':
            return `reading fiscal year start…`;
        case 'profile':
            return `fiscal year starts ${start}`;
        case 'no-accounting':
            return `calendar year (BizApps Accounting not installed)`;
        case 'no-profiles':
            return `calendar year (no company profile sets a fiscal year)`;
        case 'mixed':
            return `calendar year (companies disagree on the fiscal year start)`;
    }
}

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "6 Apr" — the fiscal start as a reader states it. */
export function MonthDayLabel(start: FiscalYearStart): string {
    const month = MONTH_NAMES[Math.min(Math.max(start.Month, 1), 12) - 1];
    return `${start.Day} ${month}`;
}

/** Days in a UTC month. `day 0` of the NEXT month is the last day of this one. */
function daysInMonth(year: number, monthIndex: number): number {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The fiscal anchor date for a given year and month offset, CLAMPED to the month's length.
 *
 * `monthIndex` is allowed to exceed 11 or go negative — `Date.UTC` normalises it into the
 * neighbouring year, which is what makes "the quarter after the one starting in November" fall out
 * of the arithmetic instead of needing a special case.
 *
 * THE CLAMP IS THE POINT. A fiscal year starting on 31 January puts its second quarter on "31 April",
 * which does not exist; `Date.UTC(y, 3, 31)` would silently roll that to 1 May and every Q2 boundary
 * would be a day late, in a way no test of a 1st-of-the-month start could ever reveal. Clamping to
 * 30 April keeps each quarter inside the month its start names.
 */
function anchor(year: number, monthIndex: number, day: number): string {
    const normalised = new Date(Date.UTC(year, monthIndex, 1));
    const y = normalised.getUTCFullYear();
    const m = normalised.getUTCMonth();
    return UtcDatePart(new Date(Date.UTC(y, m, Math.min(day, daysInMonth(y, m)))));
}

/** The day before an ISO date. Windows are INCLUSIVE, so each one ends the day before the next starts. */
function dayBefore(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return UtcDatePart(new Date(Date.UTC(y, m - 1, d - 1)));
}

/**
 * The fiscal year containing `today`, labelled by the calendar year it STARTS in.
 *
 * Matches `bizapps-accounting`'s `deriveFiscalYear()`, deliberately: a July-start deployment calls
 * July 2026 → June 2027 "FY2026" in the ledger, and a dashboard that called the same span FY2027
 * would be reporting against a year nobody else uses.
 *
 * ── ONE BOUNDED CASE WHERE IT DOES NOT MATCH, NAMED RATHER THAN CLAIMED AWAY ────────────────────
 *
 * The rollover is compared against {@link anchor}, which CLAMPS the start day to the month's length,
 * while `deriveFiscalYear` compares the stored day raw. `CK_AccountingCompanyProfile_FiscalDay`
 * permits day 1-31 against any month, so a profile can store a start that does not exist in its own
 * month -- 29 February, or 31 April. For those, and ONLY those, the two disagree for the few days
 * between the clamped date and the day accounting rolls over: a 29 February start puts 28 February
 * 2027 in FY2027 here and in FY2026 in the ledger.
 *
 * It is stated rather than fixed because the clamp cannot be dropped from this one comparison alone.
 * {@link ResolvePeriod} derives every quarter boundary from the same anchors, so a rollover that used
 * the raw day while the boundaries used the clamped one would produce a window that does not contain
 * the date that selected it -- a strictly worse defect than a one-day label difference on an
 * impossible start date. Matching accounting exactly means rolling the anchor FORWARD to the first of
 * the next month everywhere instead of clamping back, which is a deliberate change to every quarter
 * boundary and belongs in its own change, not smuggled in here.
 */
export function FiscalYearOf(today: string, start: FiscalYearStart): number {
    const calendarYear = Number(today.slice(0, 4));
    // Lexical comparison IS chronological on YYYY-MM-DD, which is why no Date is constructed here.
    return today >= anchor(calendarYear, start.Month - 1, start.Day) ? calendarYear : calendarYear - 1;
}

/** Start of quarter `index` (0-3) of fiscal year `fiscalYear`. */
function quarterStart(fiscalYear: number, index: number, start: FiscalYearStart): string {
    return anchor(fiscalYear, start.Month - 1 + index * 3, start.Day);
}

/**
 * Which quarter of its fiscal year `today` falls in, 0-3.
 *
 * WALKS DOWN FROM Q4 AND RETURNS THE FIRST QUARTER THAT HAS ALREADY BEGUN, rather than computing a
 * month difference and dividing by three. The division is wrong whenever the fiscal start is not the
 * 1st: on a 6 April year, 3 July is still Q1 and a month-based calculation puts it in Q2. Comparing
 * against the same anchors the windows are built from means the quarter a date is IN and the quarter
 * it is REPORTED in cannot disagree.
 */
export function FiscalQuarterOf(today: string, fiscalYear: number, start: FiscalYearStart): number {
    for (let index = 3; index > 0; index--) {
        if (today >= quarterStart(fiscalYear, index, start)) {
            return index;
        }
    }
    return 0;
}

/**
 * The window a period key selects, as inclusive UTC date-only bounds.
 *
 * `alltime` returns nulls rather than a very wide pair of dates. A wide bound still excludes a row
 * with a NULL close date and still hides a badly-dated row outside it; no bound at all is the
 * question the tile is actually asking.
 */
export function ResolvePeriod(
    key: PeriodKey,
    start: FiscalYearStart = CALENDAR_YEAR_START,
    today: string = TodayUtc(),
): PeriodWindow {
    const Label = labelFor(key);
    if (key === 'alltime') {
        return { Key: key, Label, Start: null, End: null };
    }

    const fiscalYear = FiscalYearOf(today, start);
    if (key === 'year') {
        return {
            Key: key,
            Label,
            Start: quarterStart(fiscalYear, 0, start),
            // Index 4 is the NEXT fiscal year's Q1 — the arithmetic normalises past December, so the
            // year boundary needs no case of its own.
            End: dayBefore(quarterStart(fiscalYear, 4, start)),
        };
    }

    const current = FiscalQuarterOf(today, fiscalYear, start);
    // Q0's predecessor is the PREVIOUS fiscal year's Q4. Expressed as index -1 against the same year
    // so the rollback is the same arithmetic as every other step rather than a branch that can drift.
    const index = key === 'lastquarter' ? current - 1 : current;
    return {
        Key: key,
        Label,
        Start: quarterStart(fiscalYear, index, start),
        End: dayBefore(quarterStart(fiscalYear, index + 1, start)),
    };
}

/**
 * The window as MJ Query parameters, or `undefined` when there is nothing to pass.
 *
 * AN UNBOUNDED EDGE IS AN OMITTED PARAMETER, not an empty string. Every period predicate in these
 * queries is wrapped in `{% if PeriodStart %}`, and Nunjucks treats `''` as falsy — so an empty
 * string would happen to work today for exactly the wrong reason, and would start filtering on `''`
 * the moment a query compared the parameter instead of testing it. Omitting the key says what is
 * meant.
 *
 * Dates are passed as ISO date-only STRINGS on purpose; `win-rate.sql`'s own notes make the point
 * that a full timestamp would invite a query to compare a DATE column against an instant.
 */
export function PeriodParameters(window?: PeriodWindow): Record<string, string> | undefined {
    if (!window) {
        return undefined;
    }
    const parameters: Record<string, string> = {};
    if (window.Start !== null) {
        parameters['PeriodStart'] = window.Start;
    }
    if (window.End !== null) {
        parameters['PeriodEnd'] = window.End;
    }
    return Object.keys(parameters).length ? parameters : undefined;
}

/** True when an inclusive window contains `date`. A null bound is no bound, never a failed match. */
export function WithinWindow(date: string, window: PeriodWindow): boolean {
    if (window.Start !== null && date < window.Start) {
        return false;
    }
    return !(window.End !== null && date > window.End);
}

/** "1 Jul 2026 – 30 Sep 2026", or "all time" when unbounded. For a footnote, never for a filter. */
export function FormatWindow(window: PeriodWindow): string {
    if (window.Start === null && window.End === null) {
        return 'all time';
    }
    const pretty = (iso: string): string => {
        const [y, m, d] = iso.split('-').map(Number);
        return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
    };
    if (window.Start === null) {
        return `up to ${pretty(window.End!)}`;
    }
    if (window.End === null) {
        return `from ${pretty(window.Start)}`;
    }
    return `${pretty(window.Start)} – ${pretty(window.End)}`;
}
