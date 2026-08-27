/**
 * @fileoverview Issue #29 in the browser — a deal may carry ANY company's product.
 *
 * ── WHY THIS EXISTS WHEN THE INTEGRATION SUITE ALREADY COVERS #29 ──
 *
 * `product-picker.PP1-PP5` cover the rule and the persisted result: PP2 proves the FILTER returns other
 * companies' products, PP5 proves a line saved with a foreign product BOOKS to that product's company.
 * Neither touches the browser, and the browser is where the remaining risk lives.
 *
 * `OnProductChange` stamps `line.CompanyID` from the chosen product, and that method exists only because
 * `deal.Validate()` runs CLIENT-SIDE, where orders' `OrderLineEntityServer` does not exist and
 * `OrderLine.CompanyID` is NOT NULL. Get it wrong and the rep sees a disabled Save reading
 * "Company ID cannot be null" against a form where every field they can reach is filled — the defect
 * found in the Explorer pass on 2026-08-20, which the old pipeline stamp existed to prevent. An
 * entity-layer check cannot see that: it never runs the component, so it never runs the guard that
 * decides whether the button a rep clicks is enabled.
 *
 * So this spec asserts the two things only a browser can:
 *   1. the picker OFFERS a product owned by another company, and
 *   2. choosing it leaves the deal SAVEABLE, and the saved line books to that product's company.
 *
 * ── THE COMPANIES ARE DISCOVERED, NOT ASSUMED ──
 *
 * Issue #29 describes both pipelines as Blue-Cypress-owned. On this host they are NOT: `B2B` and `D2C`
 * belong to different companies. That does not weaken the test, but it does mean "the deal's company"
 * cannot be read off an arbitrary pipeline — `ComposeDeal` picks whichever pipeline it picks, and an
 * earlier draft of this spec compared against the wrong one, which would have made the final assertion
 * either vacuous or wrong depending on the draw.
 *
 * So the deal is composed FIRST and its company read back from the row, and the foreign product is then
 * chosen relative to THAT. If no foreign product exists the spec FAILS rather than skips, because
 * "nothing to test" and "the seed no longer covers this" look identical from a green run.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { AssertBaseline, ComposeDeal, PurgeByPrefix, PurgeDeal } from '../lib/deal-flow';
import { OpenPane, RealOptionLabels, SaveDeal } from '../lib/workspace';

const RUN = `PW-X29-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

test.describe('#29 — products from another company are sellable on a deal', () => {
    test.afterAll(async () => {
        if (dealID) {
            await PurgeDeal(dealID, orderID || null);
        }
        await PurgeByPrefix(RUN);
        const left = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN}%'`,
        );
        expect(Number(left?.N ?? -1), 'the deal this spec created must be gone').toBe(0);
        await AssertBaseline();
    });

    test('the picker offers a FOREIGN product, and the saved line books to that product company', async ({
        page,
    }) => {
        test.setTimeout(600_000);
        const sink = captureConsoleErrors(page);

        const composed = await ComposeDeal(page, `${RUN} cross-company`);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        // The deal's OWN company, from the deal itself rather than from a guess about which pipeline.
        const deal = await QueryOne<{ CompanyID: string }>(
            `SELECT CompanyID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
        );
        expect(deal?.CompanyID, 'the composed deal must have a company').toBeTruthy();
        const ownCompany = deal!.CompanyID;

        const foreign = await QueryAll<{ ID: string; Name: string; CompanyID: string }>(`
            SELECT TOP 1 ID, Name, CompanyID
            FROM __mj_BizAppsOrders.Product
            WHERE Status = 'Active'
              AND CompanyID <> '${ownCompany}'
              AND (AvailableFrom IS NULL OR AvailableFrom <= GETUTCDATE())
              AND (AvailableTo   IS NULL OR AvailableTo   >= GETUTCDATE())
            ORDER BY Name
        `);
        expect(
            foreign.length,
            `the seed must contain an ACTIVE product owned by a company other than ${ownCompany}, ` +
                'or this spec proves nothing about #29',
        ).toBeGreaterThan(0);
        const target = foreign[0];

        await OpenPane(page, 'Product lines');

        const add = page.locator('.dw-addbtn', { hasText: 'Add line' }).first();
        await expect(add, 'Add line must be enabled once the deal is saved').toBeEnabled({ timeout: 20_000 });
        await add.click();
        await page.waitForTimeout(500);

        const picker = page.locator('.dw-table tbody tr').first().locator('select.dw-cell-product');
        await expect(picker, 'the line must offer a product picker').toBeVisible({ timeout: 20_000 });

        // ── 1. the picker OFFERS it ──────────────────────────────────────────────────────────────
        const offered = await RealOptionLabels(picker);
        const match = offered.find((o) => o.includes(target.Name));
        expect(
            match,
            `'${target.Name}' is Active and owned by another company, so the picker must offer it (#29). ` +
                `Offered: ${offered.slice(0, 12).join(' | ')}`,
        ).toBeTruthy();

        // ── 2. choosing it leaves the deal SAVEABLE ──────────────────────────────────────────────
        await picker.selectOption({ label: match as string });
        await page.waitForTimeout(300);

        /**
         * Fill AND blur. `AddLines` does both, and the blur is not decoration — the quantity binding
         * commits on change, so a filled-but-unblurred input can leave the entity holding the old value
         * while the DOM shows the new one.
         */
        const qty = page.locator('.dw-table tbody tr').first().locator('input[type="number"]').first();
        await expect(qty, 'the new line row must offer a quantity input').toBeVisible({ timeout: 10_000 });
        await qty.fill('1');
        await qty.blur();
        await page.waitForTimeout(400);

        /**
         * The assertion the entity layer cannot make. If `OnProductChange` failed to stamp the company,
         * `deal.Validate()` fails in the browser and this button is disabled — naming a column the rep
         * cannot see, let alone fill.
         */
        const save = page.getByRole('button', { name: /^Save deal/i }).first();
        await expect(
            save,
            'Save deal must be enabled after choosing a product — if it is not, OnProductChange did not ' +
                'stamp CompanyID and the rep is stuck on an invisible required column',
        ).toBeEnabled({ timeout: 20_000 });

        await SaveDeal(page);

        // ── 3. the saved line books to the PRODUCT's company, not the deal's ─────────────────────
        /**
         * POLLED, not read once. `SaveDeal` clicks and waits a fixed 2.5s without asserting the save
         * landed, so a single reading conflates "the save failed" with "the save had not finished".
         * Those need different fixes, and an earlier version of this spec reported 0 lines without
         * being able to say which it was.
         */
        let lines: { CompanyID: string; ProductID: string }[] = [];
        for (let attempt = 0; attempt < 10; attempt += 1) {
            lines = await QueryAll<{ CompanyID: string; ProductID: string }>(
                `SELECT CompanyID, ProductID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
            );
            if (lines.length > 0) break;
            await page.waitForTimeout(1_000);
        }

        if (lines.length !== 1) {
            // Say WHY before failing on the count. The console is where a refused save explains itself.
            const banner = await page
                .locator('.dw-error, .k-notification, [role="alert"]')
                .allTextContents()
                .catch(() => [] as string[]);
            throw new Error(
                `expected exactly one saved line, found ${lines.length}.\n` +
                    `  console errors: ${sink.errors.length ? sink.errors.join(' | ') : '(none)'}\n` +
                    `  on-screen alerts: ${banner.length ? banner.join(' | ') : '(none)'}\n` +
                    `  orderID=${orderID} dealID=${dealID} product=${target.Name} (${target.ID})`,
            );
        }
        expect(lines[0].ProductID.toLowerCase(), 'the line kept the product that was chosen').toBe(
            target.ID.toLowerCase(),
        );
        expect(lines[0].CompanyID.toLowerCase(), "the line must book to the PRODUCT's company").toBe(
            target.CompanyID.toLowerCase(),
        );
        expect(
            lines[0].CompanyID.toLowerCase(),
            "the line took the DEAL's company — the whole point of #29 is that it should not",
        ).not.toBe(ownCompany.toLowerCase());

        expectOnlyKnownErrors(sink, [], 'putting a cross-company product on a deal');
    });
});
