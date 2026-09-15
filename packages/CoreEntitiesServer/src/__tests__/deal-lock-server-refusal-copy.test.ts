import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * golive#207 row 18 — the message a SAVE gets back when a locked deal refuses a frozen field.
 *
 * The sibling of row 17. Row 17 is what the form shows a person; this is what the server returns to
 * whoever asked, which includes the form, an import, an agent and a raw API call. The tester's
 * replacement is "This deal is closed. {fields} cannot be changed until the status is set back to
 * Open." — the same instruction as row 17, with the offending fields named.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────────────────
 *
 * Row 18 shipped with NO test. It was written on the #205 branch, moved here so that one PR owns one
 * issue, and in all that time nothing pinned it: reverting the sentence broke nothing. Rows 16 and 17
 * each have one; this is the third.
 *
 * ── WHY AGAINST THE SOURCE ──────────────────────────────────────────────────────────────────────
 *
 * The string is built inside `DealEntityServer`'s lock check, which needs a loaded entity, MJ
 * metadata and a database to reach. Standing that up would test the harness rather than the sentence.
 * The behaviour it guards — that the refusal fires at all, and on which fields — is pinned by the
 * close-deal integration checks against a real deal; this file pins only the words.
 */
describe('the server save refusal on a locked deal', () => {
    const source = readFileSync(new URL('../DealEntityServer.ts', import.meta.url), 'utf8');

    /** The code only: a comment quoting the old sentence must not satisfy a test about the new one. */
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    it('is the tester sentence, with the fields interpolated', () => {
        expect(codeOnly).toContain(
            '`This deal is closed. ${all.join(\', \')} cannot be changed until the status is set back to Open.`',
        );
    });

    it('interpolates the field list rather than naming fields in prose', () => {
        /**
         * The tester asked for this in the same breath as the copy: the message "should match whatever
         * #206 settles on". #206 item 3 grows the editable set from two fields to seven, so a sentence
         * that spelled them out would have started lying the day that merged.
         */
        expect(codeOnly).toMatch(/\$\{all\.join\(/);
    });

    it('names no API operation', () => {
        // The whole of row 18: the old text sent the reader to `Sales.ReopenDeal`. Since golive#205,
        // setting the status back IS the reopen, on every path this refusal reaches.
        const refusal = codeOnly.slice(codeOnly.indexOf('This deal is closed. ${all'));
        const sentence = refusal.slice(0, refusal.indexOf('`;') + 2);
        expect(sentence, `row 18 must not name an operation: ${sentence}`).not.toContain('Sales.ReopenDeal');
    });

    it('has dropped the old developer-voice wording entirely', () => {
        expect(codeOnly).not.toContain('this deal is closed and locked;');
    });
});
