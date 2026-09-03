/**
 * @fileoverview #32 — the term start on a subscription line, as the browser renders and binds it.
 *
 * ── WHAT THIS PROVES, AND WHAT IT DELIBERATELY LEAVES TO THE CHECKS ─────────────────────────────────
 *
 * RENDERING and BINDING, and nothing else. `term-start.TS1–TS6` prove the rules and the round trip
 * through the database; they cannot see a screen. What only a browser can show is that the column
 * exists, that the control is bound to the ORDER DATE rather than to a value written onto the line,
 * that a one-time line renders nothing at all in that column, and that the reset action puts the field
 * back. Those are the four ways this feature can be wired up wrongly while every check stays green.
 *
 * PERSISTENCE IS NOT ASSERTED HERE, on purpose. `TS6` already saves a term start through a deal, reloads
 * it, clears it and re-reads it — at the tier where that claim is stable. Repeating it here would mean
 * re-entering a saved deal in the shell, and on this branch that is not dependable: closing the deal's
 * workspace tab and reopening it from the roster produced "Deal <id> could not be loaded" against a deal
 * that was demonstrably in the database. That is worth fixing, and it is not #32 — a spec that carried
 * it would report this feature as broken every time the shell misbehaved.
 *
 * ── THE FIXTURE REQUIREMENT, STATED OUT LOUD ────────────────────────────────────────────────────────
 *
 * This needs ONE subscription product and ONE that is not, both sellable to the deal's company. The
 * seeded catalogue has NO subscription products at all (9 products, 0 with a `SubscriptionTypeID`,
 * measured 2026-08-27), so the spec SKIPS with a message naming what is missing rather than failing. A
 * red spec would say the feature is broken when the truth is the host has nothing to exercise it with.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { OpenPane } from '../lib/workspace';

const RUN = `PW-TERMSTART-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

interface Product extends Record<string, unknown> { ID: string; Name: string; SubscriptionTypeID: string | null }

/** The date a rep types. Deliberately not today's, so an inherited default cannot pass as a stored one. */
const CHOSEN = '2026-09-01';

/** The `yyyy-MM-dd` a date input holds, or null when the cell renders no input at all. */
/**
 * Whether the cell renders a term-start control at all.
 *
 * Separate from its VALUE, because requirement 3 is "no field", not "an empty field" — and
 * `dateValue` alone could not tell those apart: it returned null both when the input was absent and
 * when it was present but blank. Moving the `@if` from around the control to merely blanking it would
 * have broken requirement 3 while this spec stayed green.
 */
async function hasDateControl(cell: Locator): Promise<boolean> {
    return (await cell.locator('input[type="date"]').count()) > 0;
}

/** The control's value. Throws if there is no control — ask `hasDateControl` first. */
async function dateValue(cell: Locator): Promise<string | null> {
    const input = cell.locator('input[type="date"]');
    if ((await input.count()) === 0) {
        throw new Error('no term-start control in this cell — use hasDateControl to assert its absence');
    }
    return (await input.inputValue()) || null;
}

/** The 0-based index of a column, found by its header so a reorder cannot silently move the assertions. */
async function columnIndex(page: Page, header: string): Promise<number> {
    const headers = await page.locator('.dw-table thead th').allTextContents();
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === header.toLowerCase());
    expect(idx, `the lines grid must have a "${header}" column — headers were ${JSON.stringify(headers)}`)
        .toBeGreaterThanOrEqual(0);
    return idx;
}

function rowCell(page: Page, row: number, col: number): Locator {
    return page.locator('.dw-table tbody tr').nth(row).locator('td').nth(col);
}

/**
 * The "order date" hint, located by its ELEMENT rather than by its text.
 *
 * `getByText('order date')` also matches the reset button's screen-reader label, "Reset term start to
 * the order date" — so the assertion that the hint DISAPPEARS once a value is stored was matching the
 * control that only appears at that moment, and failed against correct behaviour.
 */
function inheritedHint(page: Page, row: number, col: number): Locator {
    return rowCell(page, row, col).locator('small.dw-field__hint');
}

/**
 * Adds one line and points it at a NAMED product.
 *
 * The picker labels an option `Name (SKU)` when the product has a SKU and `Name` when it does not, so
 * the option is found by CONTAINMENT and then selected by its exact label. Matching on the name alone
 * would silently select nothing on a host whose products carry SKUs.
 */
async function addLineFor(page: Page, productName: string, quantity: number): Promise<void> {
    const add = page.getByRole('button', { name: /Add line|Add product/i }).first();
    await expect(add, 'Add line must be enabled on a saved deal').toBeEnabled({ timeout: 20_000 });
    await add.click();
    await page.waitForTimeout(600);

    const row = page.locator('.dw-table tbody tr').last();
    const picker = row.locator('select').first();
    const labels = (await picker.locator('option').allTextContents()).map((o) => o.trim());
    const match = labels.find((o) => o.includes(productName));
    expect(match, `the picker must offer "${productName}" — it offered ${JSON.stringify(labels)}`).toBeTruthy();
    await picker.selectOption({ label: match as string });
    await page.waitForTimeout(400);

    // Quantity is the FIRST numeric input in the row; unit price and line total are read-only cells.
    const qty = row.locator('input[type="number"]').first();
    await qty.fill(String(quantity));
    await qty.blur();
    await page.waitForTimeout(400);
}

test.describe('a subscription line states its term start', () => {
    test.afterAll(async () => {
        if (dealID) await PurgeDeal(dealID, orderID || null);
        await PurgeByPrefix(RUN);
        await AssertBaseline();
    });

    test('the term start defaults to the order date, is settable, and resets', async ({ page }) => {
        test.setTimeout(600_000);

        const dealName = `${RUN} term`;
        const composed = await ComposeDeal(page, dealName);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        const order = await QueryOne<{ OrderDate: string; CompanyID: string }>(
            `SELECT CONVERT(varchar(10), OrderDate, 23) AS OrderDate, CompanyID
               FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`,
        );
        expect(order, 'the deal must have a server-provisioned order').toBeTruthy();
        const orderDate = String(order!.OrderDate);

        // Both products must be sellable to THIS order's company, or the picker will not offer them.
        const products = await QueryAll<Product>(
            `SELECT ID, Name, SubscriptionTypeID FROM __mj_BizAppsOrders.Product
              WHERE Status = 'Active' AND CompanyID = '${order!.CompanyID}'
                AND (AvailableFrom IS NULL OR AvailableFrom <= GETUTCDATE())
                AND (AvailableTo   IS NULL OR AvailableTo   >= GETUTCDATE())`,
        );
        const subscription = products.find((p) => !!p.SubscriptionTypeID);
        const oneTime = products.find((p) => !p.SubscriptionTypeID);

        test.skip(
            !subscription || !oneTime,
            'this host has no subscription product in its catalogue, so there is nothing that offers a '
            + 'term start. Point one Product at a SubscriptionType and re-run — see term-start.checks.ts.',
        );

        await OpenPane(page, 'Product lines');
        await addLineFor(page, String(subscription!.Name), 1);
        await addLineFor(page, String(oneTime!.Name), 2);
        await expect(page.locator('.dw-table tbody tr')).toHaveCount(2, { timeout: 30_000 });

        const col = await columnIndex(page, 'Term start');

        /**
         * ROW 1 — THE SUBSCRIPTION LINE. The control shows the ORDER DATE while the column is still null.
         * This is the assertion separating a displayed default from a written one: nothing was stored, so
         * a value here can only have come from the order.
         */
        expect(
            await dateValue(rowCell(page, 0, col)),
            `the subscription line must display the order date (${orderDate}) as its default`,
        ).toBe(orderDate);

        await expect(
            inheritedHint(page, 0, col),
            'an inherited default must SAY it is inherited — a rep cannot tell otherwise',
        ).toBeVisible();

        await expect(
            rowCell(page, 0, col).locator('button[title="Reset to the order date"]'),
            'nothing is stored yet, so there is nothing to reset',
        ).toHaveCount(0);

        /** ROW 2 — THE ONE-TIME LINE. Requirement 3: no field at all, not a disabled or empty one. */
        expect(
            await hasDateControl(rowCell(page, 1, col)),
            'a non-subscription line must not offer a term start — NO control, which is what requirement 3 '
                + 'says. An empty control would satisfy a value assertion while breaking the requirement.',
        ).toBe(false);

        // ── Typing a term start switches the field from inherited to stored. ──
        await rowCell(page, 0, col).locator('input[type="date"]').fill(CHOSEN);
        await rowCell(page, 0, col).locator('input[type="date"]').blur();
        await page.waitForTimeout(600);

        expect(
            await dateValue(rowCell(page, 0, col)),
            'the field must hold what the rep typed',
        ).toBe(CHOSEN);

        await expect(
            inheritedHint(page, 0, col),
            'once a term start is stored the field no longer follows the order date, and must stop saying so',
        ).toHaveCount(0);

        // ── And reset puts it back, which is the whole of "reset to order date". ──
        const reset = rowCell(page, 0, col).locator('button[title="Reset to the order date"]');
        await expect(reset, 'a stored term start must offer a reset').toBeVisible();
        await reset.click();
        await page.waitForTimeout(600);

        expect(
            await dateValue(rowCell(page, 0, col)),
            'resetting must return the field to the order date',
        ).toBe(orderDate);

        await expect(
            inheritedHint(page, 0, col),
            'and it must read as inherited again',
        ).toBeVisible();
    });
});
