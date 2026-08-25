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
 *     expect(after.length).toBe(1);                                  // the removal took
 *     const survivor = after.find((r) => r.ProductID === survivorID);
 *     expect(survivor, 'the RIGHT row survived').toBeTruthy();        // identify, do not index
 *     expect(Number(survivor.LineNumber)).toBe(1);                    // and it was re-sequenced
 *
 * The `find` is deliberate. This list used to read `after[0].ProductID` — index a collection, then
 * assert which row it is. That shape has been found and fixed twice already (WT1, AC13); pasting it
 * back the day orders fixes KI-20 would reintroduce it. Identify the row first.
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
         * CAPTURED HERE, BEFORE THE SAVE, AND THAT ORDERING IS THE REPAIR.
         *
         * The decline is held in the component as a Set keyed on the LINE OBJECT. A save reloads the
         * deal, the line objects are new instances, nothing in the Set matches a current row any more,
         * and the issue stops rendering. So reading it after `SaveDeal` -- which is where this spec read
         * it -- can only ever see an empty list, whatever the guard did.
         *
         * That is not a bug in the guard: once the save has happened there is nothing outstanding to
         * warn about. It does mean the gesture-level decline is only observable between the click and
         * the save, which is exactly where a rep sees it too.
         */
        const declined = (await page.locator('.dw-issues li:visible, .dw-field-error:visible')
            .allTextContents())
            .map((t) => t.replace(/\s+/g, ' ').trim());

        /**
         * THE UI'S OWN CLAIM, ASSERTED FIRST. The grid drops to one row and the save succeeds — that is
         * what makes the defect dangerous rather than merely broken. A rep sees exactly what success
         * looks like.
         */
        await SaveDeal(page);
        /**
         * ASSERTED ON THE TEXT, NOT ON A COUNT.
         *
         * `.first()` plus `toHaveCount(0)` is a contradiction dressed as an assertion — `.first()` is a
         * one-element locator, so the count is 0 or 1 and the failure says "Expected 0, Received 1"
         * without ever telling you WHAT matched. On a loose regex over the whole page that is close to
         * useless: it took a rerun to learn the match was the workspace's own visible text rather than an
         * error at all. Collecting the strings makes the failure name itself.
         *
         * Scoped to the workspace's message and validation channels for the same reason — the regex was
         * matching page furniture, and the claim is about what the SURFACE reports after the save.
         */
        const reported = (await page.locator('.dw-msg:visible, .dw-issues li:visible, .dw-field-error:visible')
            .allTextContents())
            .map((t) => t.replace(/\s+/g, ' ').trim())
            // WIDENED to include 'cannot'. The interim's decline reads "This line is already saved and
            // cannot be removed yet" -- no 'could not', no 'failed', no 'error' -- so the old filter
            // dropped the very message this spec now exists to see, and `reported` came back empty.
            .filter((t) => /could not|cannot|failed|error|refused|declined/i.test(t));

        /**
         * ── KI-20'S SYMPTOM HAS CHANGED: IT IS NO LONGER SILENT ─────────────────────────────────────
         *
         * This asserted `toEqual([])` — "the UI must report NO error", because KI-20's whole hazard was
         * that a dropped removal LOOKED like success. That assertion was passing for the wrong reason: it
         * searched `.dw-issue` and `.msg`, neither of which exists (the real classes are `.dw-issues li`
         * and `.dw-msg`), so it matched nothing and could never fail. Fixing the selector is what revealed
         * the change.
         *
         * What actually happens now, measured:
         *
         *     Save failed for OrderID_Object: Failed to save order line 1: Violation of UNIQUE KEY
         *     constraint 'UQ_OrderLine_OrderHeader_LineNumber'. The duplicate key value is (…, 1).
         *
         * Orders renumbers the SURVIVING line from 2 to 1 while the removed row still holds 1, so the
         * update collides with the row it is supposed to be replacing. The removal is no longer dropped
         * quietly — the whole save is refused.
         *
         * That is a DIFFERENT defect from the one KI-20 records, and arguably a better one: loud beats
         * silent. But it means a rep cannot remove a line at all, and it is still orders' to fix.
         * Asserted as it is, so that this spec goes red the day the behaviour changes in either direction.
         */
        /**
         * ── THE TRIPWIRE FIRED, AND THIS IS IT BEING ANSWERED ───────────────────────────────────
         *
         * It asserted a `UQ_OrderLine_OrderHeader_LineNumber` violation and said, correctly, that if
         * that stopped being true the behaviour had changed and KI-20 needed re-reading. It has
         * changed: the KI-20 interim declines a saved line's removal AT THE GESTURE, so the database
         * is never reached and there is no constraint name to see. `reported` came back empty.
         *
         * The underlying limit is unchanged -- a saved line still cannot be removed -- so the tripwire
         * is still worth having. What moved is WHERE it is refused, and the difference is the whole
         * point of the interim: a rep now reads a sentence about the line instead of a constraint name.
         *
         * Asserted on the gesture-level decline, and still in both directions: this goes red if the
         * decline disappears (removal silently allowed) AND if a raw constraint name ever reappears,
         * which would mean the gesture-level guard had been bypassed.
         */
        expect(
            declined.some((m) => /already saved and cannot be removed/i.test(m)),
            'a saved line must have its removal declined at the GESTURE, with a sentence a rep can read '
                + `— KI-20's interim moved this off the database. Saw: ${JSON.stringify(declined).slice(0, 300)}`,
        ).toBe(true);

        expect(
            reported.some((m) => /UQ_OrderLine_OrderHeader_LineNumber/i.test(m)),
            'and NO raw constraint name should surface any more — one here means the gesture-level '
                + 'decline was bypassed and the save reached the database after all',
        ).toBe(false);

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
