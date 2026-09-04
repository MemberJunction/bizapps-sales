import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

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
            'No owner. Assign an AE.',
            'No next step. Forecast without a next step is a wish.',
            'No account. Early is fine; Qualify should have one.',
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
            'DealStatusTypeID',
            'ForecastCategoryTypeID',
            'Probability',
        ]) {
            expect(names).toContain(kept);
        }
    });

    it('lists every field exactly once', () => {
        const names = fieldNames();
        expect(names.length).toBe(new Set(names).size);
    });
});
