/**
 * @fileoverview #32 — the term start on a subscription line, as the browser renders and binds it.
 *
 * ── WHAT THIS PROVES, AND WHAT IT DELIBERATELY LEAVES TO THE CHECKS ─────────────────────────────────
 *
 * RENDERING and BINDING, and nothing else. `term-start.TS1–TS6` prove the rules and the round trip
 * through the database; they cannot see a screen. What only a browser can show is that the control
 * exists, that it is bound to the ORDER DATE rather than to a value written onto the line, that a
 * one-time line renders no control at all, and that clearing it puts the field back on the order date.
 * Those are the ways this feature can be wired up wrongly while every check stays green.
 *
 * PERSISTENCE IS NOT ASSERTED HERE, on purpose. `TS6` already saves a term start through a deal, reloads
 * it, clears it and re-reads it — at the tier where that claim is stable. The line is composed and then
 * cancelled, so nothing is written.
 *
 * ── THE LINE EDITOR, NOT A GRID COLUMN (#88) ────────────────────────────────────────────────────────
 *
 * This read a "Term start" column in the deal workspace's lines grid, which nothing mounts any more.
 * The Deal form's restricted line editor shows the control (`line-term-start`) only when the product
 * needs it, with an "order date" hint (`.mjs-le__hint`) while the line stores none of its own.
 *
 * DROPPED, with the workspace: the dedicated "Reset to the order date" button and its absent-until-
 * stored assertion. The editor has no such button; emptying the control is its reset (an emptied
 * control writes NULL, "use the order date"), and that is what is asserted instead.
 *
 * ── THE FIXTURE REQUIREMENT, STATED OUT LOUD ────────────────────────────────────────────────────────
 *
 * This needs ONE subscription product and ONE that is not. The seeded catalogue has NO subscription
 * products at all (9 products, 0 with a `SubscriptionTypeID`, measured 2026-08-27), so the spec SKIPS
 * with a message naming what is missing rather than failing. A red spec would say the feature is broken
 * when the truth is the host has nothing to exercise it with.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { ByTestId, OpenSection } from '../lib/deal-form';

const RUN = `PW-TERMSTART-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

interface Product extends Record<string, unknown> { ID: string; Name: string; SubscriptionTypeID: string | null }

/** The date a rep types. Deliberately not today's, so an inherited default cannot pass as a stored one. */
const CHOSEN = '2026-09-01';

/** The open line editor. */
function lineEditor(page: Page): Locator {
    return page.locator('[data-testid="line-editor"]:visible').first();
}

/**
 * The term-start control, which the editor renders only while `ShowTermStart` holds.
 *
 * Its PRESENCE is asserted separately from its VALUE, because requirement 3 is "no field", not "an empty
 * field" — moving the `@if` from around the control to merely blanking it would break requirement 3
 * while a value assertion stayed green.
 */
function termStart(page: Page): Locator {
    return lineEditor(page).locator('[data-testid="line-term-start"]');
}

/** The "order date" hint, located by its element rather than by its text. */
function inheritedHint(page: Page): Locator {
    return lineEditor(page).locator('.mjs-le__hint');
}

/**
 * Points the open editor at a NAMED product.
 *
 * An option reads `Name (SKU) — Company`, so it is found by CONTAINMENT and selected by its exact label.
 */
async function chooseProduct(page: Page, productName: string): Promise<void> {
    const picker = lineEditor(page).locator('[data-testid="line-product"]');
    await expect(picker, 'the line editor must offer a product picker').toBeVisible({ timeout: 20_000 });
    const labels = (await picker.locator('option').allTextContents()).map((o) => o.trim());
    const match = labels.find((o) => o.includes(productName));
    expect(match, `the picker must offer "${productName}" — it offered ${JSON.stringify(labels)}`).toBeTruthy();
    await picker.selectOption({ label: match as string });
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

        const order = await QueryOne<{ OrderDate: string }>(
            `SELECT CONVERT(varchar(10), OrderDate, 23) AS OrderDate
               FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`,
        );
        expect(order, 'the deal must have a server-provisioned order').toBeTruthy();
        const orderDate = String(order!.OrderDate);

        /**
         * NOT filtered by company: the picker offers any company's product (#29), and the line takes its
         * company from the product chosen.
         */
        const products = await QueryAll<Product>(
            `SELECT ID, Name, SubscriptionTypeID FROM __mj_BizAppsOrders.Product
              WHERE Status = 'Active'
                AND (AvailableFrom IS NULL OR AvailableFrom <= CAST(SYSUTCDATETIME() AS DATE))
                AND (AvailableTo   IS NULL OR AvailableTo   >= CAST(SYSUTCDATETIME() AS DATE))`,
        );
        const subscription = products.find((p) => !!p.SubscriptionTypeID);
        const oneTime = products.find((p) => !p.SubscriptionTypeID);

        test.skip(
            !subscription || !oneTime,
            'this host has no subscription product in its catalogue, so there is nothing that offers a '
            + 'term start. Point one Product at a SubscriptionType and re-run — see term-start.checks.ts.',
        );

        await OpenSection(page, 'lines');
        const add = ByTestId(page, 'lines-add');
        await expect(add, 'a saved, open deal must offer Add a product').toBeVisible({ timeout: 30_000 });
        await add.click();
        await expect(lineEditor(page), 'Add a product must open the line editor').toBeVisible({ timeout: 20_000 });

        /**
         * THE ONE-TIME PRODUCT FIRST. Requirement 3: no control at all, not a disabled or empty one. First,
         * because a STORED term start is shown whatever the product, so this must be asked before one is
         * typed.
         */
        await chooseProduct(page, String(oneTime!.Name));
        await expect(
            termStart(page),
            'a non-subscription line must not offer a term start — NO control, which is what requirement 3 '
                + 'says. An empty control would satisfy a value assertion while breaking the requirement.',
        ).toHaveCount(0);

        /**
         * THE SUBSCRIPTION PRODUCT. The control shows the ORDER DATE while the line stores none. This is
         * the assertion separating a displayed default from a written one: nothing was stored, so a value
         * here can only have come from the order.
         */
        await chooseProduct(page, String(subscription!.Name));
        await expect(termStart(page), 'a subscription line must offer a term start').toHaveCount(1, {
            timeout: 10_000,
        });
        await expect(
            termStart(page),
            `the subscription line must display the order date (${orderDate}) as its default`,
        ).toHaveValue(orderDate);
        await expect(
            inheritedHint(page),
            'an inherited default must SAY it is inherited — a rep cannot tell otherwise',
        ).toBeVisible();

        // ── Typing a term start switches the field from inherited to stored. ──
        await termStart(page).fill(CHOSEN);
        await termStart(page).blur();
        await expect(termStart(page), 'the field must hold what the rep typed').toHaveValue(CHOSEN);
        await expect(
            inheritedHint(page),
            'once a term start is stored the field no longer follows the order date, and must stop saying so',
        ).toHaveCount(0);

        // ── And emptying it puts it back on the order date — the editor's reset. ──
        await termStart(page).fill('');
        await termStart(page).blur();
        await expect(termStart(page), 'emptying must return the field to the order date').toHaveValue(orderDate);
        await expect(inheritedHint(page), 'and it must read as inherited again').toBeVisible();

        // Nothing is saved: persistence is TS6's claim, not this spec's.
        await lineEditor(page).getByRole('button', { name: /^Cancel$/ }).click();
        await expect(lineEditor(page), 'Cancel must close the line editor').toBeHidden({ timeout: 10_000 });
    });
});
