import { describe, expect, it } from 'vitest';
import {
    DEAL_FIELDS_EDITABLE_WHILE_LOCKED,
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
    it('gives every editable field a label that reads like the form', () => {
        // The failure this prevents: a field added to the set shows up in the notice as its column
        // name, and a user reads "only Description and NextStepDate can be edited".
        //
        // Tested by SHAPE rather than against a copy of the map, which would only assert the map
        // equals itself: a label must not end in ID and must not run two words together.
        for (const field of [...DEAL_FIELDS_EDITABLE_WHILE_LOCKED, 'DealStatusTypeID']) {
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

    it('falls back to the field name rather than throwing', () => {
        // A field added to the set without a label should read slightly wrong, not take the notice
        // down and with it the only thing telling the user why the form refused them.
        expect(DealFieldLabel('SomeFieldNobodyLabelled')).toBe('SomeFieldNobodyLabelled');
    });
});

describe('what the notice lists', () => {
    /**
     * DEAL STATUS IS LISTED BUT IS NOT IN THE SERVER SET, which looks like a contradiction.
     *
     * `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` is what a bare SAVE may change, and golive#205 asks for a
     * bare status write to be refused on every path. The status moves through Sales.CloseDeal and
     * Sales.ReopenDeal instead, which the form's status control routes to. So it is editable to a
     * person and not writable by a raw save, and the notice is the one that describes people.
     */
    it('leads with Deal Status, because that is the way out of the lock', () => {
        expect(DealFieldsListedAsEditable()[0]).toBe('DealStatusTypeID');
    });

    it('does NOT put Deal Status in the set the server enforces', () => {
        expect(DEAL_FIELDS_EDITABLE_WHILE_LOCKED.has('DealStatusTypeID')).toBe(false);
    });

    it('lists everything the server does accept, so the notice cannot under-promise', () => {
        const listed = new Set(DealFieldsListedAsEditable());
        for (const field of DEAL_FIELDS_EDITABLE_WHILE_LOCKED) {
            expect(listed.has(field), `${field} is accepted but not listed`).toBe(true);
        }
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
    const listed = JoinLabels(DealFieldsListedAsEditable().map(DealFieldLabel));

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
