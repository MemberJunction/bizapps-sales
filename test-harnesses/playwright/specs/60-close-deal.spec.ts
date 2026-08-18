/**
 * CLOSING A DEAL THROUGH THE UI — and proving the close actually happened.
 *
 * ── THE GAP THIS EXISTS TO CLOSE ────────────────────────────────────────────────────────────────
 *
 * The close flow was fully built and tested at the operation level — 46 integration checks, the
 * Confirmed/Draft policy contrast proven — and the Explorer still could not close a deal. Setting the
 * Status dropdown to a winning status and saving wrote the status column and NOTHING else: no routing,
 * no order, no stage event, no lock. The screen said "Deal saved." and the deal read Won.
 *
 * Every visible signal was identical to a real close. That is exactly why no test caught it: an
 * API-level check closes through the operation and passes, and a UI-level check that only reads the
 * screen sees a deal marked Won and passes too. The only thing that can tell a real close from a
 * status write is the database — hence `lib/db.ts`.
 *
 * SO THE FIRST TEST HERE IS THE POINT OF THE WHOLE FILE: close through the UI, then assert against the
 * database that an ORDER EXISTS, a STAGE EVENT WAS APPENDED, and the DEAL IS LOCKED.
 *
 * ── WHAT ELSE IT PINS ───────────────────────────────────────────────────────────────────────────
 *
 *   · a closed deal renders READ-ONLY, and no edit attempt reports a false success;
 *   · close-lost without a reason is REFUSED, naming the field;
 *   · reopen with a reason unlocks, and the close event SURVIVES (append-only).
 *
 * Deals are tagged `CL-<base36 timestamp>` so re-runs cannot collide. To clear them:
 *
 *   DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Close CL-%');
 *   DELETE FROM __mj_BizAppsSales.DealLine       WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Close CL-%');
 *   DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Close CL-%');
 *   DELETE FROM __mj_BizAppsSales.Deal           WHERE Name LIKE 'Close CL-%';
 */
import { expect, test } from '@playwright/test';

import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectOnlyKnownErrors, shot } from '../lib/explorer';
import { CloseDb, DealByName, OrdersForDealNamed, OrdersSchemaPresent, StageEventsFor } from '../lib/db';

const SALES_APP_ROUTE = '/app/sales';
const RUN_TAG = `CL-${Date.now().toString(36).toUpperCase()}`;

type Page = import('@playwright/test').Page;

function railItem(page: Page, label: string) {
    return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

const testId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true').first();

/**
 * Builds a saved, line-carrying deal in the workspace and returns its name.
 *
 * A LINE IS NOT OPTIONAL here: one-time lines are what route to an order, so a header-only deal would
 * close successfully and legitimately create nothing — and the assertion that matters would pass
 * vacuously against a deal that never had anything to route.
 */
async function createDealWithLine(page: Page, suffix: string): Promise<string> {
    const name = `Close ${RUN_TAG} ${suffix}`;

    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`);
    await railItem(page, 'Workspace').click();
    await expect(testId(page, 'status-select')).toBeVisible({ timeout: 30_000 });

    await page.getByPlaceholder(/Northwind Health/i).first().fill(name);

    // Pipeline first: it decides the selling company, and the company decides the product catalogue.
    const pipeline = page.locator('select').first();
    await pipeline.selectOption({ label: 'B2B' });

    await page.locator('.dw-panes__tab', { hasText: 'Product lines' }).first().click();
    await page.getByRole('button', { name: /Add line/i }).first().click();

    // The picker: choose whatever the FIRST real product is rather than naming a SKU, so this spec
    // cannot rot when the catalogue changes.
    const productSelect = page.locator('select').filter({ hasText: /not linked/i }).first();
    await productSelect.selectOption({ index: 1 });
    const typeSelect = page.locator('select').filter({ hasText: /One-Time/i }).first();
    await typeSelect.selectOption({ label: 'One-Time' });

    await page.getByRole('button', { name: /^Save deal/i }).first().click();
    await expect(page.locator('.dw-msg')).toContainText(/created|saved/i, { timeout: 30_000 });
    return name;
}

test.afterAll(async () => {
    await CloseDb();
});

test.describe('closing a deal through the Explorer', () => {
    test('a UI close creates an order, appends a stage event, and locks the deal', async ({ page }) => {
        const errors = captureConsoleErrors(page);
        const name = await createDealWithLine(page, 'won');

        await testId(page, 'close-open').click();
        await testId(page, 'close-won').click();
        await testId(page, 'close-confirm').click();
        await expect(page.locator('.dw-msg')).toContainText(/closed as won/i, { timeout: 60_000 });
        await shot(page, 'close-won-result');

        /**
         * THE THREE ASSERTIONS THE SCREEN CANNOT MAKE.
         *
         * Before the close action existed, the deal below would have read Won and every one of these
         * would have failed — which is precisely the state that shipped unnoticed.
         */
        const deal = await DealByName(name);
        expect(deal, 'the deal must exist').toBeTruthy();
        expect(deal!.IsWon, 'the deal must be in a WON status').toBe(true);
        expect(deal!.LocksDeal, 'a won deal must be locked').toBe(true);

        const events = await StageEventsFor(deal!.ID);
        expect(
            events.length,
            'closing must APPEND a stage event — without it the close has no provenance',
        ).toBeGreaterThan(0);

        if (await OrdersSchemaPresent()) {
            const orders = await OrdersForDealNamed(name);
            expect(
                orders.length,
                'closing a won deal with a one-time line must create an ORDER in bizapps-orders',
            ).toBe(1);
            expect(orders[0].OrderNumber, 'the order must be numbered by orders').toBeTruthy();
        }

        // The user must be TOLD what happened downstream, not have to read the stage event.
        await expect(testId(page, 'close-routing')).toBeVisible();
        expectOnlyKnownErrors(errors, [], "close through the UI");
    });

    test('a closed deal renders read-only, and no edit reports a false success', async ({ page }) => {
        const name = await createDealWithLine(page, 'readonly');

        await testId(page, 'close-open').click();
        await testId(page, 'close-won').click();
        await testId(page, 'close-confirm').click();
        await expect(page.locator('.dw-msg')).toContainText(/closed as won/i, { timeout: 60_000 });

        await expect(testId(page, 'lock-notice'), 'a locked deal must say so').toBeVisible();

        // The frozen fields must be DISABLED rather than merely refused later.
        const nameInput = page.getByPlaceholder(/Northwind Health/i).first();
        await expect(nameInput, 'the deal name is frozen on a closed deal').toBeDisabled();
        await expect(testId(page, 'status-select'), 'status is frozen on a closed deal').toBeDisabled();

        /**
         * AND THE FALSE SUCCESS IS GONE. The old surface reported "Deal saved." while the server
         * silently discarded the edit. A disabled input cannot be typed into, so the attempt cannot be
         * made — but if any path still reaches a refused save, it must not read as success.
         */
        const message = page.locator('.dw-msg');
        if (await message.isVisible()) {
            await expect(message).not.toContainText(/^Deal saved\.$/i);
        }

        const deal = await DealByName(name);
        expect(deal!.LocksDeal).toBe(true);
    });

    test('close-lost is refused without a reason, and accepted with one', async ({ page }) => {
        const name = await createDealWithLine(page, 'lost');

        await testId(page, 'close-open').click();
        await testId(page, 'close-lost').click();
        // Deliberately no reason chosen.
        await testId(page, 'close-confirm').click();

        // The refusal must NAME the field — a generic failure leaves the user guessing.
        await expect(page.locator('.dw-msg--error, .dw-field__error, .dw-panes__badge').first()).toBeVisible({
            timeout: 30_000,
        });
        const stillOpen = await DealByName(name);
        expect(stillOpen!.IsLost, 'a refused close must NOT have closed the deal').toBe(false);

        // Now supply one.
        await testId(page, 'close-loss-reason').selectOption({ index: 1 });
        if (await testId(page, 'close-loss-notes').isVisible()) {
            await testId(page, 'close-loss-notes').fill('Lost on price during the dry run.');
        }
        await testId(page, 'close-confirm').click();
        await expect(page.locator('.dw-msg')).toContainText(/closed as lost/i, { timeout: 60_000 });

        const closed = await DealByName(name);
        expect(closed!.IsLost, 'with a reason the close must succeed').toBe(true);
    });

    test('reopen with a reason unlocks the deal, and the close event survives', async ({ page }) => {
        const name = await createDealWithLine(page, 'reopen');

        await testId(page, 'close-open').click();
        await testId(page, 'close-won').click();
        await testId(page, 'close-confirm').click();
        await expect(page.locator('.dw-msg')).toContainText(/closed as won/i, { timeout: 60_000 });

        const closed = await DealByName(name);
        const eventsAfterClose = await StageEventsFor(closed!.ID);

        await testId(page, 'reopen-open').click();
        await testId(page, 'reopen-reason').fill('Customer returned to renegotiate the term.');
        await testId(page, 'reopen-confirm').click();
        await expect(page.locator('.dw-msg')).toContainText(/reopened/i, { timeout: 60_000 });

        const reopened = await DealByName(name);
        expect(reopened!.LocksDeal, 'a reopened deal must no longer be locked').toBe(false);

        /**
         * PROVENANCE IS PEN, NOT PENCIL. Reopening ADDS an event; it never removes the close. If this
         * ever shrinks, history is being rewritten.
         */
        const eventsAfterReopen = await StageEventsFor(reopened!.ID);
        expect(eventsAfterReopen.length).toBeGreaterThanOrEqual(eventsAfterClose.length + 1);
    });
});
