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

    /**
     * ── WAITS FOR THE ORDER, NOT JUST FOR THE ROW ───────────────────────────────────────────────
     *
     * This returned on the first row it saw. The deal row and its embedded order are written by the
     * same `DealEntityServer.Save()`, but this poll reads them from OUTSIDE that transaction, so there
     * is a window where the deal is visible and `OrderID` is still null. The helper took that row, and
     * the assertion written to catch exactly this was unreachable below — two defects stacked so that
     * the second hid the first.
     *
     * Restoring the assertion alone would have made it fire on the RACE rather than on a real failure,
     * which is a worse outcome than the silence: an intermittent red that blames provisioning.
     *
     * So the loop waits for both, and the two outcomes are distinguished. `sawRow` is kept precisely so
     * a deal that exists without ever acquiring an order reports THAT, rather than "the deal must exist
     * in the database" — which would be false, confusing, and point at the wrong half.
     */
    let sawRow = false;
    const row = await (async () => {
        for (let i = 0; i < 30; i += 1) {
            const found = await QueryOne<{ ID: string; OrderID: string | null }>(
                `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name = '${name}'`,
            );
            if (found) sawRow = true;
            if (found?.OrderID) return found;
            await page.waitForTimeout(1_000);
        }
        return undefined;
    })();

    expect(
        sawRow,
        `the deal "${name}" must exist in the database after saving — no row appeared in 30s, so the ` +
            'save itself never landed',
    ).toBe(true);
    expect(
        row,
        `the deal "${name}" was written but never acquired an embedded order in 30s. Provisioning ` +
            'happens inside DealEntityServer.Save(), so a null OrderID here means that half did not run ' +
            '— this is NOT a timing artefact, the poll waited for it.',
    ).toBeTruthy();

    /**
     * ── NO RELOAD HERE ANY MORE. DN-17 IS FIXED AT THE ENTITY ───────────────────────────────────
     *
     * This used to reopen the deal from the roster before returning, to get past DN-17: a line added
     * straight after a create landed on a second, orphaned order. `DealEntity.Save()` now hydrates the
     * embedded peer from the `OrderID` the server wrote, so a freshly created deal is genuinely an edit
     * of a real record and the workaround is not just unnecessary — it would be actively harmful to
     * keep. A reload here would mask a DN-17 regression in every spec except 79.
     *
     * `79-embedded-order-refresh.spec.ts` is the guard, and `ReopenFromRoster` stays available because
     * reopening from the roster is a path worth driving in its own right.
     */
    /**
     * ── THIS ASSERTION WAS UNREACHABLE, AND THAT IS WHY CAUSE 2 LOOKED LIKE STALE SPECS ──────────
     *
     * A `return` sat directly above it, so the check never ran. When `OrderID` came back null the
     * helper returned `String(null)` -- the literal string "null" -- as a perfectly ordinary-looking
     * order id. Every caller then passed "null" onward: `AddLines` queried an order that cannot exist,
     * added nothing, and reported 0, which surfaces in a spec as "two lines are needed" or as a click
     * timeout on a picker that was never populated.
     *
     * So the failures blamed the wrong thing twice over. The dead assertion existed precisely to say
     * "the write path never ran", and because it was dead the diagnosis became "the spec forgot to
     * save" -- which was wrong, since `ComposeDeal` does fill every field and does save.
     *
     * The lesson is narrow and worth keeping: an assertion after an unconditional return is not a weak
     * assertion, it is an absent one, and it fails in the reassuring direction.
     *
     * ── AND THE RESTORED ASSERTION HAS SINCE BEEN REMOVED AGAIN, DELIBERATELY ────────────────────
     *
     * The guarantee moved UP into the poll, which now waits for `OrderID` rather than for any row. Once
     * it does that, a check here for a truthy `OrderID` cannot fail — and a permanently-true assertion
     * is the exact thing this suite spends its time eliminating. It would also read as coverage it does
     * not provide.
     *
     * The claim it made is still made, twice, and by checks that CAN fail: `sawRow` distinguishes "no
     * row at all" from "a row with no order", and the second names provisioning explicitly.
     */

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
    /**
     * ── TASKS RESOLVED BY ID FROM THEIR LINKS, NOT BY NAME OR BY LINK TARGET ────────────────────
     *
     * Two things were wrong here, and the second one broke a spec that was otherwise passing.
     *
     *   1. `Task WHERE Name LIKE '%dealID%'` was FRAGILE, not broken — and my first note here said it
     *      was broken, which was wrong. The tasks are named "Review order for deal <id>", so the LIKE did
     *      match. What made it look otherwise: a seeded task reading "Review order for deal 93111111…",
     *      where `93111111-0000-4000-…` is the START OF A GUID and not a deal number at all. Matching a
     *      name on a substring is still the wrong handle for a delete — it depends on a message format
     *      nothing pins — which is why this now resolves tasks by id anyway.
     *   2. Links were cleared for the DEAL and the ORDER only. The contract task links the CONTRACT
     *      now — that was the point of the `ContractID` fix in `07dc10e` — so that link survived, and
     *      deleting its task failed on `FK_TaskLink_Task`. `70-lifecycle` reached the end of its
     *      assertions and then died in teardown, leaving the deal behind and reporting 8 deals against
     *      a baseline of 7. The fix to the product broke the cleanup, which is a fair trade but has to
     *      be followed through.
     *
     * So the tasks are found the way they are actually reachable — through their links, whatever those
     * links point at — and then everything keyed on those task ids goes in FK order. One batch, because
     * the id set has to survive across the three deletes.
     */
    await QueryAll(`
        DECLARE @tasks TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
        INSERT INTO @tasks (ID)
          SELECT DISTINCT tl.TaskID
            FROM __mj_BizAppsTasks.TaskLink tl
           WHERE tl.RecordID IN (
                     '${dealID}',
                     '${orderID ?? dealID}',
                     ISNULL((SELECT CAST(ContractID AS NVARCHAR(50))
                               FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'), '${dealID}')
                 );
        -- EVERY child of Task, not just the two that had bitten. 70-lifecycle died here a second
        -- time on FK_TaskActivity_Task: the close writes a TaskActivity row per task, and this list
        -- knew about TaskLink and TaskAssignment only. Enumerated in full rather than extended by one
        -- again -- the same list cleanup.mjs carries, for the same reason.
        DELETE td FROM __mj_BizAppsTasks.TaskDecision td JOIN @tasks t ON td.TaskID = t.ID;
        DELETE tac FROM __mj_BizAppsTasks.TaskActivity tac JOIN @tasks t ON tac.TaskID = t.ID;
        DELETE tc FROM __mj_BizAppsTasks.TaskComment tc JOIN @tasks t ON tc.TaskID = t.ID;
        DELETE tn FROM __mj_BizAppsTasks.TaskNotificationLog tn JOIN @tasks t ON tn.TaskID = t.ID;
        DELETE tg FROM __mj_BizAppsTasks.TaskTagLink tg JOIN @tasks t ON tg.TaskID = t.ID;
        DELETE dp FROM __mj_BizAppsTasks.TaskDependency dp JOIN @tasks t ON dp.TaskID = t.ID;
        DELETE dp FROM __mj_BizAppsTasks.TaskDependency dp JOIN @tasks t ON dp.DependsOnTaskID = t.ID;
        DELETE tl FROM __mj_BizAppsTasks.TaskLink tl JOIN @tasks t ON tl.TaskID = t.ID;
        DELETE ta FROM __mj_BizAppsTasks.TaskAssignment ta JOIN @tasks t ON ta.TaskID = t.ID;
        -- Task.ParentID is a self-reference: break it before the rows go.
        UPDATE tk SET ParentID = NULL FROM __mj_BizAppsTasks.Task tk JOIN @tasks t ON tk.ID = t.ID
         WHERE tk.ParentID IS NOT NULL;
        DELETE tk FROM __mj_BizAppsTasks.Task tk JOIN @tasks t ON tk.ID = t.ID;`);

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
