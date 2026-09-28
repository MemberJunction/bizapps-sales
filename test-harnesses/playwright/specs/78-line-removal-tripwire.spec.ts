/**
 * @fileoverview Removing a line through the Deal form takes it off the order, and re-sequences the rest.
 *
 * ── THE TRIPWIRE FIRED, AND THIS IS IT BEING ANSWERED ───────────────────────────────────────────
 *
 * This spec used to assert the BROKEN behaviour of KI-20 on purpose: orders' `savePendingLines` never
 * drained the collection's pending removals, so a removed line survived, and later the whole save was
 * refused. It said it must fail the day orders fixed that, and be rewritten to three assertions.
 *
 * Orders fixed it (KI-20 closed; bc-aidp-next-golive#187), and the deal workspace that carried the
 * interim gesture-level decline is no longer mounted (#88). Removal is now offered by the Deal form's
 * restricted line editor, through `order.Lines.Remove()` + `order.Save()` — the path orders drains. So
 * these are the three assertions the header prescribed:
 *
 *     the removal took · the RIGHT row survived (identified, not indexed) · it was re-sequenced to 1
 *
 * The integration suite carries the entity-layer half at `save-deal.SD6`. This one is the browser half:
 * the button a rep clicks is what reaches the order.
 *
 * DROPPED, with the workspace: the gesture-level "already saved and cannot be removed" decline, and the
 * check that no raw `UQ_OrderLine_OrderHeader_LineNumber` text surfaced. The decline no longer exists by
 * design; the editor's own error channel (`.mjs-le__error`) is asserted empty in its place.
 */
import { expect, test, type Page } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { AddLines, AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { DealForm, OpenSection } from '../lib/deal-form';

const RUN = `PW-KI20-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

interface LineRow extends Record<string, unknown> {
    ID: string;
    LineNumber: number;
    Quantity: number;
}

async function orderLines(id: string): Promise<LineRow[]> {
    return QueryAll<LineRow>(
        `SELECT CONVERT(varchar(36), ID) AS ID, LineNumber, Quantity
           FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${id}' ORDER BY LineNumber`,
    );
}

/**
 * Opens the line editor for the first row of the lines grid (an MJ entity data grid) by double-click.
 *
 * Which line that is, is NOT assumed from the row's position: the caller reads the editor's quantity
 * back and matches it to a database row.
 */
async function openFirstLine(page: Page): Promise<void> {
    await OpenSection(page, 'lines');
    const row = DealForm(page)
        .locator('.mj-forms-panel[data-section-key="lines"] .ag-center-cols-container .ag-row')
        .first();
    await expect(row, 'the lines grid must render the deal\'s lines').toBeVisible({ timeout: 30_000 });
    await row.dblclick();
}

test.describe('removing an order line through the Deal form', () => {
    test.afterAll(async () => {
        if (dealID) {
            await PurgeDeal(dealID, orderID || null);
        }
        // And by NAME: a failure inside ComposeDeal means dealID was never returned, so the purge
        // above runs on an empty string while a real deal sits in the database.
        await PurgeByPrefix(RUN);
        const left = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN}%'`,
        );
        expect(Number(left?.N ?? -1), 'the deal this spec created must be gone').toBe(0);
        await AssertBaseline();
    });

    test('a removed line leaves the order, the right line survives, and it is re-sequenced', async ({ page }) => {
        test.setTimeout(600_000);
        const sink = captureConsoleErrors(page);

        const composed = await ComposeDeal(page, `${RUN} removal`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        const added = await AddLines(page, orderID, 2);
        expect(added, 'two lines are needed, or a removal has nothing to be taken from').toBe(2);
        const before = await orderLines(orderID);

        await openFirstLine(page);
        const editor = page.locator('[data-testid="line-editor"]:visible').first();
        await expect(editor, 'a row double-click must open the line editor').toBeVisible({ timeout: 20_000 });

        /**
         * ── FIND THE ROW, THEN ASSERT ABOUT IT ──────────────────────────────────────────────────────
         *
         * `AddLines` gives each line a different quantity (1, 2, ...), and products can repeat when the
         * catalogue is short, so the quantity is the handle that tells the two apart. The line being
         * removed is the one whose quantity the editor shows; the survivor is the other.
         */
        const quantity = editor.locator('[data-testid="line-quantity"]');
        await expect(quantity, 'the editor must show the line\'s quantity').toBeVisible({ timeout: 20_000 });
        const shown = Number(await quantity.inputValue());
        const removed = before.filter((l) => Number(l.Quantity) === shown);
        expect(removed.length, `exactly one line must carry quantity ${shown}: ${JSON.stringify(before)}`).toBe(1);
        const survivor = before.find((l) => l.ID !== removed[0].ID);
        expect(survivor, 'the other line must exist before the removal').toBeTruthy();

        await editor.locator('[data-testid="line-remove"]').click();
        await editor.locator('[data-testid="line-remove-confirm"]').click();

        /**
         * The editor closes on a saved removal and stays open, with its error, on a refused one — so a
         * timeout here reports the editor's own text rather than a bare "still visible".
         */
        const closed = await expect(editor)
            .toBeHidden({ timeout: 30_000 })
            .then(() => true)
            .catch(() => false);
        if (!closed) {
            const said = await editor.locator('.mjs-le__error').allInnerTexts().catch(() => []);
            throw new Error(
                `the removal did not save — the line editor is still open. It says: ${
                    said.map((t) => t.trim()).filter(Boolean).join(' | ') || '(no error text)'
                }`,
            );
        }

        // ── THE DATABASE ─────────────────────────────────────────────────────
        const after = await orderLines(orderID);
        expect(after.length, 'the removal must take the line off the order').toBe(1);

        const kept = after.find((l) => l.ID.toLowerCase() === survivor!.ID.toLowerCase());
        expect(kept, 'the RIGHT line must survive — the one that was not removed').toBeTruthy();
        expect(Number(kept!.LineNumber), 'and orders must re-sequence it to line 1').toBe(1);

        /**
         * Console errors are tolerated NARROWLY. Reloading a collection after a removal can log a known
         * BaseEntity.Load complaint; anything else still fails the spec.
         */
        expectOnlyKnownErrors(sink, [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/], 'line removal');
    });
});
