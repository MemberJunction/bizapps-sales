import { describe, it, expect } from 'vitest';
import { FromDateInput, IsUnparseableDate, ToDateInput } from '../lib/workspace/deal-workspace.dates';

/**
 * bc-aidp-next-golive#185: a stored date the input cannot render showed as an EMPTY BOX, identical to
 * a field with no date at all. The rep sees "no date", the record holds a value, and a save replaces
 * it with nothing to say that happened.
 *
 * `FromDateInput` had guarded its direction since it was written; `ToDateInput` had not, and the
 * asymmetry is the whole defect. #34 added a guard for Term start alone (`IsEmptyDateLike`); these
 * pin it at the boundary instead, where all the date fields pass through.
 *
 * WHAT IS DELIBERATELY NOT CLAIMED HERE. Returning null does not make anything visible — an
 * `<input type="date">` has no way to show a value it cannot parse. `IsUnparseableDate` is what the
 * template asks so it can say so next to the field, and the two must never disagree about what
 * "unreadable" means, which the last block pins directly.
 */
describe('ToDateInput renders only what a date input can actually show', () => {
    it('formats a real Date as yyyy-MM-dd in UTC', () => {
        expect(ToDateInput(new Date('2026-09-30T00:00:00.000Z'))).toBe('2026-09-30');
    });

    it('uses UTC getters, so a stored date does not slip a day for anyone west of Greenwich', () => {
        // The regression this module was created for: 20 November rendering as the 19th. Late-evening
        // UTC is the hour where a local getter changes the answer.
        expect(ToDateInput(new Date('2026-11-20T23:30:00.000Z'))).toBe('2026-11-20');
    });

    it('returns null for an Invalid Date instead of NaN-NaN-NaN', () => {
        // The defect. The UTC getters return NaN, the template string renders "NaN-NaN-NaN", and the
        // element silently shows an empty box.
        expect(ToDateInput(new Date('nonsense'))).toBeNull();
    });

    it('returns null for a string that is not a date', () => {
        // Ten characters, so the old length test passed it through unchanged.
        expect(ToDateInput('not-a-date')).toBeNull();
        expect(ToDateInput('rubbish')).toBeNull();
    });

    it('returns null for a real date in a shape the element rejects', () => {
        // `2026-9-3` IS a date, and renders blank all the same because the element wants zero padding.
        // Blank-and-flagged beats blank-and-silent.
        expect(ToDateInput('2026-9-3')).toBeNull();
    });

    it('takes the date AS WRITTEN from an offset-bearing string, rather than re-basing it', () => {
        // 23:00 on the 30th at -05:00 is the 1st in UTC. Parsing and reformatting would render the 1st;
        // the stored value says the 30th, and that is what the field means.
        expect(ToDateInput('2026-09-30T23:00:00-05:00')).toBe('2026-09-30');
    });

    it('treats absent as absent', () => {
        expect(ToDateInput(null)).toBeNull();
        expect(ToDateInput(undefined)).toBeNull();
        expect(ToDateInput('')).toBeNull();
    });
});

describe('IsUnparseableDate separates a corrupt value from an empty one', () => {
    it('is false for every ordinary way a field can be empty', () => {
        expect(IsUnparseableDate(null)).toBe(false);
        expect(IsUnparseableDate(undefined)).toBe(false);
        expect(IsUnparseableDate('')).toBe(false);
        expect(IsUnparseableDate('   ')).toBe(false);
    });

    it('is true for a value that is present but unreadable', () => {
        expect(IsUnparseableDate(new Date('nonsense'))).toBe(true);
        expect(IsUnparseableDate('not-a-date')).toBe(true);
        expect(IsUnparseableDate('2026-9-3')).toBe(true);
    });

    it('is false for anything that renders', () => {
        expect(IsUnparseableDate(new Date('2026-09-30T00:00:00.000Z'))).toBe(false);
        expect(IsUnparseableDate('2026-09-30')).toBe(false);
        expect(IsUnparseableDate('2026-09-30T23:00:00-05:00')).toBe(false);
    });

    /**
     * The reason the predicate is written in terms of the formatter rather than repeating its rules.
     * `term-start.ts` records what happened when three predicates in one module disagreed about
     * "absent": one said no term start while another rendered the empty string. This asserts the
     * relationship itself, so a future change to either has to keep them in step.
     */
    it('agrees with ToDateInput on every value, by construction', () => {
        const values: Array<string | Date | null | undefined> = [
            null,
            undefined,
            '',
            '   ',
            'not-a-date',
            '2026-9-3',
            '2026-09-30',
            '2026-09-30T23:00:00-05:00',
            new Date('nonsense'),
            new Date('2026-09-30T00:00:00.000Z'),
        ];
        for (const v of values) {
            const rendersBlank = ToDateInput(v) === null;
            const isAbsent = v === null || v === undefined || (!(v instanceof Date) && String(v).trim() === '');
            // Corrupt is exactly "renders blank AND is not simply absent".
            expect(IsUnparseableDate(v), `disagreed on ${JSON.stringify(v)}`).toBe(rendersBlank && !isAbsent);
        }
    });
});

describe('FromDateInput still guards its own direction', () => {
    it('parses a cleared input as null rather than the epoch', () => {
        expect(FromDateInput('')).toBeNull();
        expect(FromDateInput(null)).toBeNull();
    });

    it('parses at midnight UTC', () => {
        expect(FromDateInput('2026-09-30')?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    });

    it('discards an unparseable value rather than writing Invalid Date', () => {
        expect(FromDateInput('not-a-date')).toBeNull();
    });

    it('round-trips through ToDateInput without moving the day', () => {
        const back = FromDateInput('2026-11-20');
        expect(ToDateInput(back)).toBe('2026-11-20');
    });
});
