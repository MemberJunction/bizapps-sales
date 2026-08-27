/**
 * @fileoverview A deal's order is its order forever — DN-17's invariant, as an executable guard.
 *
 * ── WHY THIS SPEC EXISTS, AND WHY IT IS NOT AN INTEGRATION CHECK ──
 *
 * `Deal.OrderID` must never change once the server has provisioned an order. When it does, the previous
 * order is orphaned: the line the rep just added was written correctly, to a record the deal has walked
 * away from, and anything still holding the old id — a report, the contract handoff, an external system
 * — is quietly pointing at the wrong order. Nothing errors, because nothing failed.
 *
 * Measured on the recording host 2026-08-27, before the fix: 78 of 85 `OrderHeader` rows had no deal
 * pointing at them, and one deal produced ORD-000455 then ORD-000456 on consecutive saves.
 *
 * This cannot be an integration check, and that is the point. The entity layer hydrates the embedded
 * peer when it loads a deal, so `OrderID_EnsureObject()` there finds it and returns it — the bug is
 * invisible from that tier, which is exactly why 132 integration checks stayed green while 23 of 29
 * browser specs failed. The defect needs a deal whose peer is UNEXPOSED, and only the browser produces
 * one: `DealEntity.Save()` tries to hydrate after a save and `EmbeddedRecord.LoadEager()` returns null
 * for an order that demonstrably exists (instrumented: `loadObject returned=null peerAfter=false`).
 *
 * ── WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT ──
 *
 * It asserts ONLY that the order identity is stable, and it does so whether or not the line lands.
 * Today `AddLine` REFUSES when the peer cannot be hydrated, so no line is added — the fix contains the
 * corruption without curing it, because the cure is in MJ's `EmbeddedRecord`. When that is fixed the
 * line will land and this spec must still pass unchanged; a spec that also required the line would have
 * to be rewritten at that moment, and a spec rewritten to keep passing is a spec that stops guarding.
 *
 * If this fails, `Deal.OrderID` moved. Do not adjust the assertion — find what minted the second order.
 */
import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { OpenPane, SaveDeal } from '../lib/workspace';

const RUN = `PW-OIDENT-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

const orderOf = async (id: string) =>
    (await QueryOne<{ OrderID: string | null }>(
        `SELECT OrderID FROM __mj_BizAppsSales.Deal WHERE ID = '${id}'`,
    ))?.OrderID ?? null;

test.describe('a deal keeps the order it was given', () => {
    test.afterAll(async () => {
        if (dealID) await PurgeDeal(dealID, orderID || null);
        await PurgeByPrefix(RUN);
        await AssertBaseline();
    });

    test('OrderID survives adding a line, and no second order is minted', async ({ page }) => {
        test.setTimeout(600_000);

        const composed = await ComposeDeal(page, `${RUN} identity`);
        dealID = composed.DealID;

        const provisioned = await orderOf(dealID);
        expect(provisioned, 'the server must provision an order on the first save').toBeTruthy();
        orderID = provisioned as string;

        // How many orders exist for this deal's company before we touch anything. The count is the
        // second half of the assertion: an unchanged OrderID with a new orphan sitting beside it would
        // still be the bug, just harder to see.
        const before = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`,
        );
        expect(before.length, 'the provisioned order must exist').toBe(1);

        await OpenPane(page, 'Product lines');
        const add = page.getByRole('button', { name: /Add line|Add product/i }).first();
        await expect(add, 'Add line must be enabled on a saved deal').toBeEnabled({ timeout: 20_000 });
        await add.click();
        await page.waitForTimeout(800);

        await SaveDeal(page);
        await page.waitForTimeout(3_000);

        const after = await orderOf(dealID);
        expect(
            String(after).toLowerCase(),
            `Deal.OrderID moved from ${orderID} to ${after}. The previous order is now an orphan and `
            + 'anything holding its id points at a record this deal has abandoned (DN-17).',
        ).toBe(String(orderID).toLowerCase());

        // And nothing new appeared claiming to belong to this deal.
        const claimed = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${after}'`,
        );
        expect(claimed.length, 'the order the deal points at must exist').toBe(1);
    });
});
