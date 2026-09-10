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
 * NEVER RETURNS SOMETHING THE INPUT CANNOT RENDER. This is the guard `FromDateInput` has always had
 * and this direction did not, and the asymmetry was the bug: an `Invalid Date` fell through the UTC
 * getters as `NaN-NaN-NaN`, and a string that was not a date fell through the slice unchanged. The
 * element rejects both and shows an EMPTY BOX — so a record holding a corrupt value looked exactly
 * like a record holding no value, and a save could overwrite it with nothing to say it had happened.
 *
 * Returning null does not make that visible on its own; nothing can, because the element has no way
 * to display a value it cannot parse. {@link IsUnparseableDate} is the other half, and the caller is
 * expected to show something next to the field when it is true.
 *
 * THE STRING BRANCH STILL SLICES rather than parsing and reformatting, deliberately. A stored
 * `2026-09-30T23:00:00-05:00` is the 30th as written; parsing it and formatting with UTC getters
 * would render the 1st. The slice takes the date as written, so the test is only whether the value
 * BEGINS with a date — anything else is not a date this boundary can honestly narrow.
 *
 * @param value - A `Date`, an ISO string, or null.
 * @returns A `yyyy-MM-dd` string, or null for absent AND for unparseable.
 */
export function ToDateInput(value: string | Date | null | undefined): string | null {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return null;
        }
        const y = value.getUTCFullYear();
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    // `2026-9-3` is a real date and is REJECTED here on purpose: the element accepts zero-padded
    // `yyyy-MM-dd` only, so passing it through unchanged renders blank exactly like a corrupt value.
    // Better to be told the stored value is not in the shape this boundary reads.
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/**
 * Is this value present, but not something a date input can show?
 *
 * DEFINED IN TERMS OF {@link ToDateInput} rather than repeating its rules. `term-start.ts` records
 * what happens otherwise: three predicates in one module disagreed about what "absent" meant, so one
 * function said "no term start" while another rendered the empty string. A predicate that asks the
 * formatter cannot drift from it.
 *
 * Absent is not corrupt. Null, undefined and a blank string are all ordinary "no date" and return
 * false — the field is legitimately empty and there is nothing to warn about.
 *
 * @param value - The stored value, in whichever shape the row was fetched as.
 * @returns True only when the record holds something that will render as an empty box.
 */
export function IsUnparseableDate(value: string | Date | null | undefined): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (!(value instanceof Date) && String(value).trim().length === 0) {
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
