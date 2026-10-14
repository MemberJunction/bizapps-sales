/**
 * CONFIRMING AN ORDER WHOSE DEAL IS NOT WON IS REFUSED, ON SCREEN (bc-aidp-next-golive#323).
 *
 * The reported defect: a deal closed Won minted ORD-002313, the deal was reopened to Open, and
 * twenty seconds later the order was confirmed from the ORDER SCREEN and booked — a booking entry,
 * a subscription and twelve recognition entries against a deal sitting Open at 75%.
 *
 * The server side is proven elsewhere and more cheaply: `DealNotWonConfirmVeto`'s unit suite pins
 * the rule, and `prove-confirm-veto-save.mjs` drives a real `Save()` through `ValidateAsync` against
 * live rows. What ONLY a browser can show is the last link in the chain — that the refusal reaches
 * the person who clicked, in words they can act on. That chain is
 * `ValidateAsync` -> `LatestResult.CompleteMessage` -> `SaveStatus` throws -> `RunConfirm` catches
 * -> `StatusError` renders, and every hop is somebody else's code.
 *
 * The fixture is live data, not a seed: any Quoted order whose deal is not Won will do, and the
 * check skips rather than fails on a host that has none.
 */
import { expect, test } from '../lib/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { QueryAll } from '../lib/db';

const ORDER_ENTITY = 'MJ_BizApps_Orders: Order Headers';

/** The shell is ready when it has CONTENT — an empty body also lacks the loading text. */
async function waitForShell(page: import('@playwright/test').Page): Promise<string> {
    let text = '';
    for (let i = 0; i < 18; i++) {
        text = (await page.locator('body').innerText().catch(() => '')) ?? '';
        if (text.trim().length > 40 && !text.includes('Loading workspace')) return text;
        await page.waitForTimeout(10000);
    }
    return text;
}

test('an order whose deal is not Won is refused on screen, in words a rep can act on', async ({ page }) => {
    const [order] = await QueryAll<{ ID: string; OrderNumber: string; DealNumber: string }>(`
        SELECT TOP 1 o.ID, o.OrderNumber, d.DealNumber
          FROM __mj_BizAppsOrders.OrderHeader o
          JOIN __mj_BizAppsSales.Deal d ON d.OrderID = o.ID
          LEFT JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
         WHERE ISNULL(st.IsWon, 0) = 0 AND o.Status = 'Quoted'
         ORDER BY o.OrderNumber`);

    test.skip(!order, 'no Quoted order behind a not-Won deal on this host');

    await page.goto(
        `${EXPLORER_BASE_URL}/resource/record/${ORDER_ENTITY}/${encodeURIComponent(`ID|${order.ID}`)}`,
        { waitUntil: 'domcontentloaded' },
    );
    const shell = await waitForShell(page);
    expect(shell, 'the order form must render before anything is clicked').toContain(order.OrderNumber);

    const confirm = page.getByRole('button', { name: 'Confirm order', exact: false }).first();
    await expect(confirm, 'the Confirm control is offered — the refusal happens on the save, not by hiding it').toBeVisible();
    await confirm.click();

    /**
     * The refusal is rendered into the form's own status area, so this waits for the TEXT rather
     * than for a particular element: the message is the contract, the markup carrying it is not.
     */
    const refusal = page.getByText(/is not Won, so this order cannot be confirmed yet/i).first();
    await expect(refusal, 'the rep must be told why the confirm did not happen').toBeVisible({ timeout: 30000 });

    const shown = (await page.locator('body').innerText().catch(() => '')) ?? '';
    expect(shown, 'the refusal names the deal, so the rep knows which one to close').toContain(order.DealNumber);
    expect(shown, 'and says what to do about it').toMatch(/Close the deal as Won/i);

    // golive#324 is the sibling complaint — a raw database error on a close panel. Not here.
    expect(shown, 'no SQL on screen').not.toMatch(/DECLARE |SentClientRequest|Query:/);

    // And the order did NOT book: the refusal is real, not cosmetic.
    const [after] = await QueryAll<{ Status: string; ConfirmedAt: string | null }>(
        `SELECT Status, ConfirmedAt FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${order.ID}'`,
    );
    expect(after.Status, 'the order stays where it was').toBe('Quoted');
    expect(after.ConfirmedAt, 'and was never stamped confirmed').toBeNull();
});
