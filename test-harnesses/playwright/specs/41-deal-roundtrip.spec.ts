/**
 * THE ROUND TRIP — compose, save, REOPEN, and prove the lines and dates came back; then remove a line
 * and prove the removal survives another reopen.
 *
 * ── WHAT CHANGED (#88) ──────────────────────────────────────────────────────────────────────────
 *
 * This drove the removed deal workspace and reopened from its roster. It now drives the Deal record
 * form and reopens by record route (`ReopenRecord`). Dropped with the workspace:
 *
 *   · the instalment round trip — on the form, payment schedule rows are MJ's generic related-entity
 *     grid, so their persistence is MJ's, not a collection this app loads;
 *   · the owner round trip — `OwnerEmployeeID` is server-maintained and read-only on the form (the
 *     owner comes from the deal team), so there is no owner picker to read back;
 *   · removing an UNSAVED line — the line editor saves each line itself, so no unsaved line exists to
 *     remove. Removal of a SAVED line is what the editor offers, and that is what step 3 drives.
 *
 * ── WHY IT EXISTS BESIDE `40-deal-form.spec.ts` ─────────────────────────────────────────────────
 *
 * 40 proves the rows landed. Reopening is where the form can fail in ways nothing else sees:
 *
 *   · the lines grid never loads, so a saved deal opens showing no products and the rep re-adds them;
 *   · a date comes back as a `Date` and the `<input type="date">` renders BLANK — no error, and the
 *     next save writes the blank over a real value;
 *   · a removal takes the row off the screen but not off the order — the editor removes through
 *     `order.Lines.Remove()` and an order save; a direct delete or a splice would skip the renumbering
 *     and header recompute, or not persist at all.
 *
 * Every one of those looks like a working screen. The only way to catch them is to leave and come back.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { CloseDb, OrderLinesForDeal, QueryAll } from '../lib/db';
import { AddLines, ComposeDeal, PurgeDeal, ReopenRecord } from '../lib/deal-flow';
import { DealForm, EditDeal, Field, OpenSection, SaveDeal, SetText } from '../lib/deal-form';
import { captureConsoleErrors, expectOnlyKnownErrors, KNOWN_POST_DELETE_ERRORS, shot } from '../lib/explorer';

const RUN_TAG = `RT-${Date.now().toString(36).toUpperCase()}`;
const DEAL_NAME = `Round trip ${RUN_TAG}`;

/**
 * Cleanup by name, handed to `PurgeDeal`, which removes children first. `PurgeByPrefix` refuses any
 * prefix not starting with `PW-`, and 70, 71 and 78 fail on residue through `AssertBaseline()`.
 */
test.afterAll(async () => {
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
    await CloseDb();
});

/** The dates under test. Chosen distinct so a mix-up between fields is visible rather than plausible. */
const EXECUTION_DATE = '2026-09-15';
const EXPECTED_CLOSE = '2026-11-20';

interface LineKey {
    ProductID: string;
    Quantity: number;
}

/** The AG Grid rows of the "What's being sold" panel on the active form. */
function lineRows(page: Page): Locator {
    return DealForm(page)
        .locator('.mj-forms-panel[data-section-key="lines"]')
        .locator('.ag-center-cols-container .ag-row:visible');
}

/**
 * Opens a saved line in the restricted line editor by double-clicking its grid row.
 *
 * Local to this spec (and duplicated in 40) because `lib/deal-form.ts` has no row-level line helper
 * yet. Waits for the product select, which renders only once the editor has loaded the line.
 */
async function openLineEditor(page: Page, row: Locator): Promise<Locator> {
    await row.dblclick();
    const editor = page.locator('[data-testid="line-editor"]:visible').first();
    await expect(editor, 'double-clicking a line must open the line editor').toBeVisible({ timeout: 20_000 });
    await expect(editor.locator('[data-testid="line-product"]'), 'the editor must load the line').toBeVisible({
        timeout: 20_000,
    });
    return editor;
}

/** Closes the line editor without saving. */
async function cancelLineEditor(editor: Locator): Promise<void> {
    await editor.getByRole('button', { name: /^\s*Cancel\s*$/ }).click();
    await expect(editor, 'Cancel must close the line editor').toBeHidden({ timeout: 15_000 });
}

/**
 * The product ID the open editor has bound, lowercased.
 *
 * Read from the select's VALUE, not its label: labels are catalogue text, the ID is what the line
 * references. Angular's `[ngValue]` writes the DOM value as `"<index>: <value>"`, so the ID is the part
 * after the separator. Polled, because the binding lands after the catalogue loads, and until then the
 * value is the placeholder's `null`.
 */
async function boundProductID(editor: Locator): Promise<string> {
    const select = editor.locator('[data-testid="line-product"]');
    let id = '';
    await expect
        .poll(
            async () => {
                id = ((await select.inputValue()).split(': ').pop() ?? '').trim().toLowerCase();
                return /^[0-9a-f-]{36}$/.test(id);
            },
            { timeout: 20_000, message: 'the line editor must bind the saved line\'s product' },
        )
        .toBe(true);
    return id;
}

/**
 * Every grid row's product and quantity, read through the editor each row opens.
 *
 * Found by opening each row rather than by reading grid text: which columns the lines grid shows is
 * view configuration, and a product label is not an identity. The editor loads the saved line, so what
 * it binds is what the database returned.
 */
async function linesOnScreen(page: Page): Promise<LineKey[]> {
    const out: LineKey[] = [];
    const count = await lineRows(page).count();
    for (let i = 0; i < count; i++) {
        const editor = await openLineEditor(page, lineRows(page).nth(i));
        const productID = await boundProductID(editor);
        const quantity = Number(await editor.locator('[data-testid="line-quantity"]').inputValue());
        out.push({ ProductID: productID, Quantity: quantity });
        await cancelLineEditor(editor);
    }
    return out;
}

/** The deal's order lines from the database, keyed the same way as `linesOnScreen`. */
async function linesInDb(): Promise<LineKey[]> {
    return (await OrderLinesForDeal(DEAL_NAME)).map((l) => ({
        ProductID: String(l.ProductID).toLowerCase(),
        Quantity: Number(l.Quantity),
    }));
}

/** A date field's input, which exists only in edit mode. */
async function dateInput(page: Page, fieldName: string): Promise<Locator> {
    return (await Field(page, fieldName)).locator('.mj-forms-field--editing input[type="date"]').first();
}

test.describe('deal form — the round trip', () => {
    test('lines and dates survive save and reopen; a removed line stays removed', async ({ page }) => {
        test.setTimeout(360_000);
        const sink = captureConsoleErrors(page);

        let before: LineKey[] = [];

        // ── 1. Compose ──────────────────────────────────────────────────────
        await test.step('compose a deal with dates and two lines', async () => {
            const { OrderID } = await ComposeDeal(page, DEAL_NAME);

            await EditDeal(page);
            await SetText(page, 'ExecutionDate', EXECUTION_DATE);
            await SetText(page, 'ExpectedCloseDate', EXPECTED_CLOSE);
            await SaveDeal(page);

            // A line needs the order the first save provisioned; `AddLines` throws on an empty catalogue.
            const count = await AddLines(page, OrderID, 2);
            expect(count, 'both lines must reach the embedded order').toBe(2);

            before = await linesInDb();
            expect(
                new Set(before.map((l) => l.ProductID)).size,
                'the two lines must reference DIFFERENT products, or the removal below cannot tell them apart',
            ).toBe(2);
            await shot(page, '41-01-composed');
        });

        // ── 2. Reopen and prove everything came back ────────────────────────
        await test.step('reopening brings back both lines, each with its product and quantity', async () => {
            await ReopenRecord(page, DEAL_NAME);
            await OpenSection(page, 'lines');
            await expect(lineRows(page), 'both lines must come back — an empty grid means the lines never loaded')
                .toHaveCount(2, { timeout: 30_000 });

            const shown = await linesOnScreen(page);
            for (const line of before) {
                expect(shown, `the line for product ${line.ProductID} must read back with its quantity`)
                    .toContainEqual(line);
            }
            await shot(page, '41-02-reopened-lines');
        });

        await test.step('the header dates come back BOUND, not blank', async () => {
            /**
             * THE ASSERTION THIS SPEC WAS WRITTEN FOR. v6 hands dates back as `Date` objects; an
             * `<input type="date">` given one renders EMPTY with no error anywhere, and the next save
             * writes the blank back. Read in edit mode, because that is where the input exists and where
             * the blank would be saved. The form is left unsaved; the next step reloads it.
             */
            await EditDeal(page);
            await expect(await dateInput(page, 'ExecutionDate'), 'the execution date must round-trip exactly')
                .toHaveValue(EXECUTION_DATE);
            await expect(await dateInput(page, 'ExpectedCloseDate'), 'the expected close must round-trip exactly')
                .toHaveValue(EXPECTED_CLOSE);
            await shot(page, '41-03-reopened-dates');
        });

        // ── 3. Removal ──────────────────────────────────────────────────────
        let removed = '';
        await test.step('removing a saved line through the line editor takes it off the order', async () => {
            await ReopenRecord(page, DEAL_NAME);
            await OpenSection(page, 'lines');
            await expect(lineRows(page), 'the two saved lines are the starting point').toHaveCount(2, {
                timeout: 30_000,
            });

            // Whichever row opens, the editor names the line it holds — the removed line is identified by
            // what the editor bound, not by grid position.
            const editor = await openLineEditor(page, lineRows(page).first());
            removed = await boundProductID(editor);

            await editor.locator('[data-testid="line-remove"]').click();
            await editor.locator('[data-testid="line-remove-confirm"]').click();
            await expect(editor, 'the editor must close once the removal saves').toBeHidden({ timeout: 30_000 });

            await expect(lineRows(page), 'the grid must drop to one line').toHaveCount(1, { timeout: 30_000 });
            await shot(page, '41-04-removed');
        });

        await test.step('and the removal survives a reopen — the line is gone from the order', async () => {
            /**
             * The row count on a FRESH load is what separates "removed" from "hidden": a removal that only
             * left the screen comes back here as two lines. The database says which one is left.
             */
            const after = await linesInDb();
            expect(after.map((l) => l.ProductID), 'the removed line must be gone from the order').not.toContain(
                removed,
            );
            const kept = before.filter((l) => l.ProductID !== removed);
            expect(after, 'and exactly the other line must remain, with its quantity').toEqual(kept);

            await ReopenRecord(page, DEAL_NAME);
            await OpenSection(page, 'lines');
            await expect(lineRows(page), 'exactly one line must come back — two means the removal only hid the row')
                .toHaveCount(1, { timeout: 30_000 });
            expect(await linesOnScreen(page), 'and it must be the kept line, with its quantity').toEqual(kept);
            await shot(page, '41-05-removal-survived');
        });

        await test.step('the console stayed clean', async () => {
            expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'deal round-trip');
        });
    });
});
