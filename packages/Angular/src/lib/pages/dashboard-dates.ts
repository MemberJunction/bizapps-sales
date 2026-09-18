/**
 * @fileoverview UTC date-only primitives shared by the dashboard's measure modules.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────────────────────────
 *
 * `dashboard-inspect.ts` needs `WithinWindow` from `dashboard-period.ts`, and `dashboard-period.ts`
 * needs `UtcDatePart` / `TodayUtc` from `dashboard-inspect.ts`. Left as a direct pair that is an
 * ES-module CYCLE, and it survives today only because every symbol crossing it is a hoisted
 * `function` declaration called from inside another function body. Turn one of them into an arrow
 * `const`, or evaluate one at module scope, and the half-initialised module in the cycle throws a
 * TDZ `ReferenceError` at import time -- which takes the whole `sales-ng` bundle down, not just the
 * dashboard.
 *
 * So the two primitives both sides need live HERE, in a leaf that imports nothing. The dependency
 * now runs one way: dates <- period <- inspect.
 *
 * `dashboard-inspect.ts` re-exports these, so `public-api.ts` needs no new entry and no existing
 * import path changes.
 *
 * @module @mj-biz-apps/sales-ng
 */

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
