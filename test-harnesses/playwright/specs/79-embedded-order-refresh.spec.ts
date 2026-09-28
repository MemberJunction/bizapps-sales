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
 * ── THE DEFECT IT GUARDS ────────────────────────────────────────────────────────────────────────
 *
 * A freshly created deal is not reloaded: the same instance carries the server's IDs, so the tab
 * becomes an EDIT of a real record. When order provisioning moved INTO `DealEntityServer.Save()`, the
 * `OrderID` came back on that instance but its COMPANION did not: `EmbeddedRecord` gates `Value` on a
 * private `exposed` flag that only `Ensure()`, `LoadEager()` and a wire `Deserialize()` set, and a
 * header-only create reaches none of them. So `OrderID` pointed at a real order while `OrderID_Object`
 * was null, and `OrderID_EnsureObject()` minted a second one.
 *
 * The rep then adds a line to that second order:
 *
 *   1. **The line is invisible on the deal.** `Deal.OrderID` still points at the empty provisioned
 *      order, so the form, the pricing bridge and every rollup read zero lines.
 *   2. **`Deal.Amount` can never be right**, because it is refreshed from the order the deal points at.
 *   3. **An orphan `OrderHeader` is left in orders**, referenced by nothing, which the harness's own
 *      teardown cannot find.
 *
 * ── WHY NO API-LEVEL CHECK COULD SEE IT ─────────────────────────────────────────────────────────
 *
 * `save-deal.SD24` and the rest drive the entity graph IN PROCESS, where the server's `Save()` sets
 * `this.OrderID` on the very instance the check then reads. The defect exists only where the entity
 * crosses the wire — which is to say, only in a browser.
 *
 * ── ON THE DEAL FORM NOW (#88) ──────────────────────────────────────────────────────────────────
 *
 * This added its line through the deal workspace, which nothing mounts any more. The line is now added
 * through the Deal form's line editor by `AddLines`, straight after `ComposeDeal` and with no reload in
 * between — the path this spec is about. The editor saves the line onto the deal's
 * `OrderID_Object.Lines`, so a missing companion is exactly what it would expose.
 *
 * @module test-harnesses/playwright
 */
import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { AddLines, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';

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
         * `ComposeDeal` composes, saves, and does NOT reload — which is the path this spec is about. A
         * reload here would make this spec pass without proving anything.
         */
        const composed = await ComposeDeal(page, `${RUN} control`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        // Before the fix this same line landed on a second order and this count read 0. `AddLines`
        // counts the lines on the order the DEAL points at, read from the database.
        const onDeal = await AddLines(page, orderID, 1);
        expect(
            onDeal,
            'the line must be written to the order the DEAL points at — anywhere else and the rep cannot ' +
                'see what they just added',
        ).toBe(1);

        /**
         * AND NO SECOND ORDER. Under the defect the count goes up by two, one provisioned by the server
         * and one minted by the client, and only the first is referenced.
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

        expectNoConsoleErrors(sink, 'refreshing the embedded order after a line change');
    });
});
