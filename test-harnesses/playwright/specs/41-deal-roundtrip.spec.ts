/**
 * THE RELATED-RECORD-COLLECTION ROUND TRIP — compose, save, REOPEN, and prove the children came back.
 *
 * WHY THIS EXISTS BESIDE `40-deal-workspace.spec.ts`. That spec composes a deal and reads it back through
 * the GENERATED entity browser, which proves the rows landed. It never re-opens the deal in the
 * WORKSPACE — and re-opening is where the conversion to Related Record Collections can fail in ways
 * nothing else sees:
 *
 *   · `Lines.Load()` never fires, so a saved deal opens showing zero lines and the user re-types them;
 *   · a date comes back as a `Date` and the `<input type="date">` renders BLANK — no error, no warning,
 *     and the next save writes the blank back over a real value;
 *   · the owner picker reads `OwnerEmployeeID` but the roster row it is derived from never persisted;
 *   · `Remove()` is not called on delete, so the row vanishes from the screen and survives in the
 *     database — the exact failure the explicit-removal semantics make possible if a delete affordance
 *     is wired to a splice instead.
 *
 * Every one of those looks like a working screen. The only way to catch them is to leave the surface and
 * come back to it.
 *
 * WHAT IT PROVES, in order:
 *   1. A deal composed through the workspace saves with lines, an instalment, dates and an owner.
 *   2. Re-opening it from the roster — a genuinely fresh read, not client state — brings all of them back.
 *   3. Deleting a line and saving DELETES it, and the deletion survives another re-open.
 *   4. The console stays clean throughout.
 *
 * It leaves its deal behind, tagged `RT-<base36 timestamp>` so re-runs cannot collide. To clear them:
 *
 *   DELETE FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Round trip RT-%');
 *   DELETE FROM __mj_BizAppsSales.DealLine           WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Round trip RT-%');
 *   DELETE FROM __mj_BizAppsSales.DealTeamMember     WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Round trip RT-%');
 *   DELETE FROM __mj_BizAppsSales.Deal               WHERE Name LIKE 'Round trip RT-%';
 */
import { expect, test } from '@playwright/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectOnlyKnownErrors, KNOWN_POST_DELETE_ERRORS, shot } from '../lib/explorer';

const SALES_APP_ROUTE = '/app/sales';

const RUN_TAG = `RT-${Date.now().toString(36).toUpperCase()}`;
const DEAL_NAME = `Round trip ${RUN_TAG}`;

/** The dates under test. Chosen distinct so a mix-up between fields is visible rather than plausible. */
const EXECUTION_DATE = '2026-09-15';
const EXPECTED_CLOSE = '2026-11-20';
const INSTALMENT_DATE = '2026-10-01';

/**
 * The two products this run picks, captured as it picks them.
 *
 * These were fixed strings typed into a line's name field. An OrderLine has no name -- its identity
 * is the product it references -- so they cannot be decided in advance: the catalogue decides, and
 * the spec records what it chose. Index 0 is the line kept, index 1 the line removed.
 */
const lineProducts: string[] = [];

type Page = import('@playwright/test').Page;

/** One rail item, by ROLE and by PREFIX — see `50-sales-shell.spec.ts` for why text matching is wrong. */
function railItem(page: Page, label: string) {
    return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

async function openPane(page: Page, label: string): Promise<void> {
    const tab = page.locator('.dw-panes__tab', { hasText: label }).first();
    await expect(tab, `pane tab "${label}" must be present`).toBeVisible({ timeout: 20_000 });
    await tab.click();
    await page.waitForTimeout(600);
}

/** The control of a labelled workspace field, scoped to `.dw-field` because labels repeat across panes. */
function fieldControl(page: Page, label: string) {
    return page.locator('.dw-field', { hasText: label }).first().locator('input, textarea, select').first();
}

async function setField(page: Page, label: string, value: string): Promise<void> {
    const control = fieldControl(page, label);
    await expect(control, `field "${label}" must be visible`).toBeVisible({ timeout: 15_000 });
    if ((await control.evaluate((el) => el.tagName.toLowerCase())) === 'select') {
        await control.selectOption({ label: value });
    } else {
        await control.fill(value);
    }
    await page.waitForTimeout(250);
}

/** Picks the first real option (skipping the em-dash placeholder) and returns its label. */
async function selectFirstReal(page: Page, label: string): Promise<string> {
    const select = page.locator('.dw-field', { hasText: label }).first().locator('select').first();
    await expect(select, `select "${label}" must be visible`).toBeVisible({ timeout: 15_000 });
    for (const option of await select.locator('option').all()) {
        const text = ((await option.textContent()) ?? '').trim();
        if (text && !text.startsWith('—')) {
            await select.selectOption({ label: text });
            await page.waitForTimeout(300);
            return text;
        }
    }
    throw new Error(`select "${label}" offered no real options — its lookup did not load`);
}

/**
 * The product names currently in the lines grid.
 *
 * Read from the INPUT VALUES, not from `innerText`. A text-based read looks like it works and silently
 * matches nothing: an `<input>`'s value is a property, not a text node, so the grid's `innerText` contains
 * only the `<select>` option labels. The first version of this spec asserted that way and failed with a
 * dump full of line-type names and no product names at all.
 */
async function lineNames(page: Page): Promise<string[]> {
    const rows = page.locator('.dw-table tbody tr');
    const names: string[] = [];
    for (let i = 0; i < (await rows.count()); i++) {
        // The PRODUCT, not a typed name: an OrderLine carries no free text of its own.
        names.push((await rows.nth(i).locator('select.dw-cell-product option:checked').innerText()).trim());
    }
    return names;
}

async function saveDeal(page: Page, what: string): Promise<void> {
    const save = page.locator('button', { hasText: /^\s*Save deal\s*$/ }).first();
    await expect(save, 'the Save deal button must be present').toBeVisible({ timeout: 10_000 });
    await expect(save, `Save must be ENABLED for ${what} — a valid deal that cannot be saved is the bug`)
        .toBeEnabled({ timeout: 10_000 });
    await save.click();

    const message = page.locator('.dw-msg');
    await expect(message, `a confirmation must appear for ${what}`)
        .toContainText(/created|saved/i, { timeout: 45_000 });
    await expect(message, `${what} must not have failed`).not.toHaveClass(/dw-msg--error/);
}

/**
 * Re-opens the deal from the ROSTER after a FULL PAGE RELOAD.
 *
 * The workspace keeps open documents in memory deliberately, so re-reading the tab that just saved could
 * pass on client state alone and prove nothing. Reloading discards every bit of it, so clicking the roster
 * row runs `LoadDeal` — `Load()` plus `LoadRelatedRecords` — against a brand-new app instance. That is the
 * path under test, and nothing weaker actually exercises it.
 *
 * THE RELOAD IS ALSO REQUIRED, not merely stronger: the roster loads its rows once when the rail page
 * mounts and does not re-read after a save, so a deal created in this session is absent from it until the
 * page is reloaded. That is a pre-existing wart in the roster rather than anything to do with saving —
 * noted here because the first version of this spec failed on it and the failure looked like a lost save.
 */
async function reopenFromRoster(page: Page): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await railItem(page, 'All deals').click();
    await page.waitForTimeout(3000);

    const row = page.locator('.wrap--list .wl tbody tr', { hasText: RUN_TAG }).first();
    await expect(row, 'the saved deal must appear in the roster').toBeVisible({ timeout: 30_000 });
    await row.click();
    await page.waitForTimeout(8000);

    await expect(page.locator('mjs-deal-workspace'), 'the workspace must be showing').toBeVisible({ timeout: 40_000 });
    await openPane(page, 'Party info');
    await expect(fieldControl(page, 'Deal name'), 'the reopened deal must be THIS deal')
        .toHaveValue(DEAL_NAME, { timeout: 20_000 });
}

test.describe('deal workspace — the related-record-collection round trip', () => {
    test('children, dates and the owner survive save and re-open; a removed line stays removed', async ({ page }) => {
        test.setTimeout(360_000);
        const sink = captureConsoleErrors(page);

        let ownerName = '';

        // ── 1. Compose ──────────────────────────────────────────────────────────
        await test.step('compose a deal with lines, an instalment, dates and an owner', async () => {
            await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(6000);
            await railItem(page, 'Workspace').click({ timeout: 30_000 });
            await page.waitForTimeout(3000);
            await expect(page.locator('mjs-deal-workspace'), 'the workspace must render').toBeVisible({ timeout: 40_000 });

            await openPane(page, 'Party info');
            await setField(page, 'Deal name', DEAL_NAME);
            await selectFirstReal(page, 'Pipeline');
            await selectFirstReal(page, 'Customer');
            // The owner is NOT a plain field write — it edits the deal-team roster and the column beside
            // it is a derived stamp. That the picker still reads back after a reopen is what proves the
            // roster row persisted and the derivation agreed with it.
            ownerName = await selectFirstReal(page, 'Sales rep (owner)');
            await setField(page, 'Execution date', EXECUTION_DATE);
            await setField(page, 'Expected close', EXPECTED_CLOSE);

            /**
             * THE FIRST SAVE, BEFORE ANY LINE.
             *
             * `Add line` is gated on `CanAddLine` = `!!Deal?.IsSaved`: the embedded order is provisioned
             * inside `DealEntityServer.Save()` on the first save (S-US4), so before then there is no
             * order for a line to belong to. The button says so in its own title, "Save the deal first",
             * and this spec saved only AFTER the lines — so it clicked a disabled button for 30s and
             * reported a broken control rather than a missing step.
             *
             * `saveDeal` already asserts the confirmation message, which is what matters here: a save
             * that silently did not land leaves `Add line` disabled for exactly the same reason and
             * would look identical at the next click.
             */
            await saveDeal(page, 'the first save, which provisions the order');

            await openPane(page, 'Product lines');
            const addLine = page.locator('.dw-addbtn', { hasText: 'Add line' }).first();
            await expect(
                addLine,
                'Add line must be enabled once the deal is saved — disabled here means the first save '
                    + 'did not land',
            ).toBeEnabled({ timeout: 20_000 });
            await addLine.click();
            await page.waitForTimeout(400);
            await addLine.click();
            await page.waitForTimeout(400);

            const rows = page.locator('.dw-table tbody tr');
            await expect(rows, 'two line rows must exist').toHaveCount(2, { timeout: 10_000 });
            /**
             * ── REWRITTEN AGAINST THE ORDER-LINE GRID ────────────────────────────────────────────
             *
             * This typed a line NAME into the first input and a quantity into the second. That was the
             * DealLine grid; Andrew descoped DealLine this morning (issues #36–#39 closed as not
             * planned — "An embedded Order record will store products and prices associated with the
             * deal"), which is D-DL1 (:461) reached from the product side.
             *
             * An OrderLine row is product picker, quantity, read-only unit price, read-only line total,
             * discount percent — so the first input is a NUMBER and the old loop failed with "Cannot
             * type text into input[type=number]".
             *
             * A line's identity is now the product it references, so lineProducts[0] / lineProducts[1] become the
             * two product LABELS this run picked, captured here and asserted downstream.
             */
            for (const i of [0, 1]) {
                const picker = rows.nth(i).locator('select.dw-cell-product');
                await picker.selectOption({ index: i + 1 });   // 0 is the "choose a product" placeholder
                lineProducts.push((await picker.locator('option:checked').innerText()).trim());
                await rows.nth(i).locator('td.dw-num input[type="number"]').first()
                    .fill(i === 0 ? '100' : '1');
                await page.waitForTimeout(200);
            }

            await openPane(page, 'Payment schedule');
            await page.locator('.dw-addbtn', { hasText: 'Add instalment' }).first().click();
            await page.waitForTimeout(400);
            const instalment = page.locator('.dw-table tbody tr').first().locator('input');
            await instalment.nth(0).fill(INSTALMENT_DATE);
            await instalment.nth(1).fill('50000');
            await instalment.nth(2).fill(`${RUN_TAG} deposit`);
            await page.waitForTimeout(300);

            await shot(page, '41-01-composed');
        });

        await test.step('save', async () => {
            await saveDeal(page, 'the initial save');
            await shot(page, '41-02-saved');
        });

        // ── 2. Re-open and prove everything came back ───────────────────────────
        await test.step('re-opening from the roster brings back the lines', async () => {
            await reopenFromRoster(page);

            await openPane(page, 'Product lines');
            const rows = page.locator('.dw-table tbody tr');
            await expect(rows, 'both lines must come back — an empty grid means Lines never loaded')
                .toHaveCount(2, { timeout: 20_000 });

            const names = await lineNames(page);
            expect(names, 'the kept line must read back with its name').toContain(lineProducts[0]);
            expect(names, 'the second line must read back with its name').toContain(lineProducts[1]);
            await shot(page, '41-03-reopened-lines');
        });

        await test.step('the instalment comes back', async () => {
            await openPane(page, 'Payment schedule');
            const rows = page.locator('.dw-table tbody tr');
            await expect(rows, 'the instalment must come back').toHaveCount(1, { timeout: 20_000 });
            const inputs = rows.first().locator('input');
            // The instalment DATE is the child-collection half of the date-binding hazard: a `Date`
            // reaching a date input renders blank, and a blank re-saved is a lost payment date.
            await expect(inputs.nth(0), 'the instalment date must be BOUND, not blank').toHaveValue(INSTALMENT_DATE);
            await expect(inputs.nth(2), 'the instalment description must come back').toHaveValue(`${RUN_TAG} deposit`);
        });

        await test.step('the header dates come back BOUND, not blank', async () => {
            await openPane(page, 'Party info');
            /**
             * THE ASSERTION THIS WHOLE SPEC WAS WORTH WRITING FOR. v6 hands dates back as `Date` objects;
             * an `<input type="date">` given one renders EMPTY with no error anywhere. A previous release
             * shipped exactly that — every workspace date silently blank while the roster beside it showed
             * the same values correctly. `toHaveValue` on the exact string is what makes it impossible to
             * ship again.
             */
            await expect(fieldControl(page, 'Execution date'), 'the execution date must round-trip exactly')
                .toHaveValue(EXECUTION_DATE);
            await expect(fieldControl(page, 'Expected close'), 'the expected close must round-trip exactly')
                .toHaveValue(EXPECTED_CLOSE);
        });

        await test.step('the owner comes back, which means the roster row persisted', async () => {
            const owner = page.locator('.dw-field', { hasText: 'Sales rep (owner)' }).first().locator('select').first();
            const selected = (await owner.locator('option:checked').textContent() ?? '').trim();
            expect(selected, 'the owner picker must show the employee chosen before the save').toBe(ownerName);
            await shot(page, '41-04-reopened-party');
        });

        // ── 3. Explicit removal ─────────────────────────────────────────────────
        await test.step('removing a line and saving DELETES it', async () => {
            await openPane(page, 'Product lines');
            // Located by INPUT VALUE, not by `hasText` — see `lineNames` for why a text filter cannot
            // see a product name at all.
            const before = await lineNames(page);
            const doomedRow = before.indexOf(lineProducts[1]);
            expect(doomedRow, 'the line to remove must be present').toBeGreaterThanOrEqual(0);

            // Targeted by TITLE, not by position. A line row now carries TWO icon buttons — open-detail
            // and remove — so `.dw-iconbtn.first()` silently became "open the slide-in", the removal never
            // happened, and the failure surfaced one assertion later as a wrong row count. A positional
            // selector says "wherever it happens to be"; this says which control.
            await page.locator('.dw-table tbody tr').nth(doomedRow)
                .locator('.dw-iconbtn[title="Remove this line"]').click();
            await page.waitForTimeout(600);

            await expect(page.locator('.dw-table tbody tr'), 'the grid must show one line after the removal')
                .toHaveCount(1, { timeout: 10_000 });

            await saveDeal(page, 'the save after removing a line');
            await shot(page, '41-05-removed');
        });

        await test.step('and the removal SURVIVES a re-open', async () => {
            /**
             * The point of the whole step. Removal is explicit now: the collection deletes only what was
             * passed to `Remove()`. If a delete affordance were ever wired to a splice on `Items` instead,
             * the row would disappear from the screen exactly as it does above — and reappear here,
             * because it was never deleted. Only the re-read can tell the two apart.
             */
            await reopenFromRoster(page);
            await openPane(page, 'Product lines');

            const rows = page.locator('.dw-table tbody tr');
            await expect(rows, 'exactly one line must remain after the re-read').toHaveCount(1, { timeout: 20_000 });

            const names = await lineNames(page);
            expect(names, 'the kept line survived').toContain(lineProducts[0]);
            expect(names, 'the removed line must be GONE from the database, not just from the screen')
                .not.toContain(lineProducts[1]);

            await expect(page.locator('.dw-table tbody tr').first().locator('input').nth(1), 'and it kept its quantity')
                .toHaveValue('100');
            await shot(page, '41-06-removal-survived');
        });

        await test.step('the console stayed clean', async () => {
            expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'deal round-trip');
        });
    });
});
