/**
 * @fileoverview A rep's FIRST line, added straight after creating the deal, must land on the deal's own
 * order — and must not mint a second one.
 *
 * ── THIS SPEC IS GREEN, AND IT IS WHAT KEEPS DN-17 FIXED ────────────────────────────────────────
 *
 * It was written to fail: it asserted the correct behaviour against a defect that was present, on the
 * same pattern as `78-line-removal-tripwire.spec.ts`. `DealEntity.Save()` now hydrates the embedded peer
 * and it passes. Proven able to fail by reverting that one guard to `if (false && …)`, rebuilding, and
 * re-running — it reports `Expected: 1, Received: 0` on the line assertion, the original symptom exactly.
 *
 * ── THE DEFECT IT GUARDS, MEASURED ──────────────────────────────────────────────────────────────
 *
 * `DealWorkspaceComponent.Save()` deliberately does not reload after a create. Its comment says:
 *
 *     "The same instance now carries the server's IDs, so this tab becomes an EDIT of a real record —
 *      no reload, and no rebuilt copy that could drift from what is on screen."
 *
 * That was true when the client minted the order. It stopped being true when provisioning moved INTO
 * `DealEntityServer.Save()` — but NOT in the way it first appeared. Measured through Angular's dev hooks:
 * after a create `deal.OrderID` DOES match the row on disk. The field comes back; the COMPANION does not.
 * `EmbeddedRecord` gates `Value` on a private `exposed` flag that only `Ensure()`, `LoadEager()` and a
 * wire `Deserialize()` set, and a header-only create reaches none of them — the companion payload travels
 * only on `MJ.SaveEntityGraph`, which `Save()` uses only when `plan.NodeCount > 1`. So `OrderID` pointed
 * at a real order while `OrderID_Object` was null, and `OrderID_EnsureObject()` minted a second one.
 *
 * The rep then adds a line to that second order. The consequences, in order of how bad they are:
 *
 *   1. **The line is invisible on the deal.** `Deal.OrderID` still points at the empty provisioned
 *      order, so the workspace, the pricing bridge and every rollup read zero lines.
 *   2. **`Deal.Amount` can never be right**, because it is refreshed from the order the deal points at.
 *   3. **An orphan `OrderHeader` is left in orders**, referenced by nothing, holding real priced lines.
 *      Four probe runs left four orphans, and the harness's own teardown CANNOT find them — it deletes
 *      orders reachable from a PW-VERIFY deal, and these are reachable from nothing.
 *
 * ── WHY NO API-LEVEL CHECK COULD SEE IT ─────────────────────────────────────────────────────────
 *
 * `save-deal.SD24` and the rest drive the entity graph IN PROCESS, where the server's `Save()` sets
 * `this.OrderID` on the very instance the check then reads. There is no serialization boundary, so the
 * value is always there. The defect exists only where the entity crosses the wire — which is to say,
 * only in a browser. 108 green integration checks and this was underneath all of them.
 *
 * @module test-harnesses/playwright
 */
import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { OpenPane, RealOptionLabels, SaveDeal } from '../lib/workspace';

const RUN = `PW-VERIFY embedded order ${Date.now()}`;

test.describe('the embedded order after create — one order, and the line lands on it', () => {
    let dealID = '';
    let orderID = '';

    test.afterEach(async () => {
        await PurgeDeal(dealID, orderID);
        // And by NAME, because a failure inside ComposeDeal means dealID was never returned
        // — the deal is real and the id-based purge above is purging an empty string.
        await PurgeByPrefix(RUN.split(' ')[0]);
    });

    test('a line added right after create belongs to the deal, and no second order appears', async ({ page }) => {
        test.setTimeout(420_000);
        const sink = captureConsoleErrors(page);

        const ordersBefore = await QueryOne<{ N: number }>(
            'SELECT COUNT(*) AS N FROM __mj_BizAppsOrders.OrderHeader',
        );

        /**
         * `ComposeDeal` composes, saves, and does NOT reload — which is the path this spec is about. It
         * briefly had a reload in it as a workaround for this very defect; that is gone now the entity
         * fixes it, because a reload here would have made this spec pass without proving anything.
         */
        const composed = await ComposeDeal(page, `${RUN} control`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        // Before the fix this same line landed on a second order and this assertion read 0. Proven by
        // reverting only the guard in `DealEntity.Save()` and re-running: it fails with exactly that.
        await OpenPane(page, 'Product lines');
        const add = page.getByRole('button', { name: /Add line|Add product/i }).first();
        await expect(add, 'the Product lines pane must offer an add control').toBeVisible({ timeout: 20_000 });
        await add.click();
        await page.waitForTimeout(600);

        const picker = page.locator('.dw-lines select, table select').last();
        const products = await RealOptionLabels(picker);
        expect(products.length, 'the orders catalogue must offer a product, or this proves nothing')
            .toBeGreaterThan(0);
        await picker.selectOption({ label: products[0] });

        const qty = page.locator('.dw-lines tbody tr, table tbody tr').last()
            .locator('input[type="number"]').first();
        await qty.fill('2');
        await qty.blur();
        await SaveDeal(page);
        await page.waitForTimeout(3_000);

        const onDeal = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
        );
        expect(
            onDeal.length,
            'the line must be written to the order the DEAL points at — anywhere else and the rep cannot ' +
                'see what they just added',
        ).toBe(1);

        /**
         * AND NO SECOND ORDER. This is the assertion that fails today: the count goes up by two, one
         * provisioned by the server and one minted by the client, and only the first is referenced.
         */
        const ordersAfter = await QueryOne<{ N: number }>(
            'SELECT COUNT(*) AS N FROM __mj_BizAppsOrders.OrderHeader',
        );
        expect(
            Number(ordersAfter!.N) - Number(ordersBefore!.N),
            'exactly ONE order per deal. Two means the client minted its own beside the provisioned one, ' +
                'and the extra is an orphan no teardown can find',
        ).toBe(1);

        const orphans = await QueryAll<{ ID: string; OrderNumber: string }>(`
            SELECT oh.ID, oh.OrderNumber
              FROM __mj_BizAppsOrders.OrderHeader oh
             WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d WHERE d.OrderID = oh.ID)
               AND oh.__mj_CreatedAt > DATEADD(minute, -15, GETUTCDATE())`);
        expect(
            orphans.map((o) => o.OrderNumber),
            'no order created by this spec may be left unreferenced',
        ).toEqual([]);

        expectNoConsoleErrors(sink, 'embedded order refresh');
    });
});
