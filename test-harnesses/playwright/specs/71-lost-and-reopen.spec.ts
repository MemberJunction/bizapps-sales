/**
 * @fileoverview Closed Lost and reopen — the ORDER side, which no browser spec has ever asserted.
 *
 * ── WHAT `60-close-deal.spec.ts` ALREADY COVERS, AND WHAT IT DOES NOT ────────────────────────────
 *
 * That spec covers close-lost being refused without a reason, accepted with one, and reopen unlocking
 * the deal while the close event survives. Good, and none of it is repeated here.
 *
 * What it never mentions is the ORDER. Grep it for `Voided` or `OrderHeader` and there is nothing. So the
 * two rules that make the lost path coherent have never been driven through a browser:
 *
 *   Closed Lost -> the embedded order is VOIDED, because a lost deal's order must stop being something
 *                  finance might act on.
 *   Reopened    -> the order CANNOT come back, because `Voided` is terminal in orders' own transition
 *                  table, and the reopen SURFACES A WARNING saying so.
 *
 * ── THE WARNING IS THE ASSERTION, NOT AN INCONVENIENCE ──────────────────────────────────────────
 *
 * ⚠️ **THIS SPEC IS RED ON PURPOSE — see DN-18 and step 4.** Everything up to the final assertion passes:
 * the loss voids the order, the reopen succeeds, the append-only log keeps both events, and the order
 * stays `Voided`. What fails is the last claim — that the screen SAYS the order could not follow. It does
 * not, because the workspace's reopen never asks for a stage, so nothing attempts the restore and there is
 * no refusal to report. Asserted rather than relaxed, so it goes green when the gap is closed.
 *
 * S-US8 wants the order restored on reopen and orders will not allow it. The designed outcome is that the
 * deal reopens ANYWAY and the refusal is reported: a stage change must never be blocked by an order-side
 * refusal. **A silent reopen is the bug** — it leaves a working deal pointing at a voided order with
 * nothing on screen saying so, and the next person to look finds it weeks later.
 *
 * So this spec fails in two directions: if the order is not voided on loss, and if the reopen says
 * nothing about it.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `DealEntityServer`, replace the `_orderStatusWarnings.push(...)` in the refusal branch with a local
 * that is never read (mutant `M-OS3` does exactly this). The reopen still succeeds, the order is still
 * voided, and only the warning assertion fails.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, CloseLost, ComposeDeal, PurgeByPrefix, PurgeDeal, ReopenDeal } from '../lib/deal-flow';
import { SaveDeal, SelectByLabel } from '../lib/workspace';

const RUN = `PW-LOST-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

test.describe('closed lost and reopen — what happens to the order', () => {
    test.afterAll(async () => {
        if (dealID) {
            await PurgeDeal(dealID, orderID || null);
            // And by NAME: a failure inside ComposeDeal means dealID was never returned, so the
            // purge above runs on an empty string while a real deal sits in the database.
            await PurgeByPrefix(RUN.split(' ')[0]);
        }
        const left = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN}%'`,
        );
        expect(Number(left?.N ?? -1), 'the deal this spec created must be gone').toBe(0);
        await AssertBaseline();
    });

    test('lost voids the order; reopen succeeds and SAYS the order could not follow', async ({ page }) => {
        test.setTimeout(600_000);
        const sink = captureConsoleErrors(page);

        const composed = await ComposeDeal(page, `${RUN} lost path`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        /**
         * THE LOSING STAGE BY ITS DECLARATION. `OrderStatusOnEntry = 'Voided'` is the mechanism; a stage
         * called "Lost" is just a label, and the pipeline is free to call it "Walked Away".
         */
        const losing = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 s.Name
              FROM __mj_BizAppsSales.PipelineStage s
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = s.DealStatusTypeID
             WHERE s.PipelineID = (SELECT PipelineID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}')
               AND s.IsActive = 1 AND t.IsLost = 1 AND s.OrderStatusOnEntry = 'Voided'
             ORDER BY s.DisplayOrder`);
        expect(
            losing?.Name,
            'the pipeline needs a losing stage that declares Voided, or this rule cannot be exercised',
        ).toBeTruthy();

        /**
         * ── 1. CLOSE LOST, THROUGH THE CLOSE PANEL ──────────────────────────────────────────────
         *
         * This selected the losing STAGE and pressed Save, which does not close a deal and was never
         * going to: `DealEntityServer` moves the stage and stamps the order status from
         * `OrderStatusOnEntry`, and leaves the deal's STATUS alone on purpose -- closing is
         * `Sales.CloseDeal`, an explicit act. So the deal stayed open, the assertions below described a
         * close that had not happened, and the first one to notice was a null-status JOIN.
         *
         * ── AND THE STAGE IS NO LONGER MOVED BY HAND, WHICH IS THE WHOLE POINT NOW ──────────────────
         *
         * This used to select the losing stage and Save before closing, to get the order voided. That
         * pre-move was what kept the spec red after the reopen derivation landed: with the deal ALREADY in
         * the losing stage, the close had nowhere to move it, its event recorded
         * `FromStageID === ToStageID`, and the reopen correctly restored the stage the deal was already in
         * — `close-deal.CD19`'s case, reached by accident.
         *
         * The close now derives its own closing stage from the outcome's flag
         * (`closingStageForOutcome`), so the pre-move is redundant: closing as LOST lands the deal in the
         * losing stage, that stage declares `OrderStatusOnEntry = 'Voided'`, and the order is voided by
         * the same writer as before. The reopen then restores the stage the deal came FROM, that stage
         * asks for `Quoted`, orders refuses because `Voided` is terminal — and the refusal is what this
         * spec exists to see on screen.
         *
         * `losing` is still resolved above, and still asserted, because a pipeline with no losing stage
         * would make the derivation return null and this scenario unreachable.
         *
         * ── BUT THE DEAL MUST BE QUOTED FIRST, AND THAT IS NOT SETUP PADDING ────────────────────────
         *
         * The reopen restores the stage the deal came FROM, and asks that stage what the order should be.
         * `ComposeDeal` leaves the deal in the pipeline's FIRST stage, which in the seeded vocabulary
         * declares no `OrderStatusOnEntry` at all — so the restore asks for nothing, the order writer never
         * runs, and there is correctly nothing to warn about. Measured: that is why this spec stayed red
         * after the derivation landed.
         *
         * Advancing to a stage that DOES declare an order status is the scenario the story describes — a
         * deal gets quoted, is then lost, and is later reopened — and it is the only shape in which the
         * order has something to refuse.
         */
        const quoting = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 s.Name
              FROM __mj_BizAppsSales.PipelineStage s
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = s.DealStatusTypeID
             WHERE s.PipelineID = (SELECT PipelineID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}')
               AND s.IsActive = 1 AND s.OrderStatusOnEntry IS NOT NULL AND t.LocksDeal = 0
             ORDER BY s.DisplayOrder`);
        expect(
            quoting?.Name,
            'the pipeline needs a non-closing stage that declares an OrderStatusOnEntry, or the order has ' +
                'nothing to refuse on the way back',
        ).toBeTruthy();
        await SelectByLabel(page, 'Stage', String(quoting!.Name));
        await SaveDeal(page);
        await page.waitForTimeout(2_000);

        const reason = await QueryOne<{ Name: string }>(
            `SELECT TOP 1 Name FROM __mj_BizAppsSales.LossReason WHERE IsActive = 1 AND RequiresNotes = 0
              ORDER BY DisplayRank`,
        );
        expect(reason?.Name, 'a loss reason that does not demand notes is needed').toBeTruthy();
        await CloseLost(page, String(reason!.Name), 'Explorer pass: lost path.');

        const lost = await QueryOne<{ IsLost: boolean; LossReasonID: string | null; OrderStatus: string }>(`
            SELECT t.IsLost, d.LossReasonID, o.Status AS OrderStatus
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
              LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
             WHERE d.ID = '${dealID}'`);
        /**
         * ROW FIRST, FIELD SECOND. `lost!.IsLost` reported
         * `Cannot read properties of undefined (reading 'IsLost')` -- which names the field and says
         * nothing about the cause, because the row itself was absent: the deal had a NULL status and the
         * `JOIN DealStatusType` dropped it. A non-null assertion on a query result turns "no row" into a
         * message about whatever field is read first, so the join is asserted separately now.
         */
        expect(
            lost,
            'the deal must resolve a status through DealStatusType — no row here means a NULL ' +
                'DealStatusTypeID, which every IsOpen/IsWon rollup silently skips',
        ).toBeTruthy();
        expect(lost!.IsLost, 'the deal must land in a status carrying IsLost').toBe(true);
        expect(lost!.LossReasonID, 'and carry the loss reason — the most-skipped, highest-value field')
            .toBeTruthy();
        expect(
            String(lost!.OrderStatus),
            'THE ORDER MUST BE VOIDED — a lost deal\'s order has to stop being something finance may act on',
        ).toBe('Voided');

        /**
         * ── 2. REOPEN, with a reason ────────────────────────────────────────────────────────────
         *
         * The previous version filled `.locator('textarea, input[type="text"]').last()` and swallowed
         * the failure with `.catch(() => undefined)` — so on a page where that resolved to something
         * else, the reason went somewhere harmless, the confirm was pressed with an EMPTY reason, and
         * `Sales.ReopenDeal` refused it. The spec then asserted against a deal that was still closed.
         * Two guesses and a swallowed error, in the one step whose whole point is that a reason is
         * mandatory. `reopen-reason` is the field's own testid.
         */
        await ReopenDeal(page, 'PW: reopened to assert the order-status warning');

        // ── 3. THE DEAL REOPENED, and the close event SURVIVED ──────────────
        const after = await QueryOne<{ IsOpen: boolean; OrderStatus: string }>(`
            SELECT t.IsOpen, o.Status AS OrderStatus
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
              LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
             WHERE d.ID = '${dealID}'`);
        expect(after!.IsOpen, 'the reopen must succeed — the order refusing must not block it').toBe(true);

        const events = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${dealID}'`,
        );
        expect(
            events.length,
            'the append-only log must hold BOTH the close and the reopen — provenance is never rewritten',
        ).toBeGreaterThanOrEqual(2);

        /**
         * THE ORDER STAYS VOIDED, and that is correct rather than tolerated: `Voided` is terminal in
         * orders' own `CanTransition` table. Asserting it pins the fact that sales does not try to
         * un-void by another route.
         */
        expect(
            String(after!.OrderStatus),
            'the order stays Voided — terminal in orders, and sales must not invent a way round it',
        ).toBe('Voided');

        /**
         * ── 4. AND THE SCREEN SAYS SO. THIS IS A TRIPWIRE AND IT IS RED — DN-18 ─────────────────
         *
         * A silent reopen is the bug, and today the reopen IS silent. The diagnosis, which took two
         * fixes to reach and neither of them was this one:
         *
         *   · `Sales.ReopenDeal` is not at fault. Its success output carries
         *     `Issues: orderStatusIssues(deal)` — it reports the refusal properly.
         *   · The WORKSPACE dropped those issues: `ApplyCloseIssues` ran only on the `!Success` branch,
         *     so every warning on a successful close or reopen was discarded. **Fixed** — both handlers
         *     now call `SurfaceOperationIssues` after the reload.
         *   · The reopen NOW DERIVES its landing stage from the close event's `FromStageID`
         *     (DN-18, `close-deal.CD18`), so `input.StageID` is an override rather than a requirement and
         *     an agent gets the same restoration a rep does.
         *   · **And it still cannot help THIS flow, for a reason worth stating.** This spec moves the deal
         *     into the losing stage with a PLAIN SAVE and only then closes it through the panel. So the
         *     close never moved the stage, its event holds `FromStageID === ToStageID`, and the reopen
         *     correctly derives the stage the deal is already in — `CD19`'s case exactly. Nothing is
         *     restored because nothing moved, and nothing warns because nothing was attempted.
         *   · Which exposes the remaining half: **`DealWorkspaceComponent.ConfirmClose()` sends no
         *     `ClosingStageID` either.** No close driven from the browser ever moves the stage, so no
         *     reopen driven from the browser can restore one. The mechanism works — `CD18` proves it
         *     end to end — and the UI cannot reach it. That is the mirror image of the reopen's missing
         *     `StageID`, and closing it is the same kind of decision: derive the closing stage in the
         *     operation from the pipeline stage whose declared status matches the outcome, or ask the rep.
         *     Recorded in DN-18; deliberately not guessed at here.
         *
         * S-US8 describes a reopen that enters a stage and reports what the order refused. The operation
         * can do that; the UI never asks it to. Closing the gap is a design decision — re-apply the
         * current stage's `OrderStatusOnEntry` on reopen, or offer the rep a stage on the reopen panel —
         * and it is recorded in `DECISIONS-NEEDED.md` DN-18 rather than guessed at here.
         *
         * Kept as an ASSERTION OF THE INTENT, the same way `78` was for KI-20 and `79` was for DN-17:
         * both of those went green the day their defect was fixed, without anyone having to remember to
         * come back and re-tighten a spec that had been relaxed to match a bug.
         */
        await expect(
            page.locator('.dw-msg:visible, .dw-issues li:visible').filter({ hasText: /order|Voided|could not/i }).first(),
            'the reopen must SURFACE that the order could not follow — a silent success leaves a working ' +
                'deal pointing at a voided order with nothing on screen saying so (DN-18)',
        ).toBeVisible({ timeout: 20_000 });

        expectOnlyKnownErrors(sink, [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/], 'lost and reopen');
    });
});
