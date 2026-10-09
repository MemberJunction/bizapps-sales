import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * THE PIPELINE CONTROL MARKS ITSELF REQUIRED-EMPTY, AS A GENERIC FIELD WOULD.
 *
 * `Deal.PipelineID` is NOT NULL and base-forms STYLES `mj-forms-field--required-empty` on the input,
 * so a dedicated control that omits the modifier shows a required field as though it were optional
 * and the rep finds out at save time. Pipeline is a dedicated `<select>` rather than an
 * `<mj-form-field>` (bc-aidp-next-golive#291: a generic FK render listed every stage in the system),
 * so nothing adds the modifier for it — the template must.
 *
 * ── WHY THIS READS THE SOURCE RATHER THAN RENDERING THE PANEL ───────────────────────────────────
 *
 * The subject is a TEMPLATE BINDING, not a method, so the `Object.create` idiom the sibling suites
 * use (`vocabulary-list-order`, `deal-form-lock-survives-close`) cannot reach it: those patch a
 * collaborator and call a method, and there is no method here to call. Rendering the panel instead
 * would need an Angular host, which `MJSDealOverviewPanel` does not survive outside one.
 *
 * The existing coverage is `10-deal-crud` step 2, which asserts `isRequiredEmpty(page, 'Pipeline')`
 * on a new deal. That is a better test when it runs — it proves the rendered markup, not the source
 * that produces it. It is also the least reliable spec in the suite: three runs on this host died at
 * three different points, and it fails on `next` as well. This exists so the binding has one guard
 * that always runs.
 *
 * ── COMMENTS ARE STRIPPED FIRST, AND THAT IS THE WHOLE TRICK ────────────────────────────────────
 *
 * The template documents this binding in an HTML comment that contains the string `required-empty`.
 * So a `toContain('required-empty')` over the raw source passes with the binding DELETED — it would
 * be matching the prose that explains the binding. The same trap bit a dist-level check of
 * sales#183's `flex-shrink: 0`, where the rule's own comment quoted the declaration.
 *
 * The first test below is a GUARD on that stripping, in the spirit of the pinned-zone guard in
 * contracts' `contract-dates-panel` suite: if the raw source did NOT contain the string in a
 * comment, stripping would be pointless and these assertions would be weaker than they look.
 */

const SOURCE = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

/** The template with every HTML comment removed, so prose cannot satisfy an assertion. */
const WITHOUT_COMMENTS = SOURCE.replace(/<!--[\s\S]*?-->/g, '');

/**
 * The Pipeline field's own markup: from its `data-field` anchor to the next field's, so an assertion
 * cannot be satisfied by a binding that belongs to a different control.
 */
function pipelineFieldBlock(text: string): string {
    const start = text.indexOf('data-field="PipelineID"');
    expect(start, 'the Pipeline field must be anchored by data-field').toBeGreaterThan(-1);
    const after = text.indexOf('data-field=', start + 1);
    return text.slice(start, after === -1 ? undefined : after);
}

describe('the comment strip this suite depends on', () => {
    it('is load-bearing: the raw source carries "required-empty" in prose', () => {
        // Not a behaviour test. If this ever stops being true the stripping is a no-op, and every
        // assertion below would pass on the comment alone, proving nothing.
        const comments = SOURCE.match(/<!--[\s\S]*?-->/g)?.join('') ?? '';
        expect(comments).toContain('required-empty');
        expect(WITHOUT_COMMENTS).not.toContain('No backticks in here');
    });
});

describe('the Deal form marks Pipeline required when it is empty', () => {
    it('binds the required-empty modifier on the Pipeline field', () => {
        expect(pipelineFieldBlock(WITHOUT_COMMENTS)).toContain('[class.mj-forms-field--required-empty]');
    });

    /**
     * REQUIRED, EDITING, AND NO VALUE — the three the condition mirrors from MJ's own
     * `IsRequiredEmpty` getter. Dropping `!Record.PipelineID` is the interesting regression: the
     * field would then mark itself required FOREVER, including on a saved deal that has a pipeline,
     * which reads as a form that cannot be satisfied.
     */
    it('marks it only while editable and only while empty', () => {
        const block = pipelineFieldBlock(WITHOUT_COMMENTS);
        const binding = block.match(/\[class\.mj-forms-field--required-empty\]="([^"]+)"/);
        expect(binding, 'the modifier must be a binding, not a static class').not.toBeNull();
        const condition = binding![1];
        expect(condition, 'only while the form is editing').toContain('EditMode');
        expect(condition, 'only while this field is editable').toContain("FieldEditable('PipelineID')");
        expect(condition, 'only while the field has no value').toContain('!Record.PipelineID');
    });

    /**
     * The editing modifier is the one the harness reads for lock assertions (`FieldIsEditable`), and
     * it was the first half of this same defect: a dedicated control that omits it reports frozen
     * while perfectly editable, turning a lock assertion into one that cannot fail.
     */
    it('still binds the editing modifier beside it', () => {
        expect(pipelineFieldBlock(WITHOUT_COMMENTS)).toContain('[class.mj-forms-field--editing]');
    });
});
