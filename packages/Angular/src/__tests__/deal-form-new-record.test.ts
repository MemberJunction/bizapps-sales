import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel, MJSDealPartyPanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * The three UAT reports against S-US1, all on the New Deal form: bc-aidp-next-golive#188, #189, #190.
 *
 * WHY THESE ARE UNIT TESTS. All three defects are decided before anything reaches a database: whether a
 * field appears in a panel's `Fields` array, and whether a getter returns warnings for a record nobody
 * has saved. The integration suite proves the data tier and cannot reach either; Playwright could, but
 * sales' Explorer specs already cannot run against this host, and a criterion whose only proof is a spec
 * that cannot execute is an unproven criterion.
 *
 * The Overview panel is instantiated through `Object.create` rather than Angular DI, matching
 * `deal-workspace-product.test.ts`: `Health` reads exactly one instance field (`Record`) and one getter
 * on itself, so standing up an injector would add ceremony without adding assurance.
 *
 * The Pipeline panel is constructed normally, because it has to be: `Fields` is an instance property
 * initializer, and `Object.create` never runs one — the array would read as undefined and every
 * assertion below would pass or fail for a reason unrelated to the panel. Neither panel injects
 * anything, so `new` is safe here.
 *
 * The real classes are imported — not copies of their logic — so a change to either reaches these tests.
 *
 * WHAT #189 AND #190 ACTUALLY WERE. Both fields were listed on the Pipeline panel while the hero above it
 * already rendered them: `Name` as an editable field in edit mode, `DealNumber` beneath the title once
 * the server assigns one. Two inputs bound to one column, and an empty textbox for a value the user does
 * not get to choose. These tests pin the panel's side of that; the hero's side is unchanged and untested
 * here on purpose, because the hero was never the defect.
 */

/** A deal shaped like the form's, with only the fields `Health` reads. */
const deal = (over: Partial<Record<string, unknown>> = {}) =>
    ({
        IsSaved: true,
        ExpectedCloseDate: null,
        ActualCloseDate: null,
        OwnerEmployeeID: 'emp-1',
        NextStep: 'Call them',
        NextStepDate: null,
        AccountID: 'acct-1',
        Amount: null,
        Probability: null,
        ...over,
    }) as unknown as DealEntity;

const overviewWith = (record: DealEntity | null) => {
    const panel = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    return panel;
};

describe('#188 — an unsaved deal is not a deal that failed an audit', () => {
    it('reports nothing at all on a record nobody has saved', () => {
        const panel = overviewWith(
            deal({ IsSaved: false, OwnerEmployeeID: null, NextStep: null, AccountID: null }),
        );
        expect(panel.Health).toEqual([]);
    });

    /**
     * The guard must key on IsSaved, not on emptiness. A saved deal that is genuinely missing an owner
     * is the case the briefing exists for, and suppressing it would trade one defect for a worse one.
     */
    it('still reports the same gaps once the record is saved', () => {
        const panel = overviewWith(
            deal({ IsSaved: true, OwnerEmployeeID: null, NextStep: null, AccountID: null }),
        );
        expect(panel.Health).toEqual([
            'No owner assigned.',
            'No next step recorded.',
            'No account selected.',
        ]);
    });

    it('says nothing about a saved deal that has everything', () => {
        expect(overviewWith(deal()).Health).toEqual([]);
    });

    it('survives having no record at all', () => {
        expect(overviewWith(null).Health).toEqual([]);
    });

    /**
     * An unsaved deal can still carry values — the user has been typing. Emptiness is not the trigger;
     * the absence of a save is, so a half-filled new deal stays quiet too.
     */
    it('stays quiet on an unsaved deal even when it already has data', () => {
        const panel = overviewWith(deal({ IsSaved: false, OwnerEmployeeID: null, Amount: 5000 }));
        expect(panel.Health).toEqual([]);
    });
});

describe('#189 / #190 — the Pipeline panel does not repeat the hero', () => {
    const fieldNames = () =>
        new MJSDealPipelinePanel().Fields.map((f) => f.name);

    /**
     * Both of the record's identifying fields have to survive a COLLAPSED header, which is why this
     * reads the template rather than a field list. Removing the Pipeline duplicates made the hero the
     * only place either one appears, and Collapsed is a persisted per-user setting — so gating them
     * on it would leave anyone who had ever collapsed the header with no way to name a deal and no
     * sight of its number.
     *
     * It extracts the collapsed-only block and asserts what is NOT in it, rather than comparing string
     * offsets, so reformatting the template does not fail it for the wrong reason.
     */
    it('keeps Name and Deal Number out of the collapsed-only region', () => {
        const source = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-hero.panel.ts'),
            'utf8',
        );

        /**
         * Found by PATTERN, not by the exact condition text. The block gained `&& Record.IsSaved` when
         * the briefing stopped rendering on an unsaved deal, and a literal `'@if (!Collapsed) {'` lookup
         * silently stopped finding it — reporting a missing block rather than the thing this test is
         * actually about. What must stay true is that the region gated on Collapsed holds neither
         * control; which other conditions it carries is not this test's business.
         */
        const blockStart = source.match(/@if \(!Collapsed[^)]*\) \{/);
        expect(blockStart, 'the collapsed-only region must still exist').not.toBeNull();
        const open = blockStart!.index!;
        expect(open).toBeGreaterThan(-1);

        // Walk braces from the block opener to find where the collapsed-only region ends.
        let depth = 0;
        let close = open;
        for (let i = source.indexOf('{', open); i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}') {
                depth--;
                if (depth === 0) { close = i; break; }
            }
        }
        expect(close).toBeGreaterThan(open);

        const collapsedOnly = source.slice(open, close);
        expect(collapsedOnly).not.toContain('FieldName="Name"');
        expect(collapsedOnly).not.toContain('Record.DealNumber');

        // Deal Number is not gated by the BLOCK, it carries its own inline condition — so the block
        // check above cannot see it, and would pass with the defect present. Assert the condition
        // itself never mentions Collapsed.
        const numberGate = source.match(/@if \(Record\.DealNumber[^)]*\)/);
        expect(numberGate).not.toBeNull();
        expect(numberGate![0]).not.toContain('Collapsed');

        // ...and both are still present somewhere in the template.
        expect(source).toContain('FieldName="Name"');
        expect(source).toContain('Record.DealNumber');
    });

    it('does not list Name, which the hero renders editable in edit mode', () => {
        expect(fieldNames()).not.toContain('Name');
    });

    it('does not list DealNumber, which the server assigns and the hero shows', () => {
        expect(fieldNames()).not.toContain('DealNumber');
    });

    /**
     * The panel must still be the pipeline panel. Deleting two lines from a `Fields` array is exactly the
     * kind of edit that quietly takes a neighbour with it, so the fields the report never complained
     * about are pinned here.
     */
    it('still lists the pipeline fields it exists for', () => {
        const names = fieldNames();
        for (const kept of [
            'PipelineID',
            'PipelineStageID',
            'DealTypeID',
            'ForecastCategoryTypeID',
            'Probability',
        ]) {
            expect(names).toContain(kept);
        }
    });

    /**
     * `DealStatusTypeID` left this array on purpose (bc-aidp-next-golive#205).
     *
     * `<mj-form-field>` renders a foreign key as an unfiltered dropdown off the related entity, so it
     * offered Won and Lost — and picking one wrote the status with none of the close running. The panel
     * now renders its own control that filters by `LocksDeal`, matching the deal workspace.
     *
     * Asserted as an ABSENCE rather than simply dropped from the list above, because a generic field
     * reappearing here is exactly how the defect would come back, and it would look like a tidy-up.
     */
    it('does NOT render status as a generic field, which is what offered the closing statuses', () => {
        expect(fieldNames()).not.toContain('DealStatusTypeID');
    });

    it('lists every field exactly once', () => {
        const names = fieldNames();
        expect(names.length).toBe(new Set(names).size);
    });
});

/**
 * WHAT A NEW DEAL SHOWS INSTEAD OF A BRIEFING.
 *
 * A rep reported the top of the form as "a read-only area that doesn't make sense on a new record":
 * Account, owner, amount, stage and next step are all empty before a deal exists, so an unsaved record
 * rendered a grid of dashes under the name it was still being given. The same report asked why there
 * was no way to add products — the answer being that a deal mints its order on first save, which
 * nothing on screen said.
 */
describe('the hero on an unsaved deal', () => {
    const hero = (): string =>
        readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-hero.panel.ts'),
            'utf8',
        );

    it('does not render the briefing until the deal exists', () => {
        const block = hero().match(/@if \(!Collapsed[^)]*\) \{/);
        expect(block, 'the briefing block must exist').not.toBeNull();
        expect(block![0], 'and must be gated on the record being saved').toContain('Record.IsSaved');
    });

    /**
     * `IsSaved`, not `EditMode`. A SAVED deal being edited still has an account, an owner and an amount
     * to show, and gating on EditMode would take the briefing away from the person most likely to be
     * checking it against what they are typing.
     */
    it('keeps the briefing for a saved deal that is being edited', () => {
        const block = hero().match(/@if \(!Collapsed[^)]*\) \{/);
        expect(block![0]).not.toContain('EditMode');
    });

    it('tells a new deal that saving is what creates somewhere to put products', () => {
        const source = hero();
        const gate = source.indexOf('@if (!Record.IsSaved) {');
        expect(gate, 'the guidance must be gated on NOT saved').toBeGreaterThan(-1);

        const body = source.slice(gate, source.indexOf('}', source.indexOf('</div>', gate)));
        expect(body, 'must name the action').toMatch(/\bSave this deal\b/i);
        expect(body, 'must say what it unblocks').toMatch(/\bproducts?\b/i);
    });

    /**
     * Guidance is not a warning. `.mjs-flag` alone is the warning tone, correct for a lock or a stale
     * amount — telling a rep in orange that naming a new deal has gone wrong is not.
     */
    it('styles the guidance as guidance', () => {
        expect(hero()).toContain('mjs-flag mjs-flag--guide');
        expect(hero(), 'the modifier must actually be defined').toContain('.mjs-flag--guide {');
    });
});

/**
 * ACCOUNT AND CONTACTS WHILE THE DEAL IS BEING CREATED.
 *
 * They live in "Account & people", a different left-nav section from the fields a rep is already
 * filling in — and left-nav shows one section at a time, so composing a new deal meant hopping
 * sections to say who it was with. The Overview renders them while the deal is unsaved.
 *
 * THE INVARIANT THAT MATTERS is that exactly one panel owns each column at any moment. golive#189 and
 * #190 were two inputs bound over one column, and moving fields between panels is precisely how that
 * comes back.
 */
describe('who the deal is with, during creation', () => {
    const party = (saved: boolean) => {
        const p = Object.create(MJSDealPartyPanel.prototype) as MJSDealPartyPanel;
        Object.defineProperty(p, 'Record', { value: { IsSaved: saved }, configurable: true });
        return p;
    };
    const overview = () => Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;

    it('offers account and both contacts on the Overview', () => {
        expect(overview().CreationParty.map((f) => f.name))
            .toEqual(['AccountID', 'PrimaryContactID', 'BillingContactID']);
    });

    it('drops exactly those from the party panel while the deal is unsaved', () => {
        const names = party(false).Fields.map((f) => f.name);
        expect(names).not.toContain('AccountID');
        expect(names).not.toContain('PrimaryContactID');
        expect(names).not.toContain('BillingContactID');
    });

    it('gives them back once the deal is saved — this is a composing aid, not a new home', () => {
        const names = party(true).Fields.map((f) => f.name);
        expect(names).toEqual([
            'AccountID', 'CompanyID', 'OwnerEmployeeID', 'PrimaryContactID', 'BillingContactID',
        ]);
    });

    /**
     * The one that would catch a re-introduced #189: no column may be bound by both panels at once.
     * Asked as a set intersection rather than by naming three fields, so a fourth added later is
     * covered without anyone remembering to extend this.
     */
    it('never binds the same column in two panels at once', () => {
        const ov = new Set(overview().CreationParty.map((f) => f.name));
        const overlapUnsaved = party(false).Fields.map((f) => f.name).filter((n) => ov.has(n));
        expect(overlapUnsaved, 'unsaved: the Overview owns them').toEqual([]);

        // And while saved the Overview does not render them at all — the template gates on IsSaved.
        const src = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
            'utf8',
        );
        const block = src.indexOf('mjs-ov-create');
        expect(block).toBeGreaterThan(-1);
        expect(src.slice(Math.max(0, block - 400), block)).toContain('@if (!Record.IsSaved) {');
    });

    /**
     * The server-maintained pair is deliberately NOT moved. A rep cannot set either, so putting two
     * permanently-blank read-only boxes under "Who is this deal with?" would answer the question with
     * nothing.
     */
    it('leaves the server-maintained stamps where they are', () => {
        const ov = overview().CreationParty.map((f) => f.name);
        expect(ov).not.toContain('CompanyID');
        expect(ov).not.toContain('OwnerEmployeeID');
        expect(party(false).Fields.map((f) => f.name)).toEqual(['CompanyID', 'OwnerEmployeeID']);
    });
});

/**
 * WHERE THE DEAL SITS, during creation — the pipeline half of the same borrow.
 *
 * `PipelineID` is required and decides the selling company, so a deal cannot be saved without it;
 * having it on another rail item was half of why creating one meant hopping sections.
 */
describe('where the deal sits, during creation', () => {
    const pipeline = (record: { IsSaved: boolean } | null) => {
        const p = Object.create(MJSDealPipelinePanel.prototype) as MJSDealPipelinePanel;
        Object.defineProperty(p, 'Record', { value: record, configurable: true });
        return p;
    };
    const overview = () => Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;

    it('offers the two choices a rep makes while creating', () => {
        expect(overview().CreationPipeline.map((f) => f.name)).toEqual(['PipelineID', 'DealTypeID']);
    });

    /**
     * Stage, forecast category and probability stay put: the server derives them from the stage on
     * create, so offering them invites a rep to set values that are about to be overwritten.
     */
    it('does not borrow the fields the server derives', () => {
        const names = overview().CreationPipeline.map((f) => f.name);
        for (const derived of ['PipelineStageID', 'ForecastCategoryTypeID', 'Probability']) {
            expect(names).not.toContain(derived);
        }
    });

    it('drops exactly those from the pipeline panel while unsaved', () => {
        const names = pipeline({ IsSaved: false }).Fields.map((f) => f.name);
        expect(names).toEqual(['PipelineStageID', 'ForecastCategoryTypeID', 'Probability']);
    });

    it('gives them back once saved', () => {
        expect(pipeline({ IsSaved: true }).Fields.map((f) => f.name)).toContain('PipelineID');
    });

    /**
     * ABSENCE IS NOT THE SAME STATE AS UNSAVED. `Record?.IsSaved` alone read undefined as "unsaved"
     * and hid fields from a panel that had no deal at all — which is how the pipeline panel's own
     * field test started failing for a reason unrelated to what it was testing.
     */
    it('borrows nothing when there is no record at all', () => {
        expect(pipeline(null).Fields.map((f) => f.name)).toContain('PipelineID');
    });

    /** The figures describe a deal with history; on a new one they are zeroes under a half-typed name. */
    it('hides the amount and situation block until the deal exists', () => {
        const src = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
            'utf8',
        );
        const strip = src.indexOf('<div class="mjs-ov-strip">');
        expect(strip).toBeGreaterThan(-1);
        expect(src.slice(Math.max(0, strip - 500), strip)).toContain('@if (Record.IsSaved) {');
    });
});

/**
 * THE RAIL ITEMS THAT SHOWED NOTHING AT ALL.
 *
 * On a new deal, selecting "What's being sold", "Internal team" or "Buying team" rendered a blank
 * page — just the hero. Each panel already had an @else branch explaining that the deal must be saved
 * first, and none of it was reachable: all three carry [DefaultExpanded]="false", and a collapsed
 * panel in left-nav renders no body, so the explanation existed and could not be read.
 *
 * A correct message nothing displays is the same defect class as a correct getter nothing consumes.
 */
describe('the related sections on a new deal', () => {
    const PANELS = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
        'utf8',
    );

    it.each([
        ["What's being sold", 'lines'],
        ['Internal team', 'internal-team'],
        ['Buying team', 'buying-team'],
    ])('%s opens on a new deal, so its explanation can be read', (_label, key) => {
        const at = PANELS.indexOf(`SectionKey="${key}"`);
        expect(at, `the ${key} panel must exist`).toBeGreaterThan(-1);
        const tag = PANELS.slice(at, PANELS.indexOf('>', PANELS.indexOf('[BadgeCount]', at)));
        expect(tag, 'a collapsed panel renders no body, so the message would be unreachable')
            .toContain('[DefaultExpanded]="!Record.IsSaved"');
    });

    /** And each still says something rather than rendering an empty card. */
    it.each([
        ['internal-team', /Save the deal first\. Team members/],
        ['buying-team', /Save the deal first\. Contacts are linked/],
    ])('%s explains itself while unsaved', (key, copy) => {
        const at = PANELS.indexOf(`SectionKey="${key}"`);
        const body = PANELS.slice(at, PANELS.indexOf('</mj-collapsible-panel>', at));
        expect(body).toContain('} @else {');
        expect(body).toMatch(copy);
    });
});
