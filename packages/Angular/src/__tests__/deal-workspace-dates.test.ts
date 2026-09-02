import { describe, it, expect } from 'vitest';

import { FromDateInput, IsUnrenderableDate, ToDateInput } from '../lib/workspace/deal-workspace.dates';

/**
 * bc-aidp-next-golive#185 — a deal date field renders EMPTY when the stored value is invalid.
 *
 * WHAT WAS WRONG, AND WHY IT WAS INVISIBLE. `ToDateInput` had no guard in either of its two branches.
 * An invalid `Date` formatted to `NaN-NaN-NaN`; a malformed string was sliced to its first ten
 * characters and handed over whole. An `<input type="date">` REJECTS both and renders blank, silently.
 * The field then reads as "no date" while the record holds a value — and a rep who saves the form
 * writes that emptiness back over it. Nothing errors, because nothing failed.
 *
 * `FromDateInput` has guarded its own direction since it was written. These tests hold the two halves
 * to the same standard, which is the whole point of the file being one boundary rather than seven.
 *
 * The invalid-input cases FAIL against the previous implementation — that is what makes them worth
 * having. The valid-input cases exist so a future guard cannot be made to pass by rejecting everything.
 */
describe('ToDateInput — the entity-to-element direction', () => {
    describe('renders what it should', () => {
        it('formats a Date as yyyy-MM-dd', () => {
            expect(ToDateInput(new Date('2026-09-30T00:00:00.000Z'))).toBe('2026-09-30');
        });

        it('reads the date part off an ISO timestamp', () => {
            expect(ToDateInput('2026-09-30T14:22:05.000Z')).toBe('2026-09-30');
        });

        it('passes a bare yyyy-MM-dd through unchanged', () => {
            expect(ToDateInput('2026-09-30')).toBe('2026-09-30');
        });

        it('uses UTC, not local getters — a stored 20 November is not the 19th', () => {
            // This shipped once and was found by eye rather than by any test. west-of-Greenwich only.
            expect(ToDateInput(new Date('2026-11-20T00:00:00.000Z'))).toBe('2026-11-20');
        });

        it('pads a year below 1000, which an input needs as four digits', () => {
            // SQL `date` starts at 0001-01-01, so this is storable and reaches the component as a real
            // Date. Unpadded it formatted as `1-01-01` and the element rendered it blank.
            expect(ToDateInput(new Date('0001-01-01T00:00:00.000Z'))).toBe('0001-01-01');
            expect(ToDateInput(new Date('0999-12-31T00:00:00.000Z'))).toBe('0999-12-31');
        });

        it('keeps a genuinely empty value empty', () => {
            expect(ToDateInput(null)).toBeNull();
            expect(ToDateInput(undefined)).toBeNull();
            expect(ToDateInput('')).toBeNull();
        });
    });

    describe('refuses what an <input type="date"> cannot show', () => {
        it('returns null for an Invalid Date rather than NaN-NaN-NaN', () => {
            const invalid = new Date('not a date');
            expect(Number.isNaN(invalid.getTime())).toBe(true); // precondition, not the assertion
            expect(ToDateInput(invalid)).toBeNull();
        });

        it('returns null for text that is not a date at all', () => {
            expect(ToDateInput('not-a-date')).toBeNull();
        });

        it('returns null for a too-short value rather than returning it whole', () => {
            // The old code returned anything under ten characters verbatim.
            expect(ToDateInput('2026-9-3')).toBeNull();
        });

        it('returns null for a date-SHAPED value that is not a day', () => {
            // Shape alone is not enough: this matches the pattern and rolls over to 3 March when parsed.
            expect(ToDateInput('2026-02-31')).toBeNull();
        });

        it('still accepts the last real day of a short month', () => {
            expect(ToDateInput('2026-02-28')).toBe('2026-02-28');
        });
    });
});

describe('IsUnrenderableDate — telling an empty field from an unreadable one', () => {
    it('is false for genuinely empty values, which must not be decorated as faults', () => {
        expect(IsUnrenderableDate(null)).toBe(false);
        expect(IsUnrenderableDate(undefined)).toBe(false);
        expect(IsUnrenderableDate('')).toBe(false);
    });

    it('is false for anything that renders', () => {
        expect(IsUnrenderableDate(new Date('2026-09-30T00:00:00.000Z'))).toBe(false);
        expect(IsUnrenderableDate('2026-09-30T14:22:05.000Z')).toBe(false);
    });

    it('is true for a stored value that cannot be shown', () => {
        expect(IsUnrenderableDate(new Date('not a date'))).toBe(true);
        expect(IsUnrenderableDate('not-a-date')).toBe(true);
        expect(IsUnrenderableDate('2026-02-31')).toBe(true);
    });
});

describe('the two directions agree', () => {
    it('round-trips a real date unchanged', () => {
        const iso = '2026-09-30';
        expect(ToDateInput(FromDateInput(iso))).toBe(iso);
    });

    it('both refuse the same unparseable text, rather than one accepting it', () => {
        // The asymmetry this issue is about: FromDateInput always refused, ToDateInput did not.
        expect(FromDateInput('not-a-date')).toBeNull();
        expect(ToDateInput('not-a-date')).toBeNull();
    });
});
