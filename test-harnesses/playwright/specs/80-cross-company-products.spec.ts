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
 *   2. choosing it leaves the line SAVEABLE, and the saved line books to that product's company.
 *
 * ── THE PICKER IS THE DEAL FORM'S LINE EDITOR NOW (#88) ──
 *
 * It was the deal workspace's lines grid, which nothing mounts any more. The same `OnProductChange`
 * stamp lives in the Deal form's restricted line editor, whose Save writes the line onto the order
 * directly — so "saveable" is now the editor's Save, not a deal save.
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
import { ByTestId, OpenSection } from '../lib/deal-form';

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
              -- CAST to DATE, not GETUTCDATE(): Available* are DATE columns, so SQL Server widens
              -- them to midnight, and a product available through today is excluded from 00:00:01
              -- onward. The spec would then report a seed problem against a picker that works.
            AND (AvailableFrom IS NULL OR AvailableFrom <= CAST(SYSUTCDATETIME() AS DATE))
              AND (AvailableTo   IS NULL OR AvailableTo   >= CAST(SYSUTCDATETIME() AS DATE))
            ORDER BY Name
        `);
        expect(
            foreign.length,
            `the seed must contain an ACTIVE product owned by a company other than ${ownCompany}, ` +
                'or this spec proves nothing about #29',
        ).toBeGreaterThan(0);
        const target = foreign[0];

        await OpenSection(page, 'lines');
        const add = ByTestId(page, 'lines-add');
        await expect(add, 'a saved, open deal must offer Add a product').toBeVisible({ timeout: 30_000 });
        await add.click();

        const editor = page.locator('[data-testid="line-editor"]:visible').first();
        await expect(editor, 'Add a product must open the line editor').toBeVisible({ timeout: 20_000 });
        const picker = editor.locator('[data-testid="line-product"]');
        await expect(picker, 'the line must offer a product picker').toBeVisible({ timeout: 20_000 });

        // ── 1. the picker OFFERS it ──────────────────────────────────────────────────────────────
        /**
         * Found by CONTAINMENT: an option reads `Name (SKU) — Company`, naming its owner because two
         * companies can sell an identically-named product.
         */
        const offered = (await picker.locator('option').allTextContents())
            .map((o) => o.trim())
            .filter((o) => o && !o.startsWith('—'));
        const match = offered.find((o) => o.includes(target.Name));
        expect(
            match,
            `'${target.Name}' is Active and owned by another company, so the picker must offer it (#29). ` +
                `Offered: ${offered.slice(0, 12).join(' | ')}`,
        ).toBeTruthy();

        // ── 2. choosing it leaves the line SAVEABLE ──────────────────────────────────────────────
        await picker.selectOption({ label: match as string });

        /**
         * Fill AND blur. The quantity binding commits on change, so a filled-but-unblurred input can
         * leave the entity holding the old value while the DOM shows the new one.
         */
        const qty = editor.locator('[data-testid="line-quantity"]');
        await expect(qty, 'the line editor must offer a quantity input').toBeVisible({ timeout: 10_000 });
        await qty.fill('1');
        await qty.blur();

        /**
         * The assertion the entity layer cannot make: the button a rep clicks is enabled once a foreign
         * product is chosen.
         */
        const save = editor.locator('[data-testid="line-save"]');
        await expect(
            save,
            'the line Save must be enabled after choosing a product — if it is not, the rep is stuck on a ' +
                'line whose every reachable field is filled',
        ).toBeEnabled({ timeout: 20_000 });
        await save.click();

        /**
         * A refused save keeps the editor open with its reason. The OnProductChange failure this spec
         * guards reads "Company ID cannot be null" there, so that text is carried into the failure.
         */
        const closed = await expect(editor)
            .toBeHidden({ timeout: 30_000 })
            .then(() => true)
            .catch(() => false);
        const onScreen = closed
            ? []
            : await editor.locator('.mjs-le__error').allTextContents().catch(() => [] as string[]);

        // ── 3. the saved line books to the PRODUCT's company, not the deal's ─────────────────────
        const lines = await QueryAll<{ CompanyID: string; ProductID: string }>(
            `SELECT CompanyID, ProductID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
        );
        if (!closed || lines.length !== 1) {
            // Say WHY before failing on the count.
            throw new Error(
                `expected exactly one saved line, found ${lines.length}.\n` +
                    `  editor closed: ${closed}\n` +
                    `  editor errors: ${onScreen.length ? onScreen.join(' | ') : '(none)'}\n` +
                    `  console errors: ${sink.errors.length ? sink.errors.join(' | ') : '(none)'}\n` +
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
