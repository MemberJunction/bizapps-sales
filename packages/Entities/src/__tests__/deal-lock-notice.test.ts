import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunView } from '@memberjunction/core';
import {
    AlreadyWonRefusal,
    DealFieldsEditableWhileLocked,
    DealFieldLabel,
    DealFieldsListedAsEditable,
    IsDealFieldEditableWhileLocked,
    JoinLabels,
    ResolveDealLockState,
} from '../close-lock';

/**
 * THE LOCK NOTICE, which golive#207 row 16 rewrote and golive#206 keeps changing the content of.
 *
 * The tester's replacement is "This deal is closed (Won). Only Deal Status, Description and Next Step
 * can be edited. To change anything else, set the status back to Open." — written when the editable
 * set held two fields. #206 item 3 expands that set, so the sentence is DERIVED rather than
 * hardcoded: a hardcoded list would have started lying the moment the set grew, and it would read
 * perfectly while doing it.
 *
 * These pin the parts a change to the set can break.
 */
describe('the labels the notice uses', () => {
    it('gives every field a label that reads like the form, editable or frozen', () => {
        // The failure this prevents: a field shows up in a notice as its column name, and a user
        // reads "only Description and NextStepDate can be edited".
        //
        // Tested by SHAPE rather than against a copy of the map, which would only assert the map
        // equals itself: a label must not end in ID and must not run two words together.
        //
        // THE FROZEN FIELDS ARE THE HALF THAT MATTERS, and iterating only the editable set is how
        // this test passed while the thing it names was broken. The map holds exactly the editable
        // set plus DealStatusTypeID — the fields row 16 lists — so every member was guaranteed a
        // label and the loop could not fail. Row 18 names the FROZEN fields, none of which were in
        // the map, so they all printed as column names with this test green the whole time.
        //
        // The frozen names below are real Deal columns picked for the shapes that break a naive
        // split: a trailing ID, an acronym mid-name, and a plain multi-word column.
        const frozen = [
            'Amount',
            'ExpectedCloseDate',
            'AnnualIncreasePctOverride',
            'ForecastCategoryTypeID',
            'PipelineStageID',
            'OwnerEmployeeID',
        ];
        for (const field of [...DealFieldsEditableWhileLocked(true), 'DealStatusTypeID', ...frozen]) {
            const label = DealFieldLabel(field);
            expect(label, `${field} is labelled with an id column`).not.toMatch(/ID$/);
            expect(label, `${field} is labelled with a run-together name`).not.toMatch(/[a-z][A-Z]/);
        }
    });

    it('names the ID columns as the thing, not the id', () => {
        expect(DealFieldLabel('BillingContactID')).toBe('Billing Contact');
        expect(DealFieldLabel('LeadSourceTypeID')).toBe('Lead Source');
        expect(DealFieldLabel('DealStatusTypeID')).toBe('Status');
    });

    it('spaces the run-together column names', () => {
        expect(DealFieldLabel('NextStep')).toBe('Next Step');
        expect(DealFieldLabel('NextStepDate')).toBe('Next Step Date');
    });

    it('derives a readable label for a field nobody listed, rather than throwing or passing the column through', () => {
        // An unlisted field should read slightly wrong, not take the notice down and with it the only
        // thing telling the user why the form refused them — and "slightly wrong" means words with
        // spaces, not a column name. This is what makes the map an OVERRIDE rather than the only
        // source of a label, so row 18 cannot regress to column names by someone adding a column.
        expect(DealFieldLabel('SomeFieldNobodyLabelled')).toBe('Some Field Nobody Labelled');
        expect(DealFieldLabel('AnnualIncreasePctOverride')).toBe('Annual Increase Pct Override');
        expect(DealFieldLabel('PipelineStageID')).toBe('Pipeline Stage');
    });
});

describe('what the notice lists', () => {
    /**
     * DEAL STATUS IS LISTED BUT IS NOT IN THE SERVER SET, which looks like a contradiction.
     *
     * `DealFieldsEditableWhileLocked` is what a bare SAVE may change, and golive#205 asks for a
     * bare status write to be refused on every path. The status moves through Sales.CloseDeal and
     * Sales.ReopenDeal instead, which the form's status control routes to. So it is editable to a
     * person and not writable by a raw save, and the notice is the one that describes people.
     */
    it('leads with the status, because that is the way out of the lock', () => {
        expect(DealFieldsListedAsEditable(false)[0]).toBe('DealStatusTypeID');
    });

    it('does NOT put the status in the set the server enforces', () => {
        expect(DealFieldsEditableWhileLocked(false).has('DealStatusTypeID')).toBe(false);
        expect(DealFieldsEditableWhileLocked(true).has('DealStatusTypeID')).toBe(false);
    });

    it('lists everything the server does accept, so the notice cannot under-promise', () => {
        // Both outcomes, because the notice has to match whichever set the deal is under: Loss Notes
        // is listed on a Lost deal and must NOT be on a Won one.
        for (const isLost of [false, true]) {
            const listed = new Set(DealFieldsListedAsEditable(isLost));
            for (const field of DealFieldsEditableWhileLocked(isLost)) {
                expect(listed.has(field), `${field} is accepted but not listed (isLost=${isLost})`).toBe(true);
            }
        }
        expect(new Set(DealFieldsListedAsEditable(true)).has('LossNotes')).toBe(true);
        expect(new Set(DealFieldsListedAsEditable(false)).has('LossNotes')).toBe(false);
    });
});

describe('how the list reads in a sentence', () => {
    it('joins with a final "and", not a trailing comma', () => {
        expect(JoinLabels(['A', 'B', 'C'])).toBe('A, B and C');
    });

    it('handles two without a comma', () => {
        expect(JoinLabels(['A', 'B'])).toBe('A and B');
    });

    it('handles one without either', () => {
        expect(JoinLabels(['A'])).toBe('A');
    });

    it('handles none without producing a dangling word', () => {
        expect(JoinLabels([])).toBe('');
    });
});

describe('the sentence the user actually reads', () => {
    const listed = JoinLabels(DealFieldsListedAsEditable(false).map(DealFieldLabel));

    it('leads with Status, so the way out is the first thing named', () => {
        expect(listed.startsWith('Status')).toBe(true);
    });

    it('reads as prose, not as a column dump', () => {
        expect(listed).not.toMatch(/ID/);
        expect(listed).not.toMatch(/[a-z][A-Z]/);
        expect(listed).toMatch(/ and /);
    });

    afterEach(() => vi.restoreAllMocks());

    /**
     * Assembles the notice by calling `ResolveDealLockState` directly rather than regex-matching the
     * source file (#398). golive#207 row 16 is specific about the two things that changed: the deal is
     * "closed (Won)" rather than "closed and locked", and the way out is "set the status back to Open"
     * rather than an operation name.
     */
    it('uses the tester wording and names no API operation', async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ LocksDeal: true, Name: 'Won', IsLost: false, IsWon: true }],
        } as never);
        const lock = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000002');
        const notice = lock.Notice ?? '';

        expect(notice).toContain('This deal is closed (Won).');
        expect(notice).toContain('set the status back to Open');
        expect(notice, 'row 16 replaced the operation name with the form action').not.toMatch(
            /Sales\.ReopenDeal/,
        );
        expect(notice, 'and dropped "and locked", which said the same thing twice').not.toMatch(
            /and locked/,
        );
    });
});

/**
 * bc-aidp-next-golive#226 — the OUTCOME the Deal header reads, which is not the lock.
 *
 * `IsWon` rides out of `ResolveDealLockState` so the hero can offer Order and Contract chips on a won
 * deal and on no other. Two ways that goes wrong, both silent — the header simply draws nothing,
 * which is indistinguishable from a deal that has no order and no contract:
 *
 *   · the flag is never READ, because `IsWon` is missing from the RunView's `Fields` list;
 *   · the flag is read and then DROPPED by the unlocked early return, which is the exit an open deal
 *     and a won-but-non-locking status both take.
 *
 * Tested by calling `ResolveDealLockState` with a mocked `RunView` (#398).
 */
describe('#226 / #460 — the won and open flags survive the resolver', () => {
    afterEach(() => vi.restoreAllMocks());

    it('asks the status row for IsWon and IsOpen', async () => {
        const spy = vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ LocksDeal: true, Name: 'Won', IsLost: false, IsWon: true }],
        } as never);
        await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000002');

        expect(
            spy,
            'a flag that is never selected is always undefined, and undefined is not won',
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                Fields: expect.arrayContaining(['LocksDeal', 'Name', 'IsLost', 'IsWon', 'IsOpen']),
            }),
            undefined,
        );
    });

    it('carries them out of the unlocked exit rather than resetting them', async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ LocksDeal: false, Name: 'Signed', IsLost: false, IsWon: true, IsOpen: false }],
        } as never);
        const lock = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000003');

        expect(lock).toEqual({
            IsLocked: false,
            StatusName: null,
            IsLost: false,
            IsWon: true,
            IsOpen: false,
            IsStatusMissing: false,
            Notice: null,
        });
    });

    it('reports an open status as open, read from the flag', async () => {
        // IsOpen decides the header tone on an open deal without reading status names.
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ LocksDeal: false, Name: 'Negotiating', IsLost: false, IsWon: false, IsOpen: true }],
        } as never);
        const lock = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000007');

        expect(lock.IsOpen).toBe(true);
        expect(lock.IsLocked).toBe(false);
    });

    it('reads the flag and never a status name', async () => {
        // §3, enforced repo-wide by test:vocabulary-gate: a status named "Signed" with IsWon: true
        // reports IsWon: true, while a status named "Won" with IsWon: false reports IsWon: false.
        const spy = vi.spyOn(RunView.prototype, 'RunView');
        spy.mockResolvedValueOnce({
            Success: true,
            Results: [{ LocksDeal: true, Name: 'Signed', IsLost: false, IsWon: true }],
        } as never);
        expect((await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000004')).IsWon).toBe(true);

        spy.mockResolvedValueOnce({
            Success: true,
            Results: [{ LocksDeal: true, Name: 'Won', IsLost: false, IsWon: false }],
        } as never);
        expect((await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000005')).IsWon).toBe(false);
    });
});

describe('golive#306 — blank AccountID on a closed deal', () => {
    afterEach(() => vi.restoreAllMocks());

    it('allows AccountID only when the persisted account is blank', () => {
        expect(DealFieldsEditableWhileLocked(false, false).has('AccountID')).toBe(false);
        expect(DealFieldsEditableWhileLocked(false, true).has('AccountID')).toBe(true);
        expect(IsDealFieldEditableWhileLocked('AccountID', false, false)).toBe(false);
        expect(IsDealFieldEditableWhileLocked('AccountID', false, true)).toBe(true);
    });

    it('lists Account in the lock notice when the persisted account is blank', async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ LocksDeal: true, Name: 'Lost', IsLost: true, IsWon: false }],
        } as never);
        const withAccount = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000006', undefined, false);
        const blankAccount = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000006', undefined, true);

        expect(withAccount.Notice).not.toContain('Account');
        expect(blankAccount.Notice).toContain('Account');
    });
});

describe('golive#387 — AlreadyWonRefusal', () => {
    it('names the deal and contract when a contract was created', () => {
        expect(AlreadyWonRefusal('DEAL-0042', 'CON-0019')).toBe(
            'DEAL-0042 is already Won; contract CON-0019 was created.',
        );
    });

    it('omits the contract clause when no contract number is present', () => {
        expect(AlreadyWonRefusal('DEAL-0042', null)).toBe('DEAL-0042 is already Won.');
        expect(AlreadyWonRefusal(null, 'CON-0019')).toBe('This deal is already Won; contract CON-0019 was created.');
    });
});
