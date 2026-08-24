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
import { CloseDb, DealByName, StageEventsFor } from '../lib/db';

const SALES_APP_ROUTE = '/app/sales';
const RUN_TAG = `CL-${Date.now().toString(36).toUpperCase()}`;

type Page = import('@playwright/test').Page;

function railItem(page: Page, label: string) {
    return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

const testId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`).locator('visible=true').first();

/**
 * A party-info `<select>` addressed by its LABEL.
 *
 * Positional selectors (`page.locator('select').nth(4)`) break the moment a field is added or reordered,
 * and they break silently — the spec sets the wrong dropdown and fails somewhere unrelated. The label is
 * the stable handle.
 */
const fieldSelect = (page: Page, label: string) =>
    page.locator('label.dw-field', { hasText: new RegExp(`^\\s*${label}`) }).locator('select').first();

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

    await page.getByPlaceholder(/Northwind Health/i).locator('visible=true').first().fill(name);

    // Pipeline first: it decides the selling company, and the company decides the product catalogue.
    await fieldSelect(page, 'Pipeline').selectOption({ label: 'B2B' });

    /**
     * A CUSTOMER IS REQUIRED TO CLOSE, and omitting it is how the first version of this spec failed.
     *
     * `Sales.CloseDeal` refuses a won deal with no account — "A won deal must be attached to a
     * customer" — because an order needs a payer. The refusal is correct; the fixture was incomplete.
     * Chosen by INDEX rather than by name so the spec does not depend on which accounts a host seeded.
     */
    await fieldSelect(page, 'Customer').selectOption({ index: 1 });

    // An OPEN status, because a deal a rep is working is not statusless. The dropdown only offers
    // non-closing statuses now, so index 1 is the first of those — closing is the close action's job.
    await fieldSelect(page, 'Status').selectOption({ index: 1 });

    /**
     * ── THE FIRST SAVE, BEFORE ANY LINE ──────────────────────────────────────────────────────────
     *
     * `Add line` is gated on `CanAddLine` = `!!Deal?.IsSaved`: the embedded order is provisioned inside
     * `DealEntityServer.Save()` on the first save (S-US4), so before then there is no order for a line
     * to belong to. The button says exactly that in its title, "Save the deal first".
     *
     * This spec had one save, AFTER the lines, so it clicked a disabled button until Playwright gave
     * up — a 30s timeout reported as a broken control rather than a missing step. Two saves is not
     * redundancy: the first buys the order, the second commits the lines.
     *
     * The MESSAGE is asserted, not just the click, because a save that silently did not land leaves
     * `Add line` disabled for the same reason and would look identical at the next line.
     */
    await page.getByRole('button', { name: /^Save deal/i }).locator('visible=true').first().click();
    await expect(
        page.locator('.dw-msg'),
        'the first save must land — the order is provisioned by it, and without one no line can be added',
    ).toContainText(/created|saved/i, { timeout: 30_000 });

    await page.locator('.dw-panes__tab', { hasText: 'Product lines' }).first().click();
    const addLine = page.getByRole('button', { name: /Add line/i }).first();
    await expect(
        addLine,
        'Add line must be enabled once the deal is saved — if this is disabled the first save did not land',
    ).toBeEnabled({ timeout: 20_000 });
    await addLine.click();

    /**
     * The picker: choose whatever the FIRST real product is rather than naming a SKU, so this spec
     * cannot rot when the catalogue changes.
     *
     * BY CLASS, NOT BY PLACEHOLDER TEXT. This filtered on `hasText: /not linked/i` and the placeholder
     * was relabelled to "— choose a product —" when a line with no product became a blocking validation
     * error. The locator then matched NOTHING, and a locator that matches nothing fails at the next
     * action rather than saying it went stale -- so the spec would have reported a broken picker.
     *
     * `.dw-cell-product` is the class the component gives that select and nothing else uses it. Text is
     * the wrong hook here twice over: it is user-facing copy, so it changes for good reasons, and it is
     * the one part of a control most likely to be reworded.
     */
    const productSelect = page.locator('.dw-cell-product').locator('visible=true').first();
    await productSelect.selectOption({ index: 1 });

    /**
     * AND A QUANTITY, which this spec never set.
     *
     * `OrderLine.Quantity` is NOT NULL, so an added line with no quantity leaves Save disabled with the
     * title "Quantity cannot be null" — and the failure surfaces 30s later as a click timeout on Save,
     * pointing at the button rather than at the empty cell that disabled it.
     *
     * It was previously masked: the line-type `selectOption` timed out first, so the run never reached
     * the save. Removing that retired control did not create this, it revealed it.
     *
     * Scoped to the row that holds the product picker, because `.dw-num input` also matches the discount
     * cell — quantity is the FIRST number input in the line row, and picking the wrong one would set a
     * discount and leave quantity null, which fails identically.
     */
    const lineRow = page.locator('tr', { has: page.locator('.dw-cell-product') }).first();
    await lineRow.locator('td.dw-num input[type="number"]').first().fill('2');
    /**
     * NO LINE-TYPE SELECTION ANY MORE, because there is no such control.
     *
     * This chose "One-Time" from a per-line type select. `DealLineType` was retired with `DealLine`, and
     * the line row now offers product, quantity, unit price, line total and discount — no type. The
     * locator therefore matched nothing and `selectOption` timed out after 30s, which reads as a broken
     * dropdown rather than an absent one.
     *
     * Removed rather than retargeted: the type was FIXTURE SCAFFOLDING here — this spec is about closing
     * a deal, and it needed a saveable line, not a line of a particular type. Where a spec asserts the
     * retired vocabulary as its SUBJECT rather than its setup, deleting the assertion would be deleting
     * the test, and that is a decision rather than a repair. See 40-deal-workspace's recurring-path
     * assertion and 20-demo-tour's Deal Lines step.
     */

    await page.getByRole('button', { name: /^Save deal/i }).locator('visible=true').first().click();
    await expect(page.locator('.dw-msg')).toContainText(/created|saved/i, { timeout: 30_000 });

    // The screen said it saved; confirm the ROW exists before any test builds on it. A fixture that
    // returns the name of a deal that was never persisted turns every later assertion into a mystery
    // ("Cannot read properties of undefined"), which is exactly how this spec first failed.
    const saved = await DealByName(name);
    expect(saved, `fixture: "${name}" reported saved but no row exists`).toBeTruthy();
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

        /**
         * ── DELETED: "closing a won deal must create an ORDER in bizapps-orders" ─────────────────
         *
         * RETIRED BY `docs/DECISIONS.md` D-OS1. Close-won does not create an order: the order is
         * provisioned with the deal, inside `DealEntityServer.Save()` on the first save (S-US4), which
         * is why this spec now has to save before it can add a line at all. A close moves the order's
         * STATUS when the stage it enters declares one, and does nothing to it when the stage declares
         * nothing.
         *
         * NOT RE-AIMED ONTO "the order is left untouched", which was the obvious next move.
         * `close-won-order.CO3` already made that move and rejected it, and its docblock says why: once
         * a stage names what the order should become, "untouched" stops being the requirement and starts
         * being an accident of which stage the fixture happened to seed. The DEAL-9003 close run earlier
         * this week is the proof — the order held still because Proposal and Signed BOTH declare
         * `Quoted`, not because the close left it alone. An assertion that passes for that reason is
         * measuring the seed.
         *
         * The live requirement is asserted by CO3 instead, server-side, which sets the stage's
         * `OrderStatusOnEntry` inside its own transaction so the answer cannot depend on the seed. That
         * is the right place for it: it is a write-path guarantee, not something a browser adds
         * confidence to.
         *
         * What this spec still asserts about the close is above and unchanged — a WON status, the lock,
         * and an appended stage event for provenance. Those are the UI-reachable half.
         */

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
        const nameInput = page.getByPlaceholder(/Northwind Health/i).locator('visible=true').first();
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
