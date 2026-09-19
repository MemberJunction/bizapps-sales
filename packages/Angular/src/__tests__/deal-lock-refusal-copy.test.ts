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

/**
 * THE LINE-EDIT REFUSAL, WHICH EXISTS IN FOUR PLACES AND MUST NOT DRIFT.
 *
 * `DealLockRefusal('update')` in `sales-core-entities-server` is the authority — it is what a save
 * actually produces. Three UI surfaces repeat it so a rep is told the same thing BEFORE the round
 * trip: the deal form's lines panel, the restricted line editor, and the deal workspace.
 *
 * They repeat it rather than import it, and that is not laziness: the server package pulls
 * `node:crypto` and cannot be bundled for a browser — MJExplorer's own manifest says so, which is why
 * the `*-core-entities-server` packages are deliberately absent from its dependencies.
 *
 * So the sentence is DERIVED FROM THE SERVER SOURCE HERE, as text, and every copy is checked against
 * it. Reading the file sidesteps the bundling problem entirely, and it means the server stays the one
 * that decides: change the wording there and this fails, naming the copies that no longer agree.
 * Asserting the copies against a literal typed into this test would only prove they match the test.
 */
describe('the line-edit refusal, across every surface that states it', () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

    /** Rebuilt from the server's own template + its 'update' action, not typed out here. */
    const expected = (() => {
        const server = read('../../../CoreEntitiesServer/src/DealLockOrderLineVeto.ts');
        const action = server.match(/:\s*'(changing what was sold)'/)?.[1];
        expect(action, 'the server no longer phrases the update action this way').toBeDefined();
        const template = server.match(/return `(This deal is closed\. Set the status back to Open before) \$\{action\}\.`/)?.[1];
        expect(template, 'the server no longer builds the refusal from this sentence').toBeDefined();
        return `${template} ${action}.`;
    })();

    it.each([
        ['the deal form lines panel', '../lib/form-panels/deal-form.panels.ts'],
        ['the restricted line editor', '../lib/form-panels/deal-line-editor.component.ts'],
        ['the deal workspace', '../lib/workspace/deal-workspace.component.ts'],
    ])('%s states it word for word', (_label, path) => {
        expect(read(path)).toContain(expected);
    });

    /**
     * And the sentence this block is about is genuinely the line one, not the field one. Without this
     * the suite would pass if both collapsed into a single message, which would be a real regression:
     * "changing this field" is the wrong thing to say to someone who just double-clicked a product row.
     */
    it('is a different sentence from the single-field refusal', () => {
        expect(expected).toContain('changing what was sold');
        expect(expected).not.toContain('changing this field');
    });
});
