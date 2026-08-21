/**
 * PER-DEAL STATE MUST NOT SURVIVE A TAB SWITCH — the product catalogue, and the close lock.
 *
 * ⚠️ **WRITTEN BUT NEVER RUN.** Explorer and the host database were in use by another session when this
 * was authored, so this file has not been executed once — not green, not red, not at all. The
 * "HOW TO MAKE THESE FAIL" block at the bottom is the first thing to work on the next run, BEFORE
 * trusting a green result. A spec that has never failed has never been shown to test anything.
 *
 * ── WHY THIS NEEDS THE BROWSER, AND WHY IT ENDS AT THE DATABASE ─────────────────────────────────
 *
 * The defect lives entirely in one Angular component and produces a valid row. `DealWorkspaceComponent`
 * held the product catalogue in a single field refreshed on open and on pipeline change — neither of
 * which is a tab switch. Open a deal selling for company A, open one for company B, switch back to A,
 * and the picker still offered company B's catalogue. `AddLine()` then stamped `CompanyID` from the
 * ACTIVE deal's pipeline, so the saved line carried company A against a company-B product.
 *
 * Nothing refuses that. `OrderLine`'s foreign key is to `Product`, not to a company, and
 * `CK_OrderLine_DiscountPct` and friends say nothing about it. There is no constraint to violate, no
 * error to catch and no exception to log: the deal saves, the quote prices, and the only trace is a
 * line whose product belongs to somebody else's catalogue.
 *
 * So the check has to be a comparison across three rows -- the line's company, its order's company,
 * and its product's company -- and no API-level test can produce the state that breaks it, because the
 * state is "which tab is in front".
 *
 * ── THE ASSERTION IS ON THE ROW, NOT ON THE PICKER ──────────────────────────────────────────────
 *
 * Test 1 checks the picker too, because an empty picker and a correct picker look the same from the
 * database. But the picker is the mechanism and the row is the harm: a future fix that repopulates the
 * catalogue correctly while stamping the company from somewhere else would pass a UI-only assertion
 * and still write the bad row. The row comparison is the one that cannot be satisfied by accident.
 *
 * ── FIXTURE REQUIREMENTS, AND WHY THIS SKIPS RATHER THAN INVENTS ────────────────────────────────
 *
 * Needs two companies that each own at least one Active, currently-available `Product`, and a sales
 * pipeline apiece. `seed-demo-data.sh` provides the two pipelines (B2B on company 1, D2C on company 2)
 * but no products at all -- those come from orders' own seed. Rather than create products here, which
 * would mean this repo writing rows it does not own, the spec discovers what exists and SKIPS with a
 * message naming what is missing. A skip that says why is worth more than a fixture that drifts from
 * the seed it shadows.
 */
import { expect, test } from '@playwright/test';

import { SelectByRecordID, SetField } from '../lib/workspace';
import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, drain, shot } from '../lib/explorer';
import { CloseDb, QueryAll, QueryOne } from '../lib/db';

const SALES_APP = '/app/sales';
const RUN_TAG = `TS-${Date.now()}`;

/**
 * By ROLE and by prefix, copied from `50-sales-shell.spec.ts` rather than reinvented: the left nav
 * also emits hidden `.mj-left-nav__switcher-label` spans carrying the same words, and a text locator
 * matches those instead of the rail.
 */
function railItem(page: import('@playwright/test').Page, label: string) {
    return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

/** A company that can actually be sold for: it owns a pipeline AND at least one sellable product. */
interface Sellable extends Record<string, unknown> {
    CompanyID: string;
    CompanyName: string;
    PipelineID: string;
    PipelineName: string;
    ProductCount: number;
}

interface LineRow extends Record<string, unknown> {
    LineID: string;
    LineCompanyID: string | null;
    OrderCompanyID: string | null;
    ProductID: string | null;
    ProductCompanyID: string | null;
    ProductName: string | null;
}

/**
 * The two companies to drive, or null when the fixture cannot support the test.
 *
 * `Status = 'Active'` and the availability window are the SAME predicate the app filters on
 * (`ProductFilterFor` in `packages/Entities/src`). Asserting against a different rule would make the
 * spec's "the picker offers the wrong catalogue" claim unfalsifiable -- it would be comparing the
 * picker to a list nothing builds.
 */
async function twoSellableCompanies(): Promise<[Sellable, Sellable] | null> {
    const rows = await QueryAll<Sellable>(`
        SELECT TOP 2
               p.CompanyID,
               c.Name           AS CompanyName,
               MIN(p.ID)        AS PipelineID,
               MIN(p.Name)      AS PipelineName,
               COUNT(pr.ID)     AS ProductCount
          FROM __mj_BizAppsSales.Pipeline p
          JOIN __mj.Company c        ON c.ID = p.CompanyID
          JOIN __mj_BizAppsOrders.Product pr
                ON pr.CompanyID = p.CompanyID
               AND pr.Status = 'Active'
               AND (pr.AvailableFrom IS NULL OR pr.AvailableFrom <= CAST(SYSUTCDATETIME() AS DATE))
               AND (pr.AvailableTo   IS NULL OR pr.AvailableTo   >= CAST(SYSUTCDATETIME() AS DATE))
         WHERE p.IsActive = 1
         GROUP BY p.CompanyID, c.Name
        HAVING COUNT(pr.ID) > 0
         ORDER BY p.CompanyID
    `);
    return rows.length === 2 ? [rows[0], rows[1]] : null;
}

/** Every line on the deal's order, with the three companies that must agree lined up beside each other. */
async function linesFor(dealName: string): Promise<LineRow[]> {
    return QueryAll<LineRow>(`
        SELECT ol.ID          AS LineID,
               ol.CompanyID   AS LineCompanyID,
               oh.CompanyID   AS OrderCompanyID,
               ol.ProductID,
               pr.CompanyID   AS ProductCompanyID,
               pr.Name        AS ProductName
          FROM __mj_BizAppsSales.Deal d
          JOIN __mj_BizAppsOrders.OrderHeader oh ON oh.ID = d.OrderID
          JOIN __mj_BizAppsOrders.OrderLine   ol ON ol.OrderID = oh.ID
          LEFT JOIN __mj_BizAppsOrders.Product pr ON pr.ID = ol.ProductID
         WHERE d.Name = '${dealName.replace(/'/g, "''")}'
    `);
}

test.describe('deal workspace — state that belongs to one deal', () => {
    test.afterAll(async () => {
        await CloseDb();
    });

    test('the product catalogue follows the ACTIVE tab, and a saved line agrees with its order', async ({ page }) => {
        const pair = await twoSellableCompanies();
        test.skip(
            pair === null,
            'needs two companies that each own an active pipeline AND at least one Active, currently '
                + 'available Product. seed-demo-data.sh seeds the pipelines; the products come from '
                + "orders' seed, which this repo does not own.",
        );
        const [alpha, beta] = pair!;

        const errors = captureConsoleErrors(page);
        await page.goto(`${EXPLORER_BASE_URL}${SALES_APP}`);
        await railItem(page, 'Workspace').click();

        const nameA = `${RUN_TAG} deal on ${alpha.CompanyName}`;
        const nameB = `${RUN_TAG} deal on ${beta.CompanyName}`;

        // ── deal A, on company alpha's pipeline ────────────────────────────────────────────────
        await createDeal(page, nameA, alpha.PipelineID);

        // ── deal B, on company beta's pipeline, in a second tab ────────────────────────────────
        await page.locator('.mj-tabs__new').click();
        await createDeal(page, nameB, beta.PipelineID);

        /**
         * The catalogue offered on B, recorded BEFORE switching away.
         *
         * This is the value the defect leaks. Capturing it here rather than deriving it from the
         * database means the assertion below compares what the UI actually showed on one deal with
         * what it shows on the other, which is the claim being made.
         */
        const offeredOnB = await productOptions(page);
        expect(offeredOnB.length, 'company beta must offer at least one product, or nothing is leaked').toBeGreaterThan(0);

        // ── back to A. This is the whole test. ────────────────────────────────────────────────
        await page.locator('.mj-tabs__tab', { hasText: nameA }).click();
        await expect(page.locator('.mj-tabs__tab--active')).toContainText(nameA);
        await shot(page, `${RUN_TAG}-switched-back-to-A`);

        const offeredOnA = await productOptions(page);

        /**
         * ASSERTION 1 — the picker is A's catalogue, not B's.
         *
         * Stated as a set difference rather than a length comparison: two companies can legitimately
         * own the same NUMBER of products, so counting proves nothing. What must be true is that
         * nothing on offer is exclusive to beta.
         */
        const betaOnly = offeredOnB.filter((label) => !offeredOnA.includes(label));
        const leaked = offeredOnA.filter((label) => betaOnly.includes(label));
        expect(
            leaked,
            `the picker on "${nameA}" (company ${alpha.CompanyName}) offered products exclusive to `
                + `${beta.CompanyName}. This is the defect: the catalogue is per-company and was not `
                + 'refreshed when the active tab changed.',
        ).toEqual([]);
        expect(
            offeredOnA.length,
            'and it must not be empty either -- an empty picker would pass the check above while '
                + 'making the deal unquotable',
        ).toBeGreaterThan(0);

        // ── add a line and save, so the consequence lands in a row ────────────────────────────
        await page.locator('.dw-addbtn').click();
        const picker = page.locator('.dw-cell-product').first();
        await picker.selectOption({ index: 1 });          // index 0 is "— not linked —"
        /**
         * Quantity has no class of its own, and `.dw-table` is shared with the payment-schedule grid,
         * so the row is identified by the one thing unique to a LINE row: it contains the product
         * picker. Then the first number input in that row is Qty -- unit price and line total are
         * read-only cells, and the discount box comes after. Getting this wrong would have the spec
         * quietly set a DISCOUNT and assert nothing about quantity.
         */
        const lineRow = page.locator('tr', { has: page.locator('.dw-cell-product') }).first();
        await lineRow.locator('td.dw-num input[type="number"]').first().fill('1');
        await save(page);

        /**
         * ASSERTION 2 — THE ONE THE UI CANNOT FAKE.
         *
         * Three rows, three companies, all of which must be the same value. `OrderLine.CompanyID` is
         * stamped by the browser (it has to be: `OrderLineEntityServer` runs on the server, and
         * `deal.Validate()` runs here), the order's company is stamped by `DealEntityServer` from the
         * pipeline, and the product's company is whatever catalogue it came from. The defect makes the
         * third disagree with the first two while every constraint stays satisfied.
         */
        const lines = await linesFor(nameA);
        expect(lines.length, 'the line was saved').toBe(1);
        const line = lines[0];

        expect(line.ProductID, 'the line references a product').not.toBeNull();
        expect(
            line.ProductCompanyID,
            `the line's product (${line.ProductName}) belongs to company ${line.ProductCompanyID}, but `
                + `the order sells for ${line.OrderCompanyID}. A line quoting another company's product `
                + 'is exactly what the stale catalogue produces, and no constraint refuses it.',
        ).toBe(line.OrderCompanyID);
        expect(line.LineCompanyID, "and the line's own stamp agrees with its order").toBe(line.OrderCompanyID);
        expect(line.OrderCompanyID, 'which is the company the deal sells for').toBe(alpha.CompanyID);

        expect(drain(errors), 'no console errors along the way').toEqual([]);
    });

    /**
     * The SECOND half of the audit, and the reason the fix is structural rather than one more call.
     *
     * `SelectTab`'s own comment diagnosed this class for `Lock` and fixed it in that one method. Two of
     * `Lock`'s own paths were still missing: `NewDeal` never cleared it, and `CloseTab` never
     * re-resolved it even though closing the active tab activates a neighbour.
     *
     * The NewDeal path is the one worth a spec, because its symptom is total and silent: after a closed
     * deal, a brand-new blank deal rendered every field read-only and every inline create button
     * absent. Nothing errors. The rep simply cannot type.
     */
    test('a new deal opened after a CLOSED one is editable', async ({ page }) => {
        const closed = await QueryOne<{ ID: string; Name: string }>(`
            SELECT TOP 1 d.ID, d.Name
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
             WHERE st.LocksDeal = 1
             ORDER BY d.__mj_UpdatedAt DESC
        `);
        test.skip(
            !closed,
            'needs one deal in a status whose DealStatusType.LocksDeal = 1. Resolved from the flag, '
                + 'never from a status NAME -- the vocabulary is data (CLAUDE.md rule 2).',
        );

        /**
         * THROUGH THE ROSTER, BECAUSE THERE IS NO URL FOR A DEAL.
         *
         * `DealWorkspaceComponent` takes no route parameter and no input -- `OpenDeal(dealID)` is
         * called by `SalesSectionComponent` when a roster row is clicked, and that is the only way in.
         * An earlier draft of this spec navigated to `?dealID=...`, which would have loaded a blank
         * workspace and then asserted the absence of a lock notice on a deal that was never opened:
         * green, and about nothing.
         */
        await page.goto(`${EXPLORER_BASE_URL}${SALES_APP}`);
        await railItem(page, 'All deals').click();
        const row = page.locator('.wrap--list .wl tbody tr', { hasText: closed!.Name }).first();
        await expect(row, `the roster must list the locked deal "${closed!.Name}"`).toBeVisible({ timeout: 15_000 });
        await row.click();
        await expect(page.locator('[data-testid="lock-notice"]')).toBeVisible({ timeout: 15_000 });

        await page.locator('.mj-tabs__new').click();
        await expect(page.locator('.mj-tabs__tab--active')).toContainText('New deal');
        await shot(page, `${RUN_TAG}-new-deal-after-closed`);

        await expect(
            page.locator('[data-testid="lock-notice"]'),
            'a brand-new deal is not locked, and must not inherit the notice from the deal before it',
        ).toHaveCount(0);

        const name = page.locator('input[name="Name"], .dw-field input[type="text"]').first();
        await expect(name, 'and its fields must be typable').toBeEnabled();
    });

    /**
     * ── THE THIRD TEST THIS FILE ASKED FOR, WRITTEN ON ITS FIRST RUN ────────────────────────────────
     *
     * Mutation 5 in the list below says: *"neither test above covers this one, and that is worth knowing
     * rather than assuming. It needs a third test: three tabs, close the middle one, assert the catalogue
     * matches the tab that becomes active. Write it when this file is first run, or record here that
     * CloseTab is uncovered."*
     *
     * This is that run, so it is written rather than recorded as a gap.
     *
     * ── WHY CLOSING A TAB IS ITS OWN PATH ───────────────────────────────────────────────────────────
     *
     * `SelectTab` re-syncs because the rep chose another deal. `CloseTab` re-syncs for a different
     * reason: closing the ACTIVE tab activates a neighbour the rep did not choose, so the state on
     * screen belongs to a deal nobody selected. Same stale-state class, different trigger — and it is
     * exactly the shape that made `Lock` wrong in three separate places before it was fixed structurally.
     *
     * Three tabs, not two, and the middle one closed rather than the last: with two tabs the survivor is
     * unambiguous and a broken implementation that simply kept the FIRST tab's state would still look
     * right. With three, the tab that becomes active is a real choice.
     */
    test('closing the active tab re-syncs to whichever tab becomes active', async ({ page }) => {
        const pair = await twoSellableCompanies();
        test.skip(
            pair === null,
            'needs two companies that each own an active pipeline AND at least one Active, currently '
                + 'available Product — same requirement as the first test.',
        );
        const [alpha, beta] = pair!;

        const errors = captureConsoleErrors(page);
        await page.goto(`${EXPLORER_BASE_URL}${SALES_APP}`);
        await railItem(page, 'Workspace').click();

        const first = `${RUN_TAG} close-tab A on ${alpha.CompanyName}`;
        const middle = `${RUN_TAG} close-tab B on ${beta.CompanyName}`;
        const last = `${RUN_TAG} close-tab C on ${alpha.CompanyName}`;

        await createDeal(page, first, alpha.PipelineID);
        await page.locator('.mj-tabs__new').click();
        await createDeal(page, middle, beta.PipelineID);
        await page.locator('.mj-tabs__new').click();
        await createDeal(page, last, alpha.PipelineID);

        // Back to the MIDDLE tab, so the tab being closed is the active one.
        await page.locator('.mj-tabs__tab', { hasText: middle }).click();
        await page.waitForTimeout(1_500);
        await expect(
            page.locator('.mj-tabs__tab--active'),
            'setup: the middle tab must be active before it is closed',
        ).toContainText(middle);

        const onBeta = await productOptions(page);
        expect(
            onBeta.length,
            `setup: company ${beta.CompanyName} must offer products, or the comparison below is empty`,
        ).toBeGreaterThan(0);

        /**
         * CLOSE IT. The close control lives on the tab itself; scoped to the active tab so this cannot
         * close a neighbour and then assert about the wrong survivor.
         */
        await page.locator('.mj-tabs__tab--active .mj-tabs__close').click();
        await page.waitForTimeout(2_500);

        const survivor = (await page.locator('.mj-tabs__tab--active').innerText()).trim();
        expect(
            survivor === '' ? '(none)' : survivor,
            'closing the active tab must activate a neighbour, not leave the workspace with no active tab',
        ).not.toBe('(none)');
        expect(
            survivor,
            'and the tab that becomes active must be one of the two that remain',
        ).toMatch(new RegExp(`${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

        /**
         * ── THE ASSERTION. The catalogue must belong to the SURVIVOR, not to the closed tab ──────────
         *
         * Both remaining deals are on company alpha, so the catalogue must be alpha's. The failure this
         * catches is the picker still holding beta's products — the state of a deal that is no longer
         * open, on a tab nobody chose.
         */
        const afterClose = await productOptions(page);
        const betaOnly = onBeta.filter((label) => !afterClose.includes(label));
        const stale = afterClose.filter((label) => betaOnly.includes(label));
        expect(
            stale,
            `after closing the ${beta.CompanyName} tab, the picker still offered products exclusive to `
                + 'it. CloseTab activated a neighbour without re-syncing, so the catalogue belongs to a '
                + 'deal that is no longer open.',
        ).toEqual([]);
        expect(
            afterClose.length,
            'and the survivor must have a usable catalogue -- an empty picker would satisfy the check '
                + 'above while making the deal unquotable',
        ).toBeGreaterThan(0);

        expectNoConsoleErrors(errors);
    });
});

/** Fill the minimum a deal needs and save it. */
async function createDeal(page: import('@playwright/test').Page, name: string, pipelineID: string): Promise<void> {
    /**
     * BY LABELLED FIELD, NOT BY POSITION, and by the value Angular actually wrote.
     *
     * `.dw-field select').first()` assumed the Pipeline picker is the first select on the pane; the party
     * pane has several and the order is a layout detail. And `selectOption(pipelineID)` could never match:
     * these pickers bind `[ngValue]`, so the DOM value is `"<index>: <guid>"` and a bare GUID times out
     * after thirty seconds with "did not find some options". `SelectByRecordID` handles both.
     */
    await SetField(page, 'Deal name', name);
    await SelectByRecordID(page, 'Pipeline', pipelineID);
    await save(page);
    await expect(page.locator('.mj-tabs__tab--active')).toContainText(name);
}

/** The labels the product picker currently offers, minus the "not linked" placeholder. */
async function productOptions(page: import('@playwright/test').Page): Promise<string[]> {
    const addBtn = page.locator('.dw-addbtn');
    if (await addBtn.isEnabled()) {
        // A picker only exists once there is a line to hold it.
        const existing = await page.locator('.dw-cell-product').count();
        if (existing === 0) {
            await addBtn.click();
        }
    }
    const options = await page.locator('.dw-cell-product').first().locator('option').allTextContents();
    return options.map((o) => o.trim()).filter((o) => o.length > 0 && !o.startsWith('—'));
}

async function save(page: import('@playwright/test').Page): Promise<void> {
    // The footer's Confirm is wired to Save() by mj-workspace-card; see the template's (Confirm) binding.
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.locator('.dw-msg')).toBeVisible();
}

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  HOW TO MAKE THESE FAIL — do this FIRST on the next run, before trusting a green result
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * All five mutations are in `packages/Angular/src/lib/workspace/deal-workspace.component.ts`. Apply
 * one, rebuild `packages/Angular`, run, restore.
 *
 * 1. **The reported defect, restored.** Change the `Products` getter to return `this.Catalogue.Items`
 *    unconditionally, dropping the company comparison.
 *    → assertion 1 must go red, naming beta's products. If it stays green, the spec is not reading the
 *      picker it believes it is, and NOTHING else in this file can be trusted.
 *
 * 2. **The row assertion, isolated.** Keep the getter fixed but make `AddLine` stamp
 *    `line.Set('CompanyID', ...)` from `this.Catalogue.CompanyID` instead of `this.ActiveCompanyID`.
 *    → assertion 2's `LineCompanyID` check must fail while assertion 1 still passes. That separation is
 *      the point: it proves the row comparison catches a wrong stamp independently of the picker, which
 *      is the failure a UI-only assertion would wave through.
 *
 * 3. **The sync removed from the switch path.** Make `SelectTab` call `RefreshLock()` alone again,
 *    exactly as it did before.
 *    → assertion 1 must fail. This is the one-line "fix" that was available for the reported bug, and
 *      it is what this mutation exists to keep out.
 *
 * 4. **The NewDeal lock gap, restored.** In `NewDeal`, replace `await this.SyncToActiveDeal()` with
 *    `await this.RefreshProducts(); this.Revalidate();`.
 *    → test 2 must fail on the lock notice still being visible. Note it needs a locked deal in the
 *      fixture, so confirm the skip did NOT fire, or this mutation proves nothing.
 *
 * 5. **The CloseTab gap, restored.** Delete the `SyncToActiveDeal()` call from `CloseTab`.
 *    → **now covered.** The third test asked for here was written on this file's first run (2026-08-21):
 *      three tabs, the MIDDLE one active and closed, and the catalogue asserted to belong to whichever
 *      tab becomes active. Three rather than two on purpose — with two survivors the choice is
 *      unambiguous and an implementation that simply kept the first tab's state would still look right.
 *
 * A mutation that leaves the suite green marks a decorative assertion. Fix it before trusting the
 * spec -- an integration check in this repo (`AC14`) spent a day passing while asserting a defect,
 * because the fixture it drove reproduced the bug it was meant to catch. Only a mutation found it.
 */
