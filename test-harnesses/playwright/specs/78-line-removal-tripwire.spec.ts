/**
 * @fileoverview KI-20 TRIPWIRE — the delete-line button does not work, and this asserts that.
 *
 * ── READ THIS BEFORE "FIXING" THE SPEC ──────────────────────────────────────────────────────────
 *
 * Removing a line from an order is SILENTLY DROPPED. The collection accepts the removal, the save
 * returns TRUE, and the row survives. The cause is in orders' `savePendingLines`, which contributes
 * inserts and updates and never asks the collection for its pending removals — diagnosed and written up
 * as KI-20, and not fixable from this repo.
 *
 * So this spec asserts the BROKEN behaviour on purpose. **It must fail the day orders fixes this**, and
 * that failure is the signal to rewrite it into the three assertions it should have carried all along:
 *
 *     expect(after.length).toBe(1);                    // the removal took
 *     expect(after[0].ProductID).toBe(survivorID);     // and took the RIGHT row
 *     expect(Number(after[0].LineNumber)).toBe(1);     // and what remains was re-sequenced
 *
 * The integration suite carries the same tripwire at `save-deal.SD6`. This one is worth having beside it
 * because SD6 drives the entity layer directly: it proves the SALES side does its part. Only a browser
 * can show that the button a rep actually clicks does nothing — the UI reports success, the grid redraws
 * with one line, and the row is still there. A rep discovers that when the invoice arrives.
 *
 * ── WHY NOT SKIP IT ─────────────────────────────────────────────────────────────────────────────
 *
 * A skipped spec is invisible; an asserted defect is a countdown. `test.fixme` would also hide it from
 * the run's own tally, and this project has already been bitten five times by things that looked like
 * passes.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { AddLines, AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { OpenPane, SaveDeal } from '../lib/workspace';

const RUN = `PW-KI20-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

test.describe('KI-20 tripwire — removing an order line through the UI', () => {
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

    test('the row SURVIVES a delete — asserted deliberately, and must fail when orders is fixed', async ({
        page,
    }) => {
        test.setTimeout(600_000);
        const sink = captureConsoleErrors(page);

        const composed = await ComposeDeal(page, `${RUN} removal`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        const added = await AddLines(page, orderID, 2);
        expect(added, 'two lines are needed, or a removal has nothing to be dropped from').toBe(2);

        // ── The delete affordance, then a save the UI reports as successful ──
        await OpenPane(page, 'Product lines');
        const remove = page.getByRole('button', { name: /Remove|Delete/i }).first();
        await expect(remove, 'the Product lines grid must offer a per-line remove control').toBeVisible({
            timeout: 20_000,
        });
        await remove.click();
        await page.waitForTimeout(600);

        /**
         * THE UI'S OWN CLAIM, ASSERTED FIRST. The grid drops to one row and the save succeeds — that is
         * what makes the defect dangerous rather than merely broken. A rep sees exactly what success
         * looks like.
         */
        await SaveDeal(page);
        await expect(
            page.getByText(/could not|failed|error/i).first(),
            'the UI must report NO error — the whole hazard is that this looks like it worked',
        ).toHaveCount(0);

        // ── THE DATABASE, which disagrees ───────────────────────────────────
        const after = await QueryAll<{ ID: string; LineNumber: number }>(
            `SELECT ID, LineNumber FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'
              ORDER BY LineNumber`,
        );

        expect(
            after.length,
            'KI-20: BOTH rows are still there. If this now reads 1, orders has fixed savePendingLines() — ' +
                'rewrite this spec to the three assertions in the header comment and close KI-20',
        ).toBe(2);

        /**
         * Console errors are tolerated NARROWLY here, not waved through. Reloading a collection after a
         * dropped removal logs a known BaseEntity.Load complaint; anything else still fails the spec.
         */
        expectOnlyKnownErrors(sink, [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/], 'KI-20 tripwire');
    });
});
