/**
 * golive #421: every field on the deal form explains itself.
 *
 * The help text is keyed by field name, and a field added to a panel without a line of help would
 * simply have no icon, which nobody would notice. So the form's own field lists are read from the
 * source and held against the help.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEAL_LINE_HELP, DealFieldHelp, DealFieldsWithHelp } from '../lib/form-panels/deal-field-help';
import { FieldHelpPosition } from '../lib/form-panels/field-help-position';

const PANELS = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
const EDITOR = readFileSync(new URL('../lib/form-panels/deal-line-editor.component.ts', import.meta.url), 'utf8');

/** Every field a deal panel draws: the specs in its field lists, and the controls it draws by hand. */
function formFields(): string[] {
    const specs = [...PANELS.matchAll(/\{ name: '(\w+)', type: '/g)].map((m) => m[1]);
    const drawn = [...PANELS.matchAll(/class="mjs-field" data-field="(\w+)"/g)].map((m) => m[1]);
    return [...new Set([...specs, ...drawn])];
}

describe('deal form field help', () => {
    it('finds the form\'s fields', () => {
        expect(formFields().length).toBeGreaterThan(35);
        expect(formFields()).toContain('PipelineStageID');
        expect(formFields()).toContain('ExpectedCloseDate');
    });

    it.each(formFields())('%s has help', (field) => {
        expect(DealFieldHelp(field), `help for ${field}`).toBeTruthy();
    });

    it('has no help for a field the form does not draw', () => {
        const drawn = formFields();
        expect(DealFieldsWithHelp().filter((field) => !drawn.includes(field))).toEqual([]);
    });

    it('answers null for a field it does not know', () => {
        expect(DealFieldHelp('NotAField')).toBeNull();
    });

    it('puts the help beside every field wrapper', () => {
        const wrappers = PANELS.match(/<div[^>]*class="mjs-field[ "][^>]*>/g) ?? [];
        expect(wrappers.length).toBeGreaterThan(5);
        expect(wrappers.filter((wrapper) => !wrapper.includes('[mjsFieldHelp]='))).toEqual([]);
    });

    it('is written for the person filling in the deal', () => {
        const all = [...DealFieldsWithHelp().map((f) => DealFieldHelp(f) ?? ''), ...Object.values(DEAL_LINE_HELP)];
        for (const text of all) {
            expect(text.endsWith('.'), text).toBe(true);
            expect(text.length, text).toBeLessThanOrEqual(320);
            // No column, entity or setting names.
            expect(text, text).not.toMatch(/[a-z][A-Z]|\bID\b|__mj/);
        }
    });
});

describe('deal line field help', () => {
    it('says what an empty term start does, what a renewal does, and what a date does', () => {
        expect(DEAL_LINE_HELP.TermStart).toMatch(/Leave empty to start on the day the deal closes/);
        expect(DEAL_LINE_HELP.TermStart).toMatch(/Leave empty for a renewal/);
        expect(DEAL_LINE_HELP.TermStart).toMatch(/Enter a date only when a different start was agreed/);
    });

    it('is bound for every key the line editor names', () => {
        const named = [...EDITOR.matchAll(/\[Text\]="Help\.(\w+)"/g)].map((m) => m[1]);
        expect(named.length).toBeGreaterThan(10);
        for (const key of named) {
            expect(Object.keys(DEAL_LINE_HELP), key).toContain(key);
        }
    });

    it('leaves no input wrapped in a label with a help button', () => {
        // A button inside the label that wraps an input becomes part of that input's name.
        expect(EDITOR).not.toMatch(/<label[^>]*class="mjs-le__field[ "]/);
    });
});

/**
 * The directive finds a field's label by the class the control that draws it gives it. Those controls
 * are MJ's and common's, so a rename there would remove every icon with nothing failing here.
 */
describe('the labels the help icon is placed beside', () => {
    const HELP = readFileSync(new URL('../lib/form-panels/field-help.component.ts', import.meta.url), 'utf8');
    const dist = (pkg: string, file: string): string =>
        readFileSync(new URL(`../../node_modules/${pkg}/dist/lib/${file}`, import.meta.url), 'utf8');

    it.each([
        ['mj-forms-field-label', '@memberjunction/ng-base-forms', 'field/form-field.component.js'],
        ['bizapps-party-field-label', '@mj-biz-apps/common-ng', 'components/party-field/party-field.component.js'],
    ])('%s is still the class its control draws', (cls, pkg, file) => {
        expect(HELP).toContain(`.${cls}`);
        expect(dist(pkg, file)).toMatch(new RegExp(`class=\\\\?"${cls}\\\\?"`));
    });
});

describe('where the help bubble goes', () => {
    const viewport = { width: 1000, height: 800 };
    const bubble = { width: 300, height: 100 };

    it('opens under the icon', () => {
        expect(FieldHelpPosition({ top: 100, bottom: 118, left: 200 }, bubble, viewport)).toEqual({ top: 124, left: 200 });
    });

    it('stays inside the right edge', () => {
        expect(FieldHelpPosition({ top: 100, bottom: 118, left: 900 }, bubble, viewport).left).toBe(692);
    });

    it('opens above when there is no room below', () => {
        expect(FieldHelpPosition({ top: 740, bottom: 758, left: 200 }, bubble, viewport).top).toBe(634);
    });

    it('stays below when there is no room above either', () => {
        expect(FieldHelpPosition({ top: 40, bottom: 58, left: 200 }, bubble, { width: 1000, height: 120 }).top).toBe(64);
    });
});
