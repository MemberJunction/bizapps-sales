import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * EVERY RELATED PANEL SAYS SOMETHING ON AN UNSAVED RECORD (the golive#216 shape, everywhere else).
 *
 * golive#216 was filed about ONE panel: a tester creating a deal expanded "What's being sold" and
 * found it *"empty, with no add button and no message"*. That panel is fixed separately. This covers
 * the other eight, which had exactly the same shape:
 *
 *     @if (Record.IsSaved) { <grid> }     // ...and nothing at all otherwise
 *
 * None of them carried a comment saying the blank was deliberate, so each is the same defect the
 * reporter hit — they just happened to expand the one panel of nine that got a ticket.
 *
 * WHY THIS ASSERTS ON THE TEMPLATE SOURCE. The branch is Angular control flow decided at render time
 * by one field. `deal-lines-panel-empty-states` and `deal-form-new-record` read the source the same
 * way, for the same reason: the alternative is standing up TestBed to prove which of two literals
 * appears, which tests Angular rather than the panel.
 *
 * THE STYLE IS ASSERTED TOO, and that is not padding. `.mjs-deal-empty` is defined per component
 * under emulated encapsulation, so a panel that gains the markup without the style renders the hint
 * as unstyled body text. FIELD_STYLES' own comment records that exact bug happening once already
 * with `dw-field__hint`. A panel could therefore pass every copy assertion here and still look
 * broken, which is why each one is checked for both.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DEAL = readFileSync(join(HERE, '..', 'lib', 'form-panels', 'deal-form.panels.ts'), 'utf8');
const PARTY = readFileSync(join(HERE, '..', 'lib', 'form-panels', 'party-deals.panels.ts'), 'utf8');

type Panel = { label: string; source: string; anchor: string; message: string };

/** The eight panels, and the sentence each must show a record that has not been saved. */
const PANELS: Panel[] = [
    {
        label: 'Internal team',
        source: DEAL,
        anchor: 'SectionKey="internal-team"',
        message: 'Save the deal first. Team members are recorded against it once it exists.',
    },
    {
        label: 'Buying team',
        source: DEAL,
        anchor: 'SectionKey="buying-team"',
        message: 'Save the deal first. Contacts are linked to it once it exists.',
    },
    {
        label: 'Activity',
        source: DEAL,
        anchor: 'SectionKey="activity"',
        message: 'Save the deal first. Activity is logged against it from then on.',
    },
    {
        label: 'Stage history',
        source: DEAL,
        anchor: 'SectionKey="stage-history"',
        message: 'Save the deal first. Stage changes are recorded from then on.',
    },
    {
        label: 'Payment schedule',
        source: DEAL,
        anchor: 'SectionKey="payment-schedule"',
        message: 'Save the deal first. Payments are scheduled against it once it exists.',
    },
    {
        label: 'Deals, on an organization',
        source: PARTY,
        anchor: "selector: 'mjs-organization-deals-panel'",
        message: 'Save the organization first. Deals are linked to it once it exists.',
    },
    {
        label: 'Deals, on a person',
        source: PARTY,
        anchor: "selector: 'mjs-person-deals-panel'",
        message: 'Save the person first. Deals are linked to them once they exist.',
    },
    {
        label: 'Deal team, on a person',
        source: PARTY,
        anchor: "selector: 'mjs-person-deal-team-panel'",
        message: 'Save the person first. Their role on a deal is recorded once they exist.',
    },
];

/** One panel's template only, so a branch in a neighbouring panel cannot satisfy these. */
function template(panel: Panel): string {
    const start = panel.source.indexOf(panel.anchor);
    expect(start, `${panel.label}: the panel must still be findable`).toBeGreaterThan(-1);
    const end = panel.source.indexOf('</mj-collapsible-panel>', start);
    expect(end, `${panel.label}: the panel must still close`).toBeGreaterThan(start);
    return panel.source.slice(start, end);
}

/** The component decorator that owns this panel, up to the class it decorates. */
function decorator(panel: Panel): string {
    const start = panel.source.indexOf(panel.anchor);
    const end = panel.source.indexOf('export class', start);
    expect(end, `${panel.label}: the decorated class must still follow`).toBeGreaterThan(start);
    return panel.source.slice(start, end);
}

describe('a record that has not been saved is told why a related panel is empty', () => {
    it.each(PANELS.map((p) => [p.label, p] as const))('%s says what to do', (_label, panel) => {
        const t = template(panel);

        // the grid stays gated on a saved record
        expect(t).toContain('@if (Record.IsSaved) {');

        // and the branch that runs otherwise carries the instruction
        const branch = t.indexOf('} @else {');
        expect(branch, 'an @else must close the chain').toBeGreaterThan(-1);
        expect(t.slice(branch)).toContain(panel.message);

        // ORDER matters: @else is positional, so the message must sit after the gate, not before it
        expect(t.indexOf('@if (Record.IsSaved) {')).toBeLessThan(branch);
    });

    it.each(PANELS.map((p) => [p.label, p] as const))(
        '%s styles its own hint, so it is not unstyled body text',
        (_label, panel) => {
            expect(decorator(panel)).toContain('EMPTY_STATE_STYLES');
        },
    );

    it('leaves no related panel gated on IsSaved without an empty state, in ANY panel file', () => {
        /**
         * The sweep that found these eight, kept as a tripwire.
         *
         * IT READS THE DIRECTORY, not the two files this change touches, and that is the whole point.
         * The next instance of this shape is most likely to arrive in a NEW file -- which is exactly
         * how `order-related.panel.ts` appeared while this PR was open. A tripwire pinned to two
         * hardcoded sources would have been watching the wrong place and still reported green.
         */
        const dir = join(HERE, '..', 'lib', 'form-panels');
        const sources = readdirSync(dir)
            .filter((f) => f.endsWith('.ts'))
            .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))
            .filter((s) => s.text.includes('mj-collapsible-panel'));

        expect(sources.length, 'the panel files must still be findable').toBeGreaterThan(1);

        for (const { file, text } of sources) {
            for (const gate of text.matchAll(/@if \(Record\.IsSaved\) \{/g)) {
                const after = text.slice(gate.index ?? 0);
                const close = after.indexOf('</mj-collapsible-panel>');
                expect(close, `${file}: every gate sits inside a panel`).toBeGreaterThan(-1);
                expect(
                    after.slice(0, close).includes('} @else {'),
                    `${file}: a related panel gated on IsSaved must say something when it is not`,
                ).toBe(true);
            }
        }
    });
});
