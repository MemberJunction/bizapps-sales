/**
 * @fileoverview The ONE boundary between an `<input type="date">` and an entity's date field.
 *
 * WHY THIS IS A MODULE OF ITS OWN. A previous v6 upgrade broke every date in this workspace, and the
 * reason it was cheap to fix is that all seven date fields already funnelled through a single normalizing
 * helper — one fix, seven fields. The lesson from that (`docs/DECISIONS.md`, the v6 date sweep) is that
 * the single-boundary shape is what made it cheap, and that spreading date mapping across components
 * would make the next shape change cost one fix per component. So the boundary is kept, and given a
 * file, now that the workspace binds to real entity objects and needs the conversion in BOTH directions.
 *
 * THE SHAPE PROBLEM, precisely. An `<input type="date">` reads and writes `yyyy-MM-dd` strings and
 * nothing else — hand it a `Date` and it renders **blank**, with no error. An entity's date field holds a
 * `Date`. And a value read through `RunView` can arrive as either, depending on how the row was fetched.
 * So both directions have to be explicit, and both have to accept both shapes.
 *
 * UTC THROUGHOUT, never local getters. Everything stored is UTC; a local-time getter shifts the day for
 * anyone west of Greenwich, which is how a stored 20 November renders as the 19th. That is not a
 * hypothetical — it shipped, and it was found by eye rather than by any test.
 *
 * @module @mj-biz-apps/sales-ng
 */

/**
 * The `yyyy-MM-dd` an `<input type="date">` binds to, from either shape a field can hold.
 *
 * @param value - A `Date`, an ISO string, or null.
 * @returns The date part, or null — which an input renders as empty, correctly this time.
 */
export function ToDateInput(value: string | Date | null | undefined): string | null {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        const y = value.getUTCFullYear();
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * A `Date` for an entity field, from what an `<input type="date">` produced.
 *
 * MIDNIGHT **UTC**, not local midnight. `new Date('2026-09-30')` already parses as UTC midnight, but
 * `new Date(2026, 8, 30)` does not, and the two differ by a day for most of the world — so the explicit
 * suffix says which one is meant rather than relying on a parsing rule nobody remembers.
 *
 * @param value - What the input element reported. An empty string means the user cleared the field.
 * @returns A UTC-midnight `Date`, or null to clear the field.
 */
export function FromDateInput(value: string | null | undefined): Date | null {
    if (!value) {
        return null; // '' from a cleared input means null, not the epoch
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    // An unparseable value is discarded rather than written as `Invalid Date`, which would reach the
    // database as a null anyway but validate and log confusingly on the way there.
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
