import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * golive#207 row 17 — the message a person gets when they type into a frozen field and save.
 *
 * The old text named `Sales.ReopenDeal`, an API operation, to someone who had just typed into a form
 * field. The tester's replacement is "This deal is closed. Set the status back to Open before
 * changing this field." — an action they can actually take, which since golive#205 genuinely works
 * from this form: the status control routes to the reopen.
 *
 * ASSERTED AGAINST THE SOURCE because the message is produced inside the extended form component's
 * validation override, which needs a `BaseFormComponent`, a record and MJ metadata to reach. Standing
 * that up would test the harness rather than the sentence. A mutation reverting this copy survived
 * every other test in the repo, which is why this file exists.
 */
describe('the form save refusal on a locked deal', () => {
    const source = readFileSync(new URL('../lib/custom/deal-form.component.ts', import.meta.url), 'utf8');

    it('tells the user what to do, in the tester words', () => {
        expect(source).toContain('This deal is closed. Set the status back to Open before changing this field.');
    });

    it('names no API operation', () => {
        // The one thing row 17 is actually about: a person reading this cannot call an operation.
        expect(source, 'row 17 replaced the operation name with the form action').not.toMatch(
            /Message:[^;]*Sales\.ReopenDeal/s,
        );
    });

    it('does not say "Frozen" and then say it again', () => {
        // The old text was "Frozen: this deal is closed and locked." — the label, the word and the
        // synonym, three times over before reaching anything actionable.
        expect(source).not.toMatch(/Message:[^;]*Frozen:/s);
    });
});
