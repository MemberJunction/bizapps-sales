import { describe, expect, it } from 'vitest';
import { CloseDealOperation } from '../CloseDealOperation.js';

/**
 * A LOST CLOSE TAKES ITS REASON FROM THE CALLER, NEVER FROM THE ROW (#400).
 *
 * `LossReasonID` and `LossNotes` are ordinary fields on an open deal. The check used to read
 * `input.LossReasonID ?? deal.LossReasonID`, so a reason typed while the deal was open, or left from an
 * earlier close, let a Lost close through for a caller who chose nothing. The notes had the same
 * fallback against a reason that requires them.
 *
 * `validate` is driven directly with a stubbed provider; only the loss-reason read is answered.
 */

const STORED_REASON = 'cccccccc-0000-4000-8000-000000000001';
const CHOSEN_REASON = 'cccccccc-0000-4000-8000-000000000002';

type Issue = { Field: string | null; Message: string };
type Validator = {
    validate(
        deal: unknown,
        input: Record<string, unknown>,
        target: { IsLost: boolean; IsWon: boolean },
        provider: unknown,
        user: unknown,
    ): Promise<{ Issues: Issue[] }>;
};

/** A deal that already carries a reason and notes from before this close. */
const carrying = { LossReasonID: STORED_REASON, LossNotes: 'typed while the deal was open' };

/** Every loss reason demands notes, so the notes fallback is visible too. */
const provider = {
    RunView: async () => ({ Success: true, Results: [{ RequiresNotes: true, Name: 'Price' }] }),
};

function validate(input: Record<string, unknown>): Promise<{ Issues: Issue[] }> {
    const op = new CloseDealOperation() as unknown as Validator;
    return op.validate(
        carrying,
        { DealID: 'd1', DealStatusTypeID: 's1', ...input },
        { IsLost: true, IsWon: false },
        provider,
        { ID: 'u1' },
    );
}

const fields = (issues: Issue[]) => issues.map((i) => i.Field);

describe('a lost close on a deal that already carries a loss reason', () => {
    it('is refused when the caller supplies no reason', async () => {
        const { Issues } = await validate({});
        expect(fields(Issues), 'the stored reason must not stand in for the caller').toContain('LossReasonID');
    });

    it('is refused when the reason needs notes and the caller supplies none', async () => {
        const { Issues } = await validate({ LossReasonID: CHOSEN_REASON });
        expect(fields(Issues), 'the stored notes must not stand in either').toContain('LossNotes');
    });

    it('passes when the caller supplies both', async () => {
        const { Issues } = await validate({ LossReasonID: CHOSEN_REASON, LossNotes: 'went with a competitor' });
        expect(Issues).toEqual([]);
    });
});
