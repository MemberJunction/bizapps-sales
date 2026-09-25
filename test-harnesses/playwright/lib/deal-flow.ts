/**
 * @fileoverview Composing a deal through the Deal form — shared by the lifecycle and tripwire specs.
 *
 * Both need the same opening moves: a new deal with a pipeline, a customer and two catalogue lines. The
 * lifecycle spec then drives it to close-won; the tripwire spec removes a line. Keeping the composition
 * in one place means a selector change breaks one file rather than diverging silently between two.
 */
import { expect, type Page } from '@playwright/test';

import { QueryAll, QueryOne } from './db';
import {
    ByTestId,
    DealForm,
    FirstOpenStatus,
    OpenNewDeal,
    OpenSection,
    PickLookup,
    SaveDeal,
    SetStatusByID,
    SetText,
} from './deal-form';
import { EXPLORER_BASE_URL } from './env';

export interface ComposedDeal {
    Name: string;
    DealID: string;
    OrderID: string;
}

/**
 * Creates a deal through the Deal form and returns its ids from the DATABASE.
 *
 * Reads the ids back rather than scraping them off the page: the point of every spec that calls this is
 * to compare the screen against rows, and taking the id from the screen would make both sides of that
 * comparison the same source.
 */
export async function ComposeDeal(page: Page, name: string, pipeline?: string): Promise<ComposedDeal> {
    await OpenNewDeal(page);
    await SetText(page, 'Name', name);
    await PickLookup(page, 'PipelineID', pipeline);
    await PickLookup(page, 'AccountID');

    /**
     * ── THE STATUS, SET EXPLICITLY ──────────────────────────────────────────────────────────────
     *
     * `Deal.DealStatusTypeID` is NULLABLE with no column default, and a new record seeds none. A deal
     * saved without a status is dropped by every measure that reads it through `JOIN DealStatusType` —
     * which is how spec 71 once failed with `Cannot read properties of undefined (reading 'IsLost')`.
     * So the first open status is chosen by FLAG, from the database, never by name.
     */
    const open = await FirstOpenStatus();
    await SetStatusByID(page, open.ID);

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
     * This used to reopen the deal from the list before returning, to get past DN-17: a line added
     * straight after a create landed on a second, orphaned order. `DealEntity.Save()` now hydrates the
     * embedded peer from the `OrderID` the server wrote, so a freshly created deal is genuinely an edit
     * of a real record and the workaround is not just unnecessary — it would be actively harmful to
     * keep. A reload here would mask a DN-17 regression in every spec except 79.
     *
     * `79-embedded-order-refresh.spec.ts` is the guard, and `ReopenRecord` stays available because
     * reopening a deal is a path worth driving in its own right.
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
 * Adds catalogue lines through the "What's being sold" panel and returns how many the order holds after.
 *
 * Each line is composed in the restricted line editor and saved by it, onto the order's line
 * collection — the deal itself is not re-saved. The picker is the live orders catalogue, so a host whose
 * products are absent or out of window offers nothing, and adding zero lines while reporting success is
 * the vacuous pass this suite exists to catch. Hence the throw.
 */
export async function AddLines(page: Page, orderID: string, count: number): Promise<number> {
    await OpenSection(page, 'lines');

    for (let i = 0; i < count; i += 1) {
        const add = ByTestId(page, 'lines-add');
        await expect(add, 'a saved, open deal must offer Add a product').toBeVisible({ timeout: 30_000 });
        await add.click();

        const editor = page.locator('[data-testid="line-editor"]:visible').first();
        await expect(editor, 'Add a product must open the line editor').toBeVisible({ timeout: 20_000 });

        const product = editor.locator('[data-testid="line-product"]');
        await expect(product, 'the line editor must offer a product picker').toBeVisible({ timeout: 20_000 });
        const labels = (await product.locator('option').allTextContents())
            .map((o) => o.trim())
            .filter((o) => o && !o.startsWith('—'));
        if (labels.length === 0) {
            throw new Error(
                'the product picker offered nothing — the orders catalogue did not load, and adding a ' +
                    'line with no product would make this spec pass while testing nothing',
            );
        }
        await product.selectOption({ label: labels[Math.min(i, labels.length - 1)] });

        /**
         * Quantity is the rep's to state and is not seeded, so a line without it cannot save — Save
         * stays disabled with the reason beside it. Filled every time for that reason.
         */
        const quantity = editor.locator('[data-testid="line-quantity"]');
        await quantity.fill(String(i + 1));
        await quantity.blur();

        const save = editor.locator('[data-testid="line-save"]');
        await expect(save, 'the line must become saveable once product and quantity are set').toBeEnabled({
            timeout: 20_000,
        });
        await save.click();
        await expect(editor, 'the line editor must close once the line saves').toBeHidden({ timeout: 30_000 });
    }

    const rows = await QueryAll<{ ID: string }>(
        `SELECT ID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
    );
    return rows.length;
}

/**
 * ── CLOSING IS AN EXPLICIT ACT, THROUGH THE CLOSE PANEL ─────────────────────────────────────────
 *
 * A stage change is a stage change: `DealEntityServer` moves the stage and deliberately does NOT
 * change the status, because closing is `Sales.CloseDeal` even when the stage a deal enters is the one
 * a pipeline calls "Signed". The Close panel is that act, behind `data-testid`s:
 * `close-open` -> `close-panel` -> `close-target` (one radio per closing status, valued by its ID) ->
 * (`close-loss-reason`, `close-loss-notes`) -> `close-confirm`, and `reopen-open` -> `reopen-reason`
 * -> `reopen-confirm`. The target is chosen by the status's FLAGS, read from the database, so no
 * status name appears here.
 */
async function openClosePanel(page: Page): Promise<void> {
    await OpenSection(page, 'close');
    const open = ByTestId(page, 'close-open');
    await expect(open, 'an open, saved deal must offer Close this deal').toBeVisible({ timeout: 30_000 });
    await open.click();
    await expect(ByTestId(page, 'close-panel'), 'the close panel must open').toBeVisible({ timeout: 20_000 });
}

/** The first active closing status carrying the given flag, by rank. */
async function closingStatus(flag: 'IsWon' | 'IsLost'): Promise<string> {
    const row = await QueryOne<{ ID: string }>(
        `SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType
          WHERE IsActive = 1 AND ${flag} = 1 AND LocksDeal = 1 ORDER BY DisplayRank`,
    );
    expect(row?.ID, `the host needs an active locking status with ${flag} = 1`).toBeTruthy();
    return String(row!.ID);
}

/** Checks the close-target radio for a status ID, matched case-insensitively. */
async function chooseTarget(page: Page, statusID: string): Promise<void> {
    const radios = ByTestId(page, 'close-panel').locator('[data-testid="close-target"]');
    const values = await radios.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    const index = values.findIndex((v) => v.toLowerCase() === statusID.toLowerCase());
    if (index < 0) {
        throw new Error(`the close panel offers no target for status ${statusID}. It offers: ${values.join(', ') || '(none)'}`);
    }
    await radios.nth(index).check();
}

/**
 * Confirms, then waits for the outcome the panel reports.
 *
 * The confirmation and any warnings render OUTSIDE the close and reopen gates, so they survive the
 * refresh that locks the deal. An error there fails with the panel's own text.
 */
async function confirmAndSettle(page: Page, confirmTestId: string, settledTestId: string): Promise<void> {
    await ByTestId(page, confirmTestId).click();
    const settled = ByTestId(page, settledTestId);
    const error = DealForm(page).locator('[data-testid="close-message"].is-error:visible');
    await expect(settled.or(error), 'the operation must report an outcome').toBeVisible({ timeout: 60_000 });
    if (await error.isVisible().catch(() => false)) {
        throw new Error(`the operation was refused: ${(await error.innerText()).trim()}`);
    }
}

/** Closes the open deal as WON. Returns once the panel offers Reopen, i.e. the deal is locked. */
export async function CloseWon(page: Page, notes?: string): Promise<void> {
    await openClosePanel(page);
    await chooseTarget(page, await closingStatus('IsWon'));
    if (notes) {
        await ByTestId(page, 'close-notes').fill(notes);
    }
    await confirmAndSettle(page, 'close-confirm', 'reopen-open');
}

/**
 * Closes the open deal as LOST, with the mandatory reason.
 *
 * The reason is chosen by LABEL from the panel's own select, because that select is what a rep uses;
 * setting the id directly would not prove the picker offers it.
 */
export async function CloseLost(page: Page, lossReason: string, lossNotes?: string): Promise<void> {
    await openClosePanel(page);
    await chooseTarget(page, await closingStatus('IsLost'));

    const reason = ByTestId(page, 'close-loss-reason');
    await expect(reason, 'closing as lost must demand a loss reason').toBeVisible({ timeout: 20_000 });
    await reason.selectOption({ label: lossReason });

    // Rendered only when the chosen reason declares RequiresNotes — filled if present, never demanded.
    const notesBox = ByTestId(page, 'close-loss-notes');
    if (lossNotes && (await notesBox.isVisible().catch(() => false))) {
        await notesBox.fill(lossNotes);
    }

    await confirmAndSettle(page, 'close-confirm', 'reopen-open');
}

/** Reopens a closed deal through the Close panel, recording the reason `Sales.ReopenDeal` keeps. */
export async function ReopenDeal(page: Page, reason: string): Promise<void> {
    await OpenSection(page, 'close');
    const open = ByTestId(page, 'reopen-open');
    await expect(open, 'a closed deal must offer Reopen this deal').toBeVisible({ timeout: 30_000 });
    await open.click();

    const box = ByTestId(page, 'reopen-reason');
    await expect(box, 'the reopen panel must open').toBeVisible({ timeout: 20_000 });
    await box.fill(reason);
    await confirmAndSettle(page, 'reopen-confirm', 'close-open');
}

/**
 * Opens a deal's record tab afresh from the database id, so the client re-reads it.
 *
 * Goes by the record route and the database id rather than by a list row: the All-deals page is an
 * entity viewer whose rows are virtualised, and a row-text match there is a statement about scroll
 * position, not about the deal. The segment is MJ's composite-key form, `ID|<guid>`.
 */
export async function ReopenRecord(page: Page, name: string): Promise<void> {
    const row = await QueryOne<{ ID: string }>(`SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name = '${name}'`);
    expect(row?.ID, `the deal "${name}" must exist to be reopened`).toBeTruthy();
    const entity = encodeURIComponent('MJ_BizApps_Sales: Deals');
    await page.goto(`${EXPLORER_BASE_URL}/resource/record/${entity}/${encodeURIComponent(`ID|${row!.ID}`)}`, {
        waitUntil: 'domcontentloaded',
    });
    await expect(DealForm(page), `the deal "${name}" must reopen as a record form`).toBeVisible({ timeout: 60_000 });
    await expect(DealForm(page), 'the reopened form must be the deal asked for').toContainText(name, {
        timeout: 30_000,
    });
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
    //
    // ── GUARDED, BECAUSE MOST HOSTS DO NOT HAVE CONTRACTS ───────────────────────────────────────
    //
    // bizapps-contracts does not install on a fresh database (KI-13), so on every host but
    // MJ_V6_Repro this table does not exist. Unguarded, this threw
    //     RequestError: Invalid object name '__mj_BizAppsContracts.Contract'
    // out of TEARDOWN, which Playwright reports against whichever spec was finishing -- so six
    // specs that had done nothing wrong failed with an error naming a table none of them touch.
    // Measured 2026-08-26: it accounted for 6 of 10 failures in a full run.
    //
    // The integration suite already refuses to pretend here ("bizapps-contracts is NOT installed
    // on this host, so these checks cannot prove anything"). This is the same honesty in the
    // teardown path: skip the cleanup that cannot apply, and leave the assertions to say so.
    await QueryAll(`
        IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
            DELETE FROM __mj_BizAppsContracts.Contract WHERE CreatingRecordID = '${dealID}'`);

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
