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
        // An INVALID Date's UTC getters every one return NaN, which formatted to `NaN-NaN-NaN` — a
        // string the element rejects outright and renders as EMPTY. That is the failure this guard
        // exists for: the field then reads as "no date" while the record demonstrably holds a value,
        // and a rep who saves the form writes that emptiness back over it. `FromDateInput` below has
        // guarded its own direction since it was written; this is the matching half.
        if (Number.isNaN(value.getTime())) {
            return null;
        }
        // The YEAR is padded for the same reason the month and day always were, and it matters more
        // than it looks. `getUTCFullYear()` returns a number: year 1 formats as `1`, giving `1-01-01`,
        // which the element rejects and renders blank. Unlike an unparseable string — which a `date`
        // column cannot hold — a year below 1000 IS storable (SQL `date` starts at 0001-01-01), so
        // this is the reachable half of the defect rather than the defensive one.
        const y = String(value.getUTCFullYear()).padStart(4, '0');
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    // The STRING path was unguarded in the same way and less obviously so. `s.slice(0, 10)` of an ISO
    // timestamp is the date part, but of anything else it is just the first ten characters — handed
    // to the element verbatim, rejected, rendered blank. A string shorter than ten was returned whole,
    // with the same result. So the slice is now CHECKED rather than trusted.
    return AsDateInputString(String(value));
}

/**
 * The `yyyy-MM-dd` an input will actually accept, or null when the text cannot produce one.
 *
 * The shape test alone is not enough: `2026-02-31` matches `\d{4}-\d{2}-\d{2}` and is not a day.
 * Date parsing alone is not enough either, because it ROLLS OVER — `2026-02-31` parses happily as
 * 3 March. So the parse has to be round-tripped against the text it came from, and only a value that
 * survives that is handed to the element.
 */
function AsDateInputString(text: string): string | null {
    const head = text.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) {
        return null;
    }
    const parsed = new Date(`${head}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString().slice(0, 10) === head ? head : null;
}

/**
 * Whether a stored value holds something that cannot be shown in an `<input type="date">`.
 *
 * WHY A SEPARATE PREDICATE RATHER THAN A SENTINEL. The element cannot display an invalid value at
 * all — there is no string that makes it show `not-a-date`. So the boundary cannot surface the
 * problem on its own; the most it can do is refuse to emit garbage. Telling an EMPTY field apart
 * from an UNREADABLE one is therefore the caller's job, and this is what the caller asks.
 *
 * An absent value is not unrenderable. Empty means empty, and must not be decorated as a fault.
 *
 * @param value - The stored value, in either shape a field can hold.
 * @returns True only when something is stored AND it cannot be rendered.
 */
export function IsUnrenderableDate(value: string | Date | null | undefined): boolean {
    if (!value) {
        return false;
    }
    return ToDateInput(value) === null;
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
