/**
 * @fileoverview golive#291 on the real Explorer: the Stage control offers only the deal's OWN
 * pipeline's stages, and changing the pipeline clears a stage that no longer belongs to it.
 *
 * ── WHY THIS IS A SPEC OF ITS OWN ───────────────────────────────────────────────────────────────
 *
 * Every other deal spec builds its deal through `ComposeDeal`, which fills the Account lookup. That
 * control currently offers no rows on this host -- `vwSalesAccounts` has three and every request in
 * a run returns 200, so it is the control, not the data -- and a spec that cannot create a deal
 * cannot reach a stage control at all. `Deal.AccountID` is NULLABLE, so a deal that simply skips it
 * still saves, which is what makes the stage behaviour reachable while that is unresolved.
 *
 * If the Account lookup starts working again this spec does not become redundant: nothing else
 * asserts the stage LIST, only that a pick landed.
 *
 * ── WHAT MAKES IT FALSIFIABLE ───────────────────────────────────────────────────────────────────
 *
 * The defect golive#291 reports is the control listing every stage in the system. Counting is the
 * whole point, so the assertion is on the exact SET of option ids rather than on "some stages are
 * offered": remove the filter and the set grows to every active stage, and the test says so.
 *
 * The two pipelines deliberately have different stage counts, so a run that passed by listing all of
 * them could not also pass against the other pipeline. The ids come from the database, never from
 * the screen -- taking them from the screen would make both sides of the comparison the same source.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `MJSDealPipelinePanel`, change `StagesForCurrentPipeline` to return `this.stages()` unfiltered:
 * step 2 fails with the full set of active stage ids. Delete the clearing branch in `SetPipeline`
 * and step 4 fails with the old stage still selected. Both were used to prove this spec is not
 * vacuous.
 */
import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import {
    EditDeal,
    FirstOpenStatus,
    OpenNewDeal,
    PipelineByName,
    SaveDeal,
    SetPipelineByID,
    SetStageByID,
    SetStatusByID,
    SetText,
    ShowSection,
    StageSelect,
} from '../lib/deal-form';

const DEAL_NAME = `PW-291-stage-filter-${Date.now()}`;

/** Any GUID inside an Angular `[ngValue]` option value, which is written as `"<index>: <value>"`. */
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The record ids the Stage control is currently OFFERING, lowercased, placeholder excluded. */
async function offeredStageIDs(page: Page): Promise<string[]> {
    const select = await StageSelect(page);
    const values = await select
        .locator('option')
        .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
    return values.map((v) => (v.match(GUID)?.[0] ?? '').toLowerCase()).filter(Boolean).sort();
}

/**
 * What the Stage control is currently showing: the record id it holds, and WHICH option is selected.
 *
 * The index is not decoration. A `<select>` whose bound value is not among its options shows nothing
 * and reports no value, which is indistinguishable by value alone from one that was properly
 * cleared -- so an assertion on the value only would pass while a stale stage is still bound, which
 * is precisely the defect golive#291 reports. A mutant that removed the clearing slipped past this
 * check until the index was added. Cleared means index 0, the placeholder; -1 means "holding
 * something I cannot show".
 */
async function stageSelection(page: Page): Promise<{ id: string | null; index: number }> {
    const select = await StageSelect(page);
    const value = await select.inputValue();
    const index = await select.evaluate((el) => (el as HTMLSelectElement).selectedIndex);
    return { id: (value.match(GUID)?.[0] ?? '').toLowerCase() || null, index };
}

/** Every active stage of one pipeline, by id, from the database. */
async function stageIDsOf(pipelineID: string): Promise<string[]> {
    const rows = await QueryAll<{ ID: string }>(
        `SELECT CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsSales.PipelineStage
          WHERE PipelineID = '${pipelineID}' AND IsActive = 1`,
    );
    return rows.map((r) => String(r.ID).toLowerCase()).sort();
}

test.describe('golive#291 — a stage belongs to the deal\'s pipeline', () => {
    test('the Stage control offers only this pipeline\'s stages, and clears when the pipeline changes', async ({
        page,
    }) => {
        const b2b = await PipelineByName('B2B');
        const d2c = await PipelineByName('D2C');

        const b2bStages = await stageIDsOf(b2b.ID);
        const d2cStages = await stageIDsOf(d2c.ID);
        const everyActiveStage = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsSales.PipelineStage WHERE IsActive = 1`,
        );

        /**
         * The premise the rest of this spec rests on. If the two pipelines ever have the same stages,
         * or one of them holds every active stage, "filtered" and "unfiltered" stop being
         * distinguishable and a green run would mean nothing.
         */
        expect(b2bStages.length, 'B2B must have stages').toBeGreaterThan(0);
        expect(d2cStages.length, 'D2C must have stages').toBeGreaterThan(0);
        expect(
            b2bStages.length,
            'the two pipelines must differ in stage count, or this spec cannot tell filtered from unfiltered',
        ).not.toBe(d2cStages.length);
        expect(
            Number(everyActiveStage?.N ?? 0),
            'the system must hold more active stages than either pipeline alone',
        ).toBeGreaterThan(Math.max(b2bStages.length, d2cStages.length));

        // ── 1. A NEW DEAL ON B2B ────────────────────────────────────────────
        // No Account: that lookup is broken on this host and `Deal.AccountID` is nullable.
        await OpenNewDeal(page);
        await SetText(page, 'Name', DEAL_NAME);
        /**
         * The form shows ONE section at a time from a rail, and Pipeline is not the one it lands on.
         * `Field` expands a collapsed panel but cannot switch sections, so the controls are present
         * and hidden until this runs -- which reads as "the field is missing" if you skip it.
         */
        await ShowSection(page, 'Pipeline');
        await SetPipelineByID(page, b2b.ID);
        await SetStatusByID(page, (await FirstOpenStatus()).ID);

        // ── 2. THE LIST IS THIS PIPELINE'S, NOT THE SYSTEM'S ────────────────
        expect(
            await offeredStageIDs(page),
            `Stage must offer B2B's ${b2bStages.length} stages, not all ${everyActiveStage?.N}`,
        ).toEqual(b2bStages);

        // ── 3. A PICK LANDS, CONFIRMED FROM THE ROW ─────────────────────────
        const chosen = b2bStages[0];
        await SetStageByID(page, chosen);
        await SaveDeal(page);

        const saved = await QueryOne<{ ID: string; PipelineID: string; PipelineStageID: string | null }>(
            `SELECT CAST(ID AS nvarchar(50)) AS ID, CAST(PipelineID AS nvarchar(50)) AS PipelineID,
                    CAST(PipelineStageID AS nvarchar(50)) AS PipelineStageID
               FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
        );
        expect(saved?.ID, 'the deal must have saved without an account').toBeTruthy();
        expect(String(saved!.PipelineID).toLowerCase()).toBe(b2b.ID.toLowerCase());
        expect(
            String(saved!.PipelineStageID ?? '').toLowerCase(),
            'the stage picked must be the stage stored',
        ).toBe(chosen);

        // ── 4. CHANGING THE PIPELINE CLEARS THE STAGE AND RE-NARROWS THE LIST ──
        /**
         * Andrew's two words: "narrow it or clear it". Both are asserted here, on the same edit, and
         * the clearing is checked on the CONTROL rather than only after a save -- a stage that stays
         * selected until the server rejects it is still the defect being reported.
         */
        await EditDeal(page);
        // Re-entering edit mode re-renders the form and does not keep the section that was showing,
        // so the rail has to be pointed back at Pipeline exactly as it did on the way in.
        await ShowSection(page, 'Pipeline');
        await SetPipelineByID(page, d2c.ID);

        const cleared = await stageSelection(page);
        expect(
            cleared.id,
            'a B2B stage is meaningless on a D2C deal and must not still be selected',
        ).toBeNull();
        expect(
            cleared.index,
            'the control must be ON the placeholder — index -1 means a stale stage is still bound, ' +
                'merely unshowable, which is the defect rather than the fix',
        ).toBe(0);
        expect(
            await offeredStageIDs(page),
            `after switching to D2C, Stage must offer D2C's ${d2cStages.length} stages`,
        ).toEqual(d2cStages);

        await SaveDeal(page);

        const moved = await QueryOne<{ PipelineID: string; PipelineStageID: string | null }>(
            `SELECT CAST(PipelineID AS nvarchar(50)) AS PipelineID,
                    CAST(PipelineStageID AS nvarchar(50)) AS PipelineStageID
               FROM __mj_BizAppsSales.Deal WHERE ID = '${saved!.ID}'`,
        );
        expect(String(moved!.PipelineID).toLowerCase()).toBe(d2c.ID.toLowerCase());
        expect(
            moved!.PipelineStageID,
            'the cleared stage must have been persisted as cleared, not silently kept',
        ).toBeNull();
    });

    test.afterAll(async () => {
        const row = await QueryOne<{ ID: string }>(
            `SELECT CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
        );
        if (!row?.ID) return;
        for (const t of ['DealStageEvent', 'DealTeamMember', 'DealPaymentSchedule', 'DealContactRole']) {
            await QueryAll(`DELETE FROM __mj_BizAppsSales.${t} WHERE DealID = '${row.ID}'`);
        }
        await QueryAll(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${row.ID}'`);
    });
});
