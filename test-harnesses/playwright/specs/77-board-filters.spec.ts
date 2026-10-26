/**
 * @fileoverview The Board reads the Dashboard's filter bar, and a selection carries over between the two
 * pages and through a copied link (bc-aidp-next-golive#351).
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────
 *
 *   1. A period and an owner picked on the Dashboard are what the Board shows on arrival.
 *   2. The Board's cards are that owner's deals in the pipeline on screen, every open one and the
 *      closed ones in the period, counted against the database rather than against the app.
 *   3. A link copied on the Board opens the Dashboard with the same selection.
 *
 * ── IT MUTATES NOTHING ──────────────────────────────────────────────────────────────────────────
 *
 * Filters live in the URL, not the database. No cleanup, nothing to leak.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * Bind the Board back to the unfiltered roster (`[Deals]="Deals"` in the section template): the card
 * count then includes other owners' deals and claim 2 fails.
 */
import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { SALES_DEALS_ROUTE } from '../lib/deal-form';
import { EXPLORER_BASE_URL } from '../lib/env';

/** The rail button for a Sales page. */
function railButton(page: Page, name: RegExp) {
    return page.locator('mj-left-nav').getByRole('button', { name });
}

/** A filter list's button inside the visible page. */
function filterButton(page: Page, wrap: string, testid: string) {
    return page.locator(`${wrap} [data-testid="${testid}"] .mj-filter-popover-trigger`);
}

test.describe('board — the shared filter bar (bc-aidp-next-golive#351)', () => {
    test('a Dashboard selection reaches the Board, the cards match it, and a copied link carries it', async ({ page, context }) => {
        test.setTimeout(240_000);
        const sink = captureConsoleErrors(page);

        // An owner with an open deal, while another owner also has one: otherwise the owner filter
        // narrows nothing and claim 2 holds for an unfiltered Board too.
        const owner = await QueryOne<{ OwnerEmployeeID: string; OwnerName: string; Others: number }>(`
            SELECT TOP 1 d.OwnerEmployeeID, LTRIM(RTRIM(CONCAT(e.FirstName, ' ', e.LastName))) AS OwnerName,
                   (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal o
                      JOIN __mj_BizAppsSales.DealStatusType ot ON ot.ID = o.DealStatusTypeID
                     WHERE ot.IsOpen = 1 AND ISNULL(o.OwnerEmployeeID, '00000000-0000-0000-0000-000000000000') <> d.OwnerEmployeeID) AS Others
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
              JOIN __mj.Employee e ON e.ID = d.OwnerEmployeeID
             WHERE t.IsOpen = 1
             GROUP BY d.OwnerEmployeeID, e.FirstName, e.LastName
             ORDER BY COUNT(*) DESC`);
        expect(owner, 'the host needs an open deal with an owner').toBeTruthy();
        expect(Number(owner!.Others), 'and an open deal owned by someone else, or the filter proves nothing').toBeGreaterThan(0);

        // ── 1. Pick on the Dashboard ─────────────────────────────────────
        await page.goto(`${EXPLORER_BASE_URL}${SALES_DEALS_ROUTE}`, { waitUntil: 'domcontentloaded' });
        await expect(railButton(page, /^Dashboard/i), 'the Sales rail must offer Dashboard').toBeVisible({ timeout: 90_000 });
        await railButton(page, /^Dashboard/i).click();

        await page.locator('.wrap--dashboard [data-testid="sales-period"]').selectOption('alltime');
        await filterButton(page, '.wrap--dashboard', 'sales-filter-owner').click();
        await page.locator('.cdk-overlay-container label.filterlist__item').filter({ hasText: owner!.OwnerName }).first().click();
        await page.keyboard.press('Escape');
        await expect(filterButton(page, '.wrap--dashboard', 'sales-filter-owner'), 'the owner list names the pick')
            .toContainText(owner!.OwnerName, { timeout: 30_000 });

        // ── 2. The Board shows the same selection, and that owner's deals ─
        await railButton(page, /^Board/i).click();
        await expect(page.locator('.wrap--board [data-testid="sales-period"]'), 'the period carried over').toHaveValue('alltime');
        await expect(filterButton(page, '.wrap--board', 'sales-filter-owner'), 'the owner carried over').toContainText(owner!.OwnerName);
        await expect(page.locator('.wrap--board [data-testid="sales-board-scope"]')).toHaveText('Open deals, and every closed deal');

        // The pipeline on screen: the selected tab, or the one name shown when only one is allowed.
        const tab = page.locator('.wrap--board [data-testid="db-pipeline-tabs"] [aria-selected="true"]');
        const one = page.locator('.wrap--board [data-testid="db-pipeline-one"]');
        await expect(tab.or(one).first(), 'the Board names its pipeline').toBeVisible({ timeout: 60_000 });
        const shown = ((await tab.count()) ? await tab.textContent() : await one.textContent())?.trim() ?? '';

        const pipelines = await QueryAll<{ ID: string; Label: string; Name: string }>(`
            SELECT p.ID, p.Name, CONCAT(p.Name, ' (', c.Name, ')') AS Label
              FROM __mj_BizAppsSales.Pipeline p
              LEFT JOIN __mj.Company c ON c.ID = p.CompanyID`);
        const pipeline = pipelines.find((p) => p.Label === shown) ?? pipelines.find((p) => p.Name === shown);
        expect(pipeline, `the tab "${shown}" names a pipeline`).toBeTruthy();

        // Every deal of the owner on that pipeline that has a stage. All time bounds no closed deal.
        const expected = await QueryOne<{ Cards: number }>(`
            SELECT COUNT(*) AS Cards
              FROM __mj_BizAppsSales.Deal d
             WHERE d.OwnerEmployeeID = '${owner!.OwnerEmployeeID}'
               AND d.PipelineID = '${pipeline!.ID}'
               AND d.PipelineStageID IS NOT NULL`);
        await expect(page.locator('.wrap--board .db-cols .db-card'), "the cards are the owner's deals on this pipeline")
            .toHaveCount(Number(expected!.Cards), { timeout: 30_000 });

        // ── 3. A link copied on the Board opens the Dashboard the same way ─
        const link = page.url();
        expect(link, 'the owner is in the address').toContain(`owners=${owner!.OwnerEmployeeID}`);
        const second = await context.newPage();
        await second.goto(link, { waitUntil: 'domcontentloaded' });
        await expect(second.locator('.wrap--board [data-testid="sales-period"]')).toHaveValue('alltime', { timeout: 90_000 });
        await railButton(second, /^Dashboard/i).click();
        await expect(filterButton(second, '.wrap--dashboard', 'sales-filter-owner')).toContainText(owner!.OwnerName);
        await expect(second.locator('.wrap--dashboard [data-testid="sales-period"]')).toHaveValue('alltime');
        await second.close();

        expectNoConsoleErrors(sink, 'board filters');
    });
});
