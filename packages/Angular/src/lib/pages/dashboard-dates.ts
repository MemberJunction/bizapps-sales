/**
 * @fileoverview UTC date-only primitives shared by the dashboard's measure modules.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────────────────────────
 *
 * `dashboard-inspect.ts` needs `WithinWindow` from `dashboard-period.ts`, and `dashboard-period.ts`
 * needs `UtcDatePart` / today from `dashboard-inspect.ts`. Left as a direct pair that is an
 * ES-module CYCLE, and it survives today only because every symbol crossing it is a hoisted
 * `function` declaration called from inside another function body. Turn one of them into an arrow
 * `const`, or evaluate one at module scope, and the half-initialised module in the cycle throws a
 * TDZ `ReferenceError` at import time -- which takes the whole `sales-ng` bundle down, not just the
 * dashboard.
 *
 * So the two primitives both sides need live HERE, in a leaf that imports nothing FROM THIS PACKAGE.
 * The dependency now runs one way: dates <- period <- inspect. The `common-entities` import below is
 * outside the cycle, so it does not reopen it.
 *
 * `dashboard-inspect.ts` re-exports these, so `public-api.ts` needs no new entry and no existing
 * import path changes.
 *
 * ── THE TWO QUESTIONS THIS FILE ANSWERS ARE NOT THE SAME QUESTION (bc-aidp-next-golive#168) ─────
 *
 * {@link UtcDatePart} reads a STORED day. `ExpectedCloseDate` and `ActualCloseDate` are `DATE`
 * columns — calendar days with no time and no zone, handed back as UTC midnight — so its UTC parts
 * ARE the stored day and a zone must stay nowhere near it. That half was always right.
 *
 * {@link BusinessToday} answers what day it is, and that is the one question a zone decides. It used
 * to be `TodayUtc`, which rolled over at UTC midnight: from 19:00 Central the dashboard's period
 * windows, its "closing soon" buckets and its overdue counts all moved to tomorrow while the
 * business was still in today — and after #168 fixed the product picker they disagreed with it, on
 * the same screen.
 *
 * ── WHY THE RENAME RATHER THAN A QUIETER EDIT ──────────────────────────────────────────────────
 *
 * `TodayUtc` is gone rather than left as an alias returning the business day. A name that states a
 * zone it no longer uses is the exact failure CLAUDE.md rule 8 is about: a claim that was true when
 * it was written and stayed asserted after it stopped being true. Every caller had to be re-read,
 * which is the point of removing it.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

/** UTC date-only `YYYY-MM-DD`. Accepts an ISO string or a `Date` — v6 RunQuery can hand back either. */
export function UtcDatePart(value: string | Date): string {
    if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
}

/**
 * Today, in the instance's business time zone — `YYYY-MM-DD`.
 *
 * Every default `today` on this dashboard comes through here, so there is one answer per screen
 * rather than one per measure module.
 *
 * SYNCHRONOUS, and it relies on the engine already being loaded. `BusinessTimeZoneEngine` carries
 * `@RegisterForStartup()` (not deferred), so MJ's boot sequence awaits its `Config()` before the
 * Explorer paints. It also fails OPEN — an unconfigured engine, a missing configuration row or a
 * user who cannot read it all resolve to UTC with one logged warning — so the worst case is exactly
 * the behaviour this replaced, never a throw inside a template getter. `SalesSectionComponent`
 * awaits `Config(false)` at the top of its refresh anyway, because it can.
 */
export function BusinessToday(): string {
    return BusinessTimeZoneEngine.Instance.Today();
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The one way the Sales views write a calendar day: "Jul 1, 2026" (bizapps-sales#371).
 *
 * The dashboard, the board cards and the grids used three shapes. This one is chosen because the grids
 * cannot follow anything else: MJ's entity grid renders a `date` column with `Intl` `dateStyle`
 * presets in `en-US` only, and {@link GRID_DAY_FORMAT} is the preset that prints this same shape.
 *
 * Reads the stored day from its UTC parts (see {@link UtcDatePart}), so no zone moves it. Accepts the
 * `YYYY-MM-DD` string or the `Date` a query can hand back; anything else is an empty string.
 */
export function DayLabel(value: string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const [y, m, d] = UtcDatePart(value).split('-').map(Number);
    if (!y || !m || !d) {
        return '';
    }
    return `${MONTH_ABBREVIATIONS[m - 1]} ${d}, ${y}`;
}

/** "Jul 1" — a day without its year, in the same shape as {@link DayLabel}. */
export function MonthDayText(month: number, day: number): string {
    return `${MONTH_ABBREVIATIONS[Math.min(Math.max(month, 1), 12) - 1]} ${day}`;
}

/** The grid preset that renders {@link DayLabel}'s shape ("Jul 1, 2026"). Used for every grid date column. */
export const GRID_DAY_FORMAT = 'medium';
