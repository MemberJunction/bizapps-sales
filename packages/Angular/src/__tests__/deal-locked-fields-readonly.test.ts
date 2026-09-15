import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import {
    MJSDealPipelinePanel,
    MJSDealPartyPanel,
    MJSDealCommercialPanel,
    MJSDealMotionPanel,
    MJSDealClosePanel,
} from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#206 item 3, the form half.
 *
 * "Every other field ... should render read-only, instead of accepting typing and refusing on save."
 * A tester clicked Edit on a closed deal, every field opened for typing, and they only learned a
 * field was frozen when the save came back refused — a correct refusal delivered after the work.
 *
 * The rule is `IsDealFieldEditableWhileLocked`, the SAME constant the entity server enforces. These
 * pin that the panels ask it, that they ask it the right way round, and that the binding is actually
 * wired — a correct helper nothing calls would look exactly like this feature working.
 */
const PANELS = [
    ['Pipeline', MJSDealPipelinePanel],
    ['Account & people', MJSDealPartyPanel],
    ['Commercial', MJSDealCommercialPanel],
    ['Motion', MJSDealMotionPanel],
    ['Close', MJSDealClosePanel],
] as const;

function panel(Ctor: new () => { FieldEditable(n: string): boolean }, locked: boolean) {
    const p = new Ctor();
    Object.defineProperty(p, 'FormComponent', {
        value: { IsLocked: locked } as unknown,
        configurable: true,
        writable: true,
    });
    return p;
}

describe('an OPEN deal edits exactly as before', () => {
    for (const [name, Ctor] of PANELS) {
        it(`${name}: every field stays editable`, () => {
            const p = panel(Ctor as never, false);
            // Amount is the field the tester actually tried to change, and the one the server refuses
            // on a closed deal. On an open one nothing may stand in its way.
            expect(p.FieldEditable('Amount')).toBe(true);
            expect(p.FieldEditable('Description')).toBe(true);
            expect(p.FieldEditable('DealStatusTypeID')).toBe(true);
        });
    }
});

describe('a LOCKED deal renders the frozen fields read-only', () => {
    for (const [name, Ctor] of PANELS) {
        it(`${name}: refuses a frozen field and allows a carve-out`, () => {
            const p = panel(Ctor as never, true);
            expect(p.FieldEditable('Amount'), 'Amount is frozen on a closed deal').toBe(false);
            expect(p.FieldEditable('Description'), 'Description is a carve-out').toBe(true);
        });
    }

    it('keeps the generic Deal Status field read-only', () => {
        /**
         * The status IS how a closed deal is reopened (golive#205) — but through the Pipeline panel's
         * own control, which routes to Sales.ReopenDeal. Writing the column directly is precisely what
         * the server refuses, so the generic field for it must not invite typing.
         */
        expect(panel(MJSDealPipelinePanel as never, true).FieldEditable('DealStatusTypeID')).toBe(false);
    });

    it('treats a form that never resolved a lock as unlocked', () => {
        // Failing OPEN here is deliberate. A panel whose FormComponent has not answered yet must not
        // grey out a deal nobody has shown to be closed.
        const p = new MJSDealPipelinePanel();
        Object.defineProperty(p, 'FormComponent', { value: undefined, configurable: true, writable: true });
        expect(p.FieldEditable('Amount')).toBe(true);
    });
});

describe('the binding is wired, not just the helper', () => {
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

    it('every field binding asks FieldEditable', () => {
        // A correct rule nothing calls is the defect this whole round keeps finding. `EditableFieldNames`
        // on the form component was exported, documented, and had no caller for the same reason.
        const bindings = source.match(/\[EditMode\]="[^"]*"/g) ?? [];
        const fieldBindings = bindings.filter((x) => x.includes('EditMode &&') || x === '[EditMode]="EditMode"');
        const unguarded = fieldBindings.filter((x) => x === '[EditMode]="EditMode"');
        expect(unguarded, `these bind EditMode without asking the lock: ${unguarded.join(', ')}`).toEqual([]);
    });

    it('asks the shared rule rather than a local copy of the list', () => {
        expect(source).toContain('IsDealFieldEditableWhileLocked');
        // A literal list here would drift from the server's the first time #206 item 3 grows.
        expect(source).not.toMatch(/const\s+\w*EDITABLE\w*\s*=\s*\[/);
    });
});

/**
 * THE TWO GAPS AN AUDIT AGAINST THE ISSUE TEXT FOUND, after the panels were already done and verified.
 *
 * Both were missed the same way: the work was checked against the panels it changed, not against the
 * sentence in the issue. golive#206 item 3 says "the header AND ... the Pipeline, Account & people,
 * Commercial, Motion and Close panels", and item 1 asks for the grid's buttons as well as the server
 * refusal. The sweep above is the reason the header survived -- it read ONE file.
 */
describe('the header is part of item 3, not just the panels', () => {
    const PANELS = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
    const HERO = readFileSync(new URL('../lib/form-panels/deal-hero.panel.ts', import.meta.url), 'utf8');

    it('binds no field with a bare EditMode, in EITHER file', () => {
        /**
         * Scoped to one file, this same assertion passed while the hero's Name field stayed editable on
         * a closed deal -- the only typeable field left on the form, refused by the server on save,
         * which is the exact behaviour item 3 removes. The file list is the assertion.
         */
        for (const [name, source] of [['panels', PANELS], ['hero', HERO]] as const) {
            const unguarded = (source.match(/\[EditMode\]="EditMode"/g) ?? []);
            expect(unguarded, `${name}: ${unguarded.length} field(s) bind EditMode without asking the lock`)
                .toEqual([]);
        }
    });

    it('gates the header Name through the shared rule, not a bare IsLocked test', () => {
        expect(HERO).toMatch(/\[EditMode\]="EditMode && NameEditable"/);
        // The same constant the entity server enforces. A bare `!IsLocked` would silently disagree with
        // the server the day Name joins the editable set.
        expect(HERO).toContain('IsDealFieldEditableWhileLocked');
    });
});

describe("item 1's form half: the lines grid stops offering New on a locked deal", () => {
    const PANELS = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
    /**
     * COMMENTS STRIPPED. The first version of the last assertion below read the getter's own doc
     * comment -- which names ResolveDealLockState while explaining why it does NOT call it -- and
     * failed on prose. That is the third time this session a source-level test matched the comment
     * instead of the code, so the helper is explicit rather than incidental.
     */
    const codeOnly = (text: string): string =>
        text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    const linesPanel = codeOnly(
        (() => {
            const start = PANELS.indexOf("key: 'sales:deal-lines'");
            return PANELS.slice(start, PANELS.indexOf('@RegisterClassEx', start + 10));
        })(),
    );

    it('hides New when the deal is locked', () => {
        // The tester added a line to a Won deal through this toolbar and it saved.
        expect(linesPanel).toMatch(/\[ShowNewButton\]="!IsLocked"/);
    });

    it('does NOT bind delete, which would start showing it on open deals', () => {
        // ShowDeleteButton defaults to false, so the toolbar never offers delete on any deal. Binding
        // it to !IsLocked would turn it ON for every open deal -- the opposite of what #206 asks.
        expect(linesPanel).not.toMatch(/\[ShowDeleteButton\]/);
    });

    it('reads the lock off the form rather than resolving it a second time', () => {
        expect(linesPanel).toMatch(/public get IsLocked\(\): boolean/);
        expect(linesPanel, 'a second ResolveDealLockState call is a second answer to a settled question')
            .not.toContain('ResolveDealLockState');
    });
});
