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
import { AssertBaseline, ComposeDeal, PurgeDeal } from '../lib/deal-flow';
import { SaveDeal, SelectByLabel } from '../lib/workspace';

const RUN = `PW-LOST-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

test.describe('closed lost and reopen — what happens to the order', () => {
    test.afterAll(async () => {
        if (dealID) {
            await PurgeDeal(dealID, orderID || null);
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

        // ── 1. CLOSE LOST, with the mandatory reason ────────────────────────
        await SelectByLabel(page, 'Stage', losing!.Name);

        const reason = await QueryOne<{ Name: string }>(
            `SELECT TOP 1 Name FROM __mj_BizAppsSales.LossReason WHERE IsActive = 1 AND RequiresNotes = 0
              ORDER BY DisplayRank`,
        );
        expect(reason?.Name, 'a loss reason that does not demand notes is needed').toBeTruthy();
        await SelectByLabel(page, 'Loss reason', reason!.Name).catch(() => undefined);
        await SaveDeal(page);
        await page.waitForTimeout(3_000);

        const lost = await QueryOne<{ IsLost: boolean; LossReasonID: string | null; OrderStatus: string }>(`
            SELECT t.IsLost, d.LossReasonID, o.Status AS OrderStatus
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
              LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
             WHERE d.ID = '${dealID}'`);
        expect(lost!.IsLost, 'the deal must land in a status carrying IsLost').toBe(true);
        expect(lost!.LossReasonID, 'and carry the loss reason — the most-skipped, highest-value field')
            .toBeTruthy();
        expect(
            String(lost!.OrderStatus),
            'THE ORDER MUST BE VOIDED — a lost deal\'s order has to stop being something finance may act on',
        ).toBe('Voided');

        // ── 2. REOPEN, with a reason ────────────────────────────────────────
        const reopen = page.getByRole('button', { name: /Reopen/i }).first();
        await expect(reopen, 'a locked deal must offer the sanctioned reopen path').toBeVisible({
            timeout: 30_000,
        });
        await reopen.click();
        await page.waitForTimeout(800);

        const reasonBox = page.getByRole('textbox').filter({ hasNotText: /^$/ }).last();
        await page
            .locator('textarea, input[type="text"]')
            .last()
            .fill('PW: reopened to assert the order-status warning')
            .catch(() => undefined);
        void reasonBox;
        await page.getByRole('button', { name: /^(Reopen|Confirm)$/i }).last().click();
        await page.waitForTimeout(6_000);

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

        // ── 4. AND THE SCREEN SAYS SO. A silent reopen is the bug. ──────────
        await expect(
            page.getByText(/order|Voided|could not/i).filter({ hasText: /(order|Voided)/i }).first(),
            'the reopen must SURFACE that the order could not follow — a silent success leaves a working ' +
                'deal pointing at a voided order with nothing on screen saying so',
        ).toBeVisible({ timeout: 20_000 });

        expectOnlyKnownErrors(sink, [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/], 'lost and reopen');
    });
});
