import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { ShouldPlaceCursorInName } from '../lib/form-panels/deal-hero.panel';

/**
 * bc-aidp-next-golive#188, third part: clicking New Deal should open the form with the cursor already
 * in the name box, rather than leaving the user to work out where typing starts.
 *
 * WHY THE RULE IS TESTED AND THE FOCUS CALL IS NOT. This repo's vitest runs in Node with no DOM, so
 * nothing here can prove a caret actually moved. What CAN go wrong without anyone noticing is the
 * decision — taking focus on a saved record, taking it twice, taking it back from someone already
 * typing. That is what these pin. The component keeps only two DOM lines: find the input, focus it.
 */
const base = {
    HasRecord: true,
    IsSaved: false,
    EditMode: true,
    RecordKey: 'new',
    AlreadyPlacedFor: null as string | null,
    FocusAlreadyElsewhere: false,
};

describe('#188 — the cursor lands in Name on a new deal', () => {
    it('places it on an unsaved record being edited', () => {
        expect(ShouldPlaceCursorInName(base)).toBe(true);
    });

    /**
     * The one that matters most. Opening an EXISTING deal and having the caret jump into Name would
     * fight anyone navigating by keyboard, and would move it out from under a screen-reader user who
     * had already chosen where to be.
     */
    it('never takes focus on a record that is already saved', () => {
        expect(ShouldPlaceCursorInName({ ...base, IsSaved: true })).toBe(false);
    });

    it('does nothing in read mode, where there is no input to focus', () => {
        expect(ShouldPlaceCursorInName({ ...base, EditMode: false })).toBe(false);
    });

    it('does nothing before a record exists', () => {
        expect(ShouldPlaceCursorInName({ ...base, HasRecord: false })).toBe(false);
    });

    /** A re-render must not yank the cursor back to the top mid-sentence. */
    it('places it once per record, not on every pass', () => {
        expect(ShouldPlaceCursorInName({ ...base, AlreadyPlacedFor: 'new' })).toBe(false);
    });

    it('places it again for a DIFFERENT record', () => {
        expect(ShouldPlaceCursorInName({ ...base, AlreadyPlacedFor: 'deal-1', RecordKey: 'new' })).toBe(true);
    });

    /**
     * A fast typist can reach a field before the view settles. Taking focus back at that point is
     * worse than never having helped.
     */
    it('yields when the user has already reached another field', () => {
        expect(ShouldPlaceCursorInName({ ...base, FocusAlreadyElsewhere: true })).toBe(false);
    });

    /**
     * Every reason to decline is independent — none is load-bearing for another. Without this, one
     * clause could be deleted and the suite would still pass on the strength of its neighbours.
     */
    it('declines for each reason on its own', () => {
        const reasons = [
            { IsSaved: true },
            { EditMode: false },
            { HasRecord: false },
            { AlreadyPlacedFor: 'new' },
            { FocusAlreadyElsewhere: true },
        ];
        for (const reason of reasons) {
            expect(ShouldPlaceCursorInName({ ...base, ...reason })).toBe(false);
        }
        expect(ShouldPlaceCursorInName(base)).toBe(true);
    });
});
