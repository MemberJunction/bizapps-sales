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
 *   Reopened    -> the order COMES BACK when the restored stage declares a status orders allows from
 *                  `Voided`, and when it cannot the reopen SURFACES A WARNING saying so.
 *
 * ── THE SECOND RULE USED TO BE WRITTEN THE OTHER WAY ROUND, AND IT WAS WRONG ────────────────────
 *
 * This header said the order "CANNOT come back, because `Voided` is terminal in orders' own transition
 * table", and that the spec was therefore RED ON PURPOSE waiting for a warning that could never be
 * avoided. Orders says otherwise, by its own API: `TRANSITIONS.Voided` is `['Draft', 'Quoted']`, so
 * `IsTerminal('Voided')` is FALSE and `Confirmed` is the terminal status. Step 3 below had already been
 * repaired on 2026-08-26 after measuring exactly that ("expected Voided, got Quoted") — so the file has
 * been arguing with itself since, its header asserting the premise its body disproves.
 *
 * WHICH WAY THIS SPEC ACTUALLY GOES depends on the stage the reopen restores, and that is why the setup
 * below advances the deal to a QUOTING stage before losing it rather than leaving it where `ComposeDeal`
 * put it. The restored stage then declares `Quoted`, orders permits `Voided -> Quoted`, and the order
 * follows. Step 3 derives that expectation from the stage and from `CanTransition` rather than naming a
 * status, so it tracks orders' table instead of re-encoding a snapshot of it.
 *
 * **A silent reopen is still the bug** — a working deal pointing at a voided order with nothing on
 * screen saying so. That tripwire is kept, gated on whether orders actually refused: demanding a warning
 * about a refusal that did not happen would be asserting the old premise a second time.
 *
 * So this spec fails in two directions: if the order is not voided on loss, and if the reopen neither
 * brings the order back nor says why it could not.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `DealEntityServer.planStageOrderStatus`, return `null` unconditionally so no plan is produced. The
 * loss still voids the order, the reopen still succeeds, the log still holds both events — and step 3
 * fails on the one thing this spec is for: the order did not follow the stage it was restored into.
 *
 * NOT "return before `order.Save()` in `applyStageOrderStatus`", which an earlier version of this note
 * suggested. That method assigns `order.Status = plan.Target` BEFORE saving, and its own comment records
 * that the deal's save graph writes the embedded order regardless — so the mutant may leave the spec
 * green and prove nothing. Killing the PLAN is unambiguous; killing the write is not.
 *
 * NOT the old recipe, which was to blank the `_orderStatusWarnings.push(...)` in the refusal branch
 * (mutant `M-OS3`). That branch does not execute in this flow any more: the restored stage declares
 * `Quoted`, orders permits the move, so there is no refusal to warn about and the warning assertion is
 * gated off. A mutant aimed at a branch the spec no longer reaches proves nothing about the spec.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';
import { CanTransition } from '@mj-biz-apps/orders-entities';
import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, CloseLost, ComposeDeal, PurgeByPrefix, PurgeDeal, ReopenDeal } from '../lib/deal-flow';
import { DealForm, EditDeal, PickLookup, SaveDeal } from '../lib/deal-form';

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

    test('lost voids the order; reopen brings it back, or says why it could not', async ({ page }) => {
        test.setTimeout(600_000);
        const sink = captureConsoleErrors(page);

        /**
         * THE PIPELINE BY THE RULE THIS SPEC EXERCISES, not by whichever option is first.
         *
         * Only a pipeline with a losing stage declaring Voided can exercise it; on any other the
         * precondition below fails and reads as a seed gap. Picking by label would silently test the
         * wrong pipeline the day the seed reorders them, so it is resolved by the property instead.
         */
        const pipeline = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 p.Name
              FROM __mj_BizAppsSales.Pipeline p
              JOIN __mj_BizAppsSales.PipelineStage s ON s.PipelineID = p.ID
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = s.DealStatusTypeID
             WHERE p.IsActive = 1 AND s.IsActive = 1 AND t.IsLost = 1 AND s.OrderStatusOnEntry = 'Voided'
             ORDER BY p.DisplayRank`);
        expect(
            pipeline?.Name,
            'a pipeline whose losing stage declares Voided is required, or this rule cannot be exercised',
        ).toBeTruthy();

        const composed = await ComposeDeal(page, `${RUN} lost path`, pipeline!.Name);
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
         * asks for `Quoted`, and orders PERMITS that move — `TRANSITIONS.Voided` is `['Draft', 'Quoted']`
         * (D-OS4). So the order comes back, which is what step 3 derives rather than assumes. The
         * warning this spec also guards is for a refusal that genuinely happens, and is gated on one.
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
        /**
         * The Stage field is an MJ type-ahead over every stage and the pick is by the row's text, so
         * the stage must be the only active one carrying its name; the move is then confirmed by ID.
         */
        const quoting = await QueryOne<{ ID: string; Name: string }>(`
            SELECT TOP 1 s.ID, s.Name
              FROM __mj_BizAppsSales.PipelineStage s
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = s.DealStatusTypeID
             WHERE s.PipelineID = (SELECT PipelineID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}')
               AND s.IsActive = 1 AND s.OrderStatusOnEntry IS NOT NULL AND t.LocksDeal = 0
               AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineStage o
                                WHERE o.IsActive = 1 AND o.Name = s.Name AND o.ID <> s.ID)
             ORDER BY s.DisplayOrder`);
        expect(
            quoting?.Name,
            'the pipeline needs a uniquely named, non-closing stage that declares an OrderStatusOnEntry, ' +
                'or the order has nothing to refuse on the way back',
        ).toBeTruthy();
        await EditDeal(page);
        await PickLookup(page, 'PipelineStageID', String(quoting!.Name));
        await SaveDeal(page);
        const moved = await QueryOne<{ PipelineStageID: string | null }>(
            `SELECT PipelineStageID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
        );
        expect(
            String(moved?.PipelineStageID ?? '').toLowerCase(),
            'the deal must be in the quoting stage before it is lost',
        ).toBe(String(quoting!.ID).toLowerCase());

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
         * ── THE ORDER FOLLOWS ORDERS' RULES, WHICH ARE ASKED RATHER THAN ASSUMED ─────────────────
         *
         * This asserted .toBe(Voided) on the grounds that Voided is terminal in orders'
         * CanTransition table. That was true when written and is not any more: orders now publishes
         * Voided -> [Draft, Quoted] and Confirmed -> [], inverting which status is the dead end. So
         * the reopen asks the landing stage for its declared status, orders LEGALLY grants the move,
         * and this failed accusing sales of inventing a way round a rule that no longer exists.
         * Measured 2026-08-26: expected Voided, got Quoted.
         *
         * The intent still matters -- sales must not move the order anywhere orders would refuse --
         * so the expectation is DERIVED: read what the stage declares, ask orders whether that move
         * is legal from Voided, and require exactly that outcome. When orders next rewrites the
         * table this follows it instead of breaking. close-won-order.CO5 broke identically and was
         * repaired the same way; close-deal.CD24 was the first of the three.
         */
        const landing = await QueryOne<{ OrderStatusOnEntry: string | null }>(`
            SELECT s.OrderStatusOnEntry
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
             WHERE d.ID = '${dealID}'`);
        const declared = landing?.OrderStatusOnEntry ?? null;
        const legal = declared !== null && CanTransition('Voided', declared).Allowed;
        const expectedStatus = legal ? (declared as string) : 'Voided';
        expect(
            String(after!.OrderStatus),
            `the order must land where ORDERS allows: the reopened stage declares ${declared} and CanTransition from Voided says ${legal}`,
        ).toBe(expectedStatus);

        /**
         * ── 4. AND THE SCREEN SAYS SO — DN-18 ───────────────────────────────────────────────────
         *
         * A silent reopen is the bug: the deal comes back open while its order stayed behind, and
         * nothing on screen says so. `Sales.ReopenDeal` returns the order's refusal in `Issues`, and
         * the Close panel renders its message and each issue outside the reopen gate, so they survive
         * the refresh that unlocks the deal.
         *
         * GATED ON `legal`. Orders now permits `Voided -> Quoted`, so in this flow the order follows
         * and there is nothing to warn about; demanding a warning would assert a refusal that did not
         * happen. If orders ever refuses the move again the tripwire returns on its own. The
         * else-branch asserts the outcome that makes it inapplicable, so this block can never pass by
         * doing nothing.
         */
        if (!legal) {
            await expect(
                DealForm(page)
                    .locator('[data-testid="close-message"]:visible, .mjs-close-action__issue:visible')
                    .filter({ hasText: /order|Voided|could not/i })
                    .first(),
                'the reopen must SURFACE that the order could not follow — a silent success leaves a working ' +
                    'deal pointing at a voided order with nothing on screen saying so (DN-18)',
            ).toBeVisible({ timeout: 20_000 });
        } else {
            expect(
                String(after!.OrderStatus),
                'orders permits the move, so the order must actually have followed — if it did not, the reopen IS silent and the DN-18 tripwire above should have run instead',
            ).toBe(expectedStatus);
        }

        expectOnlyKnownErrors(sink, [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/], 'lost and reopen');
    });
});
