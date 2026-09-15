import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { ReopenReasonOrDefault } from '../lib/form-panels/deal-form.panels';

/**
 * THE REOPEN REASON, which two panels used to answer differently.
 *
 * golive#205: "No reopen reason should be required in this path." Master plan 7.3 says the opposite
 * for the OPERATION — undoing a lock has to be explainable — and `Sales.ReopenDeal` refuses a blank
 * one, which `close-deal.CD10` pins.
 *
 * They are not about the same thing. 7.3 is about the audit trail; #205 is about whether a person is
 * made to type before the button works. So nobody is prompted and nothing lands unexplained.
 *
 * Pinned at the module-level rule rather than on a panel, because the bug this replaced was TWO
 * panels with two answers: the Close section demanded a reason and the Pipeline section did not, on
 * the same form, for the same operation.
 */
describe('what a reopen is recorded under', () => {
    it('is what the user wrote, when they wrote something', () => {
        expect(ReopenReasonOrDefault('Customer came back.', 'Open')).toBe('Customer came back.');
    });

    it('trims it, so a stray newline is not the reason', () => {
        expect(ReopenReasonOrDefault('  Customer came back.\n ', 'Open')).toBe('Customer came back.');
    });

    it('is NEVER blank, because the operation refuses blank and the form promised optional', () => {
        // This is the one that matters. If it could return '', a user who typed nothing would get a
        // round trip refused for a field the label called optional — worse than demanding it up front.
        for (const typed of ['', '   ', '\n\t ']) {
            expect(ReopenReasonOrDefault(typed, 'Open').trim().length, JSON.stringify(typed)).toBeGreaterThan(0);
        }
    });

    it('says how the deal was reopened and into what', () => {
        // A placeholder like "n/a" would satisfy the operation and tell a reader nothing. The default
        // states the one thing this code knows to be true without asking.
        const reason = ReopenReasonOrDefault('', 'Qualifying');
        expect(reason).toContain('Qualifying');
        expect(reason).toMatch(/status/i);
        expect(reason).toMatch(/no reason was given/i);
    });

    it('still says something useful when no target status is known', () => {
        // The Close panel's button reopens into whatever the first open status is, so it has no name
        // to quote. It must not end up with a dangling "to undefined".
        const reason = ReopenReasonOrDefault('', null);
        expect(reason).not.toMatch(/undefined|null/i);
        expect(reason.trim().length).toBeGreaterThan(0);
    });

    it('treats a whitespace-only target name as no name at all', () => {
        expect(ReopenReasonOrDefault('', '   ')).not.toMatch(/to\s+\./);
    });
});
