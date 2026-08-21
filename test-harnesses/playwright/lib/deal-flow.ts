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
/**
 * Composes and saves a deal WITHOUT reopening it afterwards.
 *
 * Exported for one caller only: `79-embedded-order-refresh.spec.ts`, whose entire subject is what
 * happens on the unreloaded instance. Everything else wants {@link ComposeDeal}, which reopens — see the
 * note at the end of this function for why that reopen exists.
 */
export async function ComposeDealWithoutReload(
    page: Page,
    name: string,
    pipeline?: string,
): Promise<ComposedDeal> {
    await OpenWorkspace(page);
    await SetField(page, 'Deal name', name);

    if (pipeline) {
        await SelectByLabel(page, 'Pipeline', pipeline);
    } else {
        await SelectFirstReal(page, 'Pipeline');
    }
    await SelectFirstReal(page, 'Customer');

    /**
     * ── THE STATUS, WHICH THIS HELPER USED TO LEAVE NULL ────────────────────────────────────────
     *
     * `DealWorkspaceService.NewDeal()` is `NewRecord()` and nothing else — no status is seeded — and
     * `Deal.DealStatusTypeID` is NULLABLE with no column default. So a deal saved without touching the
     * Status select lands with a NULL status, and every measure that reads the status through
     * `JOIN DealStatusType` silently does not count it. That is how spec 71 came to fail with
     * `Cannot read properties of undefined (reading 'IsLost')`: the row existed, the JOIN dropped it,
     * and the non-null assertion blamed the field instead of the join.
     *
     * Worth stating plainly because it is a REAL GAP and not only a harness omission: nothing in the
     * write path requires a status. Recorded as a finding rather than fixed here — defaulting to the
     * first open status is a product decision, not a test fixture's call.
     */
    const openStatus = await QueryOne<{ Name: string }>(
        `SELECT TOP 1 Name FROM __mj_BizAppsSales.DealStatusType
          WHERE IsActive = 1 AND IsOpen = 1 ORDER BY DisplayRank`,
    );
    expect(openStatus?.Name, 'the host needs an active OPEN status for a deal to start in').toBeTruthy();
    await SelectByLabel(page, 'Status', String(openStatus!.Name));

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

    /**
     * ── REOPENED FROM THE SERVER BEFORE ANYTHING ELSE TOUCHES IT — SEE SPEC 79 ───────────────────
     *
     * A WORKAROUND FOR A CONFIRMED DEFECT, not a tidy-up, and it is here rather than hidden in each
     * spec so there is one place to delete when the defect is fixed.
     *
     * After a successful create the workspace deliberately keeps the SAME entity instance and does not
     * reload — its comment says "the same instance now carries the server's IDs". That was true until
     * `OrderID` started being written by the SERVER inside `DealEntityServer.Save()`. The client's
     * in-memory `OrderID` stays empty, so the next `OrderID_EnsureObject()` finds no peer and MINTS A
     * SECOND ORDER: the rep's first line is written to an order no deal references, while
     * `Deal.OrderID` still points at the empty provisioned one.
     *
     * Measured, not inferred. Adding a line straight after create produced zero rows on `Deal.OrderID`
     * and an orphan `OrderHeader` holding the line — four orphans across four probe runs. Inserting a
     * reload at exactly this point made the same line persist, priced by orders at 229. That pair of
     * runs is the diagnosis.
     *
     * `79-embedded-order-refresh.spec.ts` asserts the correct behaviour and FAILS today. It is the
     * tripwire; this line is what lets the other specs get past the defect to test what they are for.
     */
    return { Name: name, DealID: row!.ID, OrderID: String(row!.OrderID) };
}

/**
 * The composer every spec but 79 should use: compose, save, and REOPEN from the roster.
 */
export async function ComposeDeal(page: Page, name: string, pipeline?: string): Promise<ComposedDeal> {
    const composed = await ComposeDealWithoutReload(page, name, pipeline);
    await ReopenFromRoster(page, name);
    return composed;
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

        /**
         * ── AND THE QUANTITY, WHICH THIS HELPER USED TO OMIT ────────────────────────────────────────
         *
         * `AddLine()` seeds `CompanyID` (orders stamps it in a SERVER class the browser does not have)
         * but deliberately does NOT seed `Quantity` -- stating how many is the rep's job. So a freshly
         * added line is invalid until somebody types a number, `CanSave` stays false, and Save sits
         * disabled with `title="Quantity cannot be null"`.
         *
         * The first version of this helper picked a product and clicked Save. It timed out for 30
         * seconds against a disabled button and the failure named `save.click()`, not the empty field --
         * which is a fair description of the harness's mistake and a poor one of the cause. The tooltip
         * was carrying the answer the whole time.
         *
         * Quantity is the FIRST numeric input in the row: unit price and line total are read-only cells
         * (sales states intent, orders states price), and discount is the second input.
         */
        const row = page.locator('.dw-lines tbody tr, table tbody tr').last();
        const quantity = row.locator('input[type="number"]').first();
        await expect(quantity, 'the new line row must offer a quantity input').toBeVisible({ timeout: 10_000 });
        await quantity.fill(String(i + 1));
        await quantity.blur();
        await page.waitForTimeout(400);
    }

    await SaveDeal(page);

    const rows = await QueryAll<{ ID: string }>(
        `SELECT ID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
    );
    return rows.length;
}

/**
 * ── CLOSING IS AN EXPLICIT ACT, AND THE PANEL HAS TESTIDS FOR IT ────────────────────────────────
 *
 * The first version of specs 70 and 71 closed a deal by selecting a winning or losing STAGE and
 * pressing Save. That cannot work, and the reason is a rule this app exists to uphold: a stage change
 * is a stage change. `DealEntityServer` moves the stage, applies the stage's forecast defaults and
 * stamps the order status — and deliberately does NOT change the deal's status, because closing is
 * `Sales.CloseDeal` and stays an explicit act even when the stage a deal enters is the one a pipeline
 * calls "Signed". The specs were asserting a rule the app is designed not to have.
 *
 * The workspace exposes the real flow behind `data-testid` attributes, which is what these use:
 * `close-open` -> `close-panel` -> `close-won` / `close-lost` -> (`close-loss-reason`,
 * `close-loss-notes`) -> `close-confirm`, and `reopen-open` -> `reopen-reason` -> `reopen-confirm`.
 * Selecting by testid rather than by button text also keeps the vocabulary rule honest: these controls
 * are found by their role in the flow, never by a status NAME.
 */
async function openClosePanel(page: Page): Promise<void> {
    const open = page.locator('[data-testid="close-open"]:visible').first();
    await expect(open, 'the workspace must offer an explicit close action').toBeVisible({ timeout: 30_000 });
    await open.click();
    await expect(
        page.locator('[data-testid="close-panel"]:visible').first(),
        'the close panel must open',
    ).toBeVisible({ timeout: 20_000 });
}

/** Closes the open deal as WON. Returns once the operation has had time to settle. */
export async function CloseWon(page: Page, notes?: string): Promise<void> {
    await openClosePanel(page);
    await page.locator('[data-testid="close-won"]:visible').first().click();
    if (notes) {
        await page.locator('[data-testid="close-notes"]:visible').first().fill(notes);
    }
    await page.locator('[data-testid="close-confirm"]:visible').first().click();
    await page.waitForTimeout(8_000);
}

/**
 * Closes the open deal as LOST, with the mandatory reason.
 *
 * The reason is chosen by LABEL from the panel's own select rather than by id, because that select is
 * what a rep uses; a spec that set the id directly would not prove the picker offers it.
 */
export async function CloseLost(page: Page, lossReason: string, lossNotes?: string): Promise<void> {
    await openClosePanel(page);
    await page.locator('[data-testid="close-lost"]:visible').first().click();

    const reason = page.locator('[data-testid="close-loss-reason"]:visible').first();
    await expect(reason, 'closing as lost must demand a loss reason').toBeVisible({ timeout: 20_000 });
    await reason.selectOption({ label: lossReason });

    // Only rendered when the chosen reason declares RequiresNotes -- so it is filled if present and
    // not demanded if absent. Asserting its presence unconditionally would pin the wrong rule.
    const notesBox = page.locator('[data-testid="close-loss-notes"]:visible').first();
    if (lossNotes && (await notesBox.isVisible().catch(() => false))) {
        await notesBox.fill(lossNotes);
    }

    await page.locator('[data-testid="close-confirm"]:visible').first().click();
    await page.waitForTimeout(8_000);
}

/** Reopens a closed deal with the reason `Sales.ReopenDeal` requires. */
export async function ReopenDeal(page: Page, reason: string): Promise<void> {
    const open = page.locator('[data-testid="reopen-open"]:visible').first();
    await expect(open, 'a closed deal must offer a reopen action').toBeVisible({ timeout: 30_000 });
    await open.click();

    const box = page.locator('[data-testid="reopen-reason"]:visible').first();
    await expect(box, 'the reopen panel must demand a reason').toBeVisible({ timeout: 20_000 });
    await box.fill(reason);
    await page.locator('[data-testid="reopen-confirm"]:visible').first().click();
    await page.waitForTimeout(8_000);
}

/**
 * Closes the workspace tab and reopens the deal from the All-deals roster, so the client re-reads it.
 *
 * Goes through the ROSTER rather than a URL, because that is the path a rep takes and it exercises the
 * roster row -> workspace handoff at the same time.
 */
export async function ReopenFromRoster(page: Page, name: string): Promise<void> {
    await page.locator('.mj-left-nav, nav').getByText('All deals', { exact: false }).first().click();
    await page.waitForTimeout(2_500);

    /**
     * REFRESHED FIRST, and this is not belt-and-braces.
     *
     * `SalesSectionComponent` loads `Deals` once and every page is rendered behind `[hidden]` rather
     * than `@if` — so switching to "All deals" swaps CSS, it does not re-query. A deal created after
     * that load is genuinely absent from the table, and the first version of this helper failed with
     * "the roster must list ..." on a deal that was sitting in the database. The header's refresh
     * control is the same one a rep would reach for.
     */
    await page.getByRole('button', { name: 'Refresh this page' }).first().click();
    await page.waitForTimeout(3_000);

    const row = page.locator('.wrap--list table.wl tbody tr').filter({ hasText: name }).first();
    await expect(row, `the roster must list "${name}" so it can be reopened`).toBeVisible({ timeout: 30_000 });
    await row.click();
    await page.waitForTimeout(5_000);
}

/**
 * Removes every deal whose name starts with the given prefix, and the orders they point at.
 *
 * ── WHY A NAME-BASED SWEEP EXISTS ALONGSIDE THE ID-BASED ONE ────────────────────────────────────
 *
 * `PurgeDeal` needs an id, and a spec only learns the id when `ComposeDeal` RETURNS. A spec that fails
 * anywhere inside the compose — which is most of a first run — leaves a real deal behind while its
 * `afterEach` purges the empty string. Three specs then failed their own "the deal must be gone" check
 * for a deal they never got the id of, which reads as a teardown bug and is really a sequencing one.
 *
 * Keyed on the loud PW- prefix, so it cannot reach a real deal.
 */
export async function PurgeByPrefix(prefix: string): Promise<void> {
    if (!prefix.startsWith('PW-')) {
        throw new Error(`refusing to purge by the prefix "${prefix}" — it must start with PW-`);
    }
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${prefix}%'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
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
