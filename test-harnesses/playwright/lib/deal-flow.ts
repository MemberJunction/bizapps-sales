/**
 * @fileoverview Composing a deal through the workspace — shared by the lifecycle and tripwire specs.
 *
 * Both need the same opening moves: a new deal with a pipeline, a customer and two catalogue lines. The
 * lifecycle spec then drives it to close-won; the tripwire spec removes a line. Keeping the composition
 * in one place means a selector change breaks one file rather than diverging silently between two.
 */
import { expect, type Page } from '@playwright/test';

import { QueryAll, QueryOne } from './db';
import {
    OpenPane,
    OpenWorkspace,
    SaveDeal,
    SelectByLabel,
    SelectFirstReal,
    SetField,
} from './workspace';

export interface ComposedDeal {
    Name: string;
    DealID: string;
    OrderID: string;
}

/**
 * Creates a deal through the workspace and returns its ids from the DATABASE.
 *
 * Reads the ids back rather than scraping them off the page: the point of every spec that calls this is
 * to compare the screen against rows, and taking the id from the screen would make both sides of that
 * comparison the same source.
 */
export async function ComposeDeal(page: Page, name: string, pipeline?: string): Promise<ComposedDeal> {
    await OpenWorkspace(page);
    await SetField(page, 'Deal name', name);

    if (pipeline) {
        await SelectByLabel(page, 'Pipeline', pipeline);
    } else {
        await SelectFirstReal(page, 'Pipeline');
    }
    await SelectFirstReal(page, 'Customer');
    await SaveDeal(page);

    const row = await (async () => {
        for (let i = 0; i < 30; i += 1) {
            const found = await QueryOne<{ ID: string; OrderID: string | null }>(
                `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name = '${name}'`,
            );
            if (found) return found;
            await page.waitForTimeout(1_000);
        }
        return undefined;
    })();

    expect(row, `the deal "${name}" must exist in the database after saving`).toBeTruthy();
    expect(
        row!.OrderID,
        'and it must carry an embedded order — provisioning happens inside DealEntityServer.Save, so a ' +
            'null here means the write path never ran',
    ).toBeTruthy();

    return { Name: name, DealID: row!.ID, OrderID: String(row!.OrderID) };
}

/**
 * Adds catalogue lines on the Product lines pane and returns how many the order holds afterwards.
 *
 * The picker is the live orders catalogue across the app boundary, so a host whose products are absent
 * or out of window offers nothing — and adding zero lines while reporting success is precisely the
 * vacuous pass this suite exists to catch. Hence the throw.
 */
export async function AddLines(page: Page, orderID: string, count: number): Promise<number> {
    await OpenPane(page, 'Product lines');

    for (let i = 0; i < count; i += 1) {
        const add = page.getByRole('button', { name: /Add line|Add product/i }).first();
        await expect(add, 'the Product lines pane must offer an add control').toBeVisible({ timeout: 20_000 });
        await add.click();
        await page.waitForTimeout(400);

        // The newest row's product picker. Scoped to the grid so it cannot match a header select.
        const pickers = page.locator('.dw-lines select, table select');
        const last = pickers.nth((await pickers.count()) - 1);
        const options = await last.locator('option').allTextContents();
        const real = options.map((o) => o.trim()).filter((o) => o && !o.startsWith('—'));
        if (real.length === 0) {
            throw new Error(
                'the product picker offered nothing — the orders catalogue did not load, and adding a ' +
                    'line with no product would make this spec pass while testing nothing',
            );
        }
        await last.selectOption({ label: real[Math.min(i, real.length - 1)] });
        await page.waitForTimeout(400);
    }

    await SaveDeal(page);

    const rows = await QueryAll<{ ID: string }>(
        `SELECT ID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
    );
    return rows.length;
}

/** Every row this suite created for one deal, removed child-first. Returns what it deleted. */
export async function PurgeDeal(dealID: string, orderID: string | null): Promise<void> {
    for (const t of ['DealStageEvent', 'DealTeamMember', 'DealPaymentSchedule', 'DealContactRole']) {
        await QueryAll(`DELETE FROM __mj_BizAppsSales.${t} WHERE DealID = '${dealID}'`);
    }
    // Tasks and their links point at the ORDER or the DEAL polymorphically; both are cleared by id.
    await QueryAll(`
        DELETE tl FROM __mj_BizAppsTasks.TaskLink tl
         WHERE tl.RecordID IN ('${dealID}', '${orderID ?? dealID}')`);
    await QueryAll(`
        DELETE ta FROM __mj_BizAppsTasks.TaskAssignment ta
          JOIN __mj_BizAppsTasks.Task t ON t.ID = ta.TaskID
         WHERE t.Name LIKE '%${dealID}%'`);
    await QueryAll(`DELETE FROM __mj_BizAppsTasks.Task WHERE Name LIKE '%${dealID}%'`);

    // The contract the close created, found by its provenance pair rather than by name.
    await QueryAll(`DELETE FROM __mj_BizAppsContracts.Contract WHERE CreatingRecordID = '${dealID}'`);

    await QueryAll(`UPDATE __mj_BizAppsSales.Deal SET OrderID = NULL WHERE ID = '${dealID}'`);
    await QueryAll(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`);

    if (orderID) {
        for (const c of [
            'OrderLinePriceComponent',
            'OrderLineDimension',
            'OrderAdjustmentAllocation',
            'OrderChargeAllocation',
        ]) {
            await QueryAll(`
                DELETE c FROM __mj_BizAppsOrders.${c} c
                  JOIN __mj_BizAppsOrders.OrderLine l ON l.ID = c.OrderLineID
                 WHERE l.OrderHeaderID = '${orderID}'`);
        }
        await QueryAll(`DELETE FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`);
        await QueryAll(`DELETE FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`);
    }
}

/** The demo baseline this host must be at when the suite finishes. */
export async function AssertBaseline(): Promise<void> {
    const b = await QueryOne<{ Deals: number; OpenAmount: number; Priced: number }>(`
        SELECT COUNT(*) AS Deals,
               SUM(CASE WHEN t.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS OpenAmount,
               SUM(CASE WHEN d.AmountIsComputed = 1 THEN 1 ELSE 0 END)         AS Priced
          FROM __mj_BizAppsSales.Deal d
          JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID`);
    expect(Number(b?.Deals), 'the host must be back to its seven seeded deals').toBe(7);
    expect(Number(b?.OpenAmount), 'and to an open pipeline of 251,220').toBe(251220);
    expect(Number(b?.Priced), 'and five of seven priced').toBe(5);
}
