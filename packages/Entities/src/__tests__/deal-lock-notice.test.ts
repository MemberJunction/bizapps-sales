import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    DealFieldsEditableWhileLocked,
    DealFieldLabel,
    DealFieldsListedAsEditable,
    JoinLabels,
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
        expect(DealFieldLabel('DealStatusTypeID')).toBe('Deal Status');
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
        expect(DealFieldLabel('ForecastCategoryTypeID')).toBe('Forecast Category Type');
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
    it('leads with Deal Status, because that is the way out of the lock', () => {
        expect(DealFieldsListedAsEditable(false)[0]).toBe('DealStatusTypeID');
    });

    it('does NOT put Deal Status in the set the server enforces', () => {
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

    it('leads with Deal Status, so the way out is the first thing named', () => {
        expect(listed.startsWith('Deal Status')).toBe(true);
    });

    it('reads as prose, not as a column dump', () => {
        expect(listed).not.toMatch(/ID/);
        expect(listed).not.toMatch(/[a-z][A-Z]/);
        expect(listed).toMatch(/ and /);
    });

    /**
     * The source of the notice itself, because assembling it needs a database read and standing one
     * up would test the harness rather than the copy. golive#207 row 16 is specific about the two
     * things that changed: the deal is "closed (Won)" rather than "closed and locked", and the way out
     * is "set the status back to Open" rather than an operation name.
     */
    it('uses the tester wording and names no API operation', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(new URL('../close-lock.ts', import.meta.url), 'utf8');
        // The LAST `Notice:` is the assignment; the earlier ones are the interface field and the
        // unlocked-state literal. Slicing from the first would test the type declaration.
        const notice = source.slice(source.lastIndexOf('Notice:'), source.lastIndexOf('Notice:') + 400);

        expect(notice).toMatch(/This deal is closed \(\$\{row\.Name\}\)\./);
        expect(notice).toMatch(/set the status back to Open/);
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
 * Source-read for the same reason the notice test above is: assembling the state needs a database,
 * and standing one up would test the harness. Both claims are structural, so the source is where
 * they are visible.
 */
describe('#226 — the won flag survives the resolver', () => {
    const source = readFileSync(new URL('../close-lock.ts', import.meta.url), 'utf8');

    it('asks the status row for IsWon', () => {
        const fields = source.slice(source.indexOf('Fields: ['), source.indexOf('Fields: [') + 120);
        expect(fields, 'a flag that is never selected is always undefined, and undefined is not won')
            .toMatch(/'IsWon'/);
    });

    it('carries it out of the unlocked exit rather than resetting it', () => {
        expect(source).toMatch(/if \(!row\?\.LocksDeal\) \{\s*return \{ \.\.\.open, IsWon: isWon \};/);
    });

    it('reads the flag and never a status name', () => {
        // §3, enforced repo-wide by test:vocabulary-gate. Named here too because THIS is the file a
        // shortcut would be taken in: `row.Name === 'Closed Won'` is one character shorter than the
        // flag and works perfectly until a deployment calls its winning status "Signed".
        expect(source).toMatch(/const isWon = row\?\.IsWon === true;/);
    });
});
