import { describe, expect, it } from 'vitest';
import { CloseDealOperation, ReopenDealOperation } from '../CloseDealOperation.js';

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

    it('refuses a malformed LossReasonID without calling RunView', async () => {
        let called = false;
        const op = new CloseDealOperation() as unknown as Validator;
        const { Issues } = await op.validate(
            carrying,
            { DealID: 'd1', DealStatusTypeID: 's1', LossReasonID: "not-a-guid' OR 1=1" },
            { IsLost: true, IsWon: false },
            { RunView: async () => { called = true; return { Success: true, Results: [] }; } },
            { ID: 'u1' },
        );
        expect(called).toBe(false);
        expect(Issues).toEqual([expect.objectContaining({ Field: 'LossReasonID', Message: 'Loss reason is not a valid ID.' })]);
    });

    it('refuses when the loss-reason read fails instead of treating RequiresNotes as false', async () => {
        const op = new CloseDealOperation() as unknown as Validator;
        const { Issues } = await op.validate(
            carrying,
            { DealID: 'd1', DealStatusTypeID: 's1', LossReasonID: CHOSEN_REASON },
            { IsLost: true, IsWon: false },
            { RunView: async () => ({ Success: false, ErrorMessage: 'db down', Results: [] }) },
            { ID: 'u1' },
        );
        expect(Issues).toEqual([expect.objectContaining({ Field: 'LossReasonID', Message: 'Loss reason could not be read.' })]);
    });

    it('refuses when the loss-reason ID does not match any row', async () => {
        const op = new CloseDealOperation() as unknown as Validator;
        const { Issues } = await op.validate(
            carrying,
            { DealID: 'd1', DealStatusTypeID: 's1', LossReasonID: CHOSEN_REASON },
            { IsLost: true, IsWon: false },
            { RunView: async () => ({ Success: true, Results: [] }) },
            { ID: 'u1' },
        );
        expect(Issues).toEqual([
            expect.objectContaining({ Field: 'LossReasonID', Message: `Loss reason ${CHOSEN_REASON} was not found.` }),
        ]);
    });

    it('refuses a malformed ClosingStageID without calling RunView', async () => {
        const { Issues } = await validate({
            LossReasonID: CHOSEN_REASON,
            LossNotes: 'notes',
            ClosingStageID: 'bad-stage-id',
        });
        expect(Issues).toEqual([
            expect.objectContaining({ Field: 'ClosingStageID', Message: 'Closing stage is not a valid ID.' }),
        ]);
    });
});

describe('dealTypeRequiresRenewalSource and ReopenDeal ID checks', () => {
    type RenewalChecker = {
        dealTypeRequiresRenewalSource(
            dealTypeID: string | null,
            provider: unknown,
            user: unknown,
        ): Promise<boolean>;
    };

    it('refuses a malformed or unreadable DealTypeID instead of returning false', async () => {
        const op = new CloseDealOperation() as unknown as RenewalChecker;
        let called = false;
        await expect(
            op.dealTypeRequiresRenewalSource('bad-type', { RunView: async () => { called = true; return { Success: true, Results: [] }; } }, { ID: 'u1' }),
        ).rejects.toThrow('Deal type is not a valid ID.');
        expect(called).toBe(false);

        await expect(
            op.dealTypeRequiresRenewalSource(
                CHOSEN_REASON,
                { RunView: async () => ({ Success: false, Results: [] }) },
                { ID: 'u1' },
            ),
        ).rejects.toThrow('Deal type could not be read.');
    });

    it('refuses a malformed StageID or DealStatusTypeID in ReopenDealOperation before touching the database', async () => {
        const op = new ReopenDealOperation() as unknown as {
            InternalExecute(input: unknown, provider: unknown, user: unknown): Promise<{ Success: boolean; Issues: Issue[] }>;
        };
        const stageRes = await op.InternalExecute(
            { DealID: CHOSEN_REASON, Reason: 'valid reason', StageID: 'bad-stage' },
            {},
            { ID: 'u1' },
        );
        expect(stageRes.Success).toBe(false);
        expect(stageRes.Issues).toEqual([expect.objectContaining({ Field: 'StageID', Message: 'Stage is not a valid ID.' })]);

        const statusRes = await op.InternalExecute(
            { DealID: CHOSEN_REASON, Reason: 'valid reason', DealStatusTypeID: 'bad-status' },
            {},
            { ID: 'u1' },
        );
        expect(statusRes.Success).toBe(false);
        expect(statusRes.Issues).toEqual([
            expect.objectContaining({ Field: 'DealStatusTypeID', Message: 'Deal status is not a valid ID.' }),
        ]);
    });
});
