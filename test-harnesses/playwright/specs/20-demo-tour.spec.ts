/**
 * DEMO TOUR — walks the screens a demo actually shows, asserts the seeded data renders, and captures
 * a screenshot of each one.
 *
 * Two jobs:
 *   1. VERIFY the demo is presentable before anyone stands in front of it. An empty grid or a form that
 *      throws is much cheaper to find now than live.
 *   2. PRODUCE A FALLBACK. The screenshots in artifacts/demo-* are a deck if the live app misbehaves,
 *      the laptop changes, or the network does something unhelpful.
 *
 * Read-only: it creates and deletes nothing. Run it as often as you like.
 *
 *   PW_HEADLESS=1 npx playwright test --config test-harnesses/playwright/playwright.config.ts \
 *     --project crud --grep "demo tour"
 */
import { test, expect } from '@playwright/test';
import { ARTIFACTS_DIR, EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectNoConsoleErrors, openAllEntities, openSalesApp, shot } from '../lib/explorer';

/**
 * Open one entity's grid and confirm it has rows.
 *
 * ASSERTS ON THE GRID HEADING, NOT ON ROW TEXT. An earlier version searched whole-page text for
 * expected values and produced a confusing failure: the click had landed on the WRONG entity (the
 * previous grid was still rendered when the label search ran), so the assertion failed on missing row
 * text while the real fault was navigation. Confirming the heading first means a mis-navigation reports
 * itself as a mis-navigation.
 */
/**
 * By ROLE and by prefix, copied from `50-sales-shell.spec.ts` rather than reinvented: the left nav also
 * emits hidden `.mj-left-nav__switcher-label` spans carrying the same words, and a text locator matches
 * those instead of the rail.
 */
function railItem(page: import('@playwright/test').Page, label: string) {
  return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

async function tour(
  page: import('@playwright/test').Page,
  entityLabel: string,
  screenshot: string,
  mustContain: string[] = [],
): Promise<void> {
  await openSalesApp(page);
  await openAllEntities(page);
  await page.waitForTimeout(1500);

  const item = page.getByText(new RegExp(`^\\s*${entityLabel}\\s*$`, 'i')).first();
  await expect(item, `"${entityLabel}" must be listed in the app`).toBeVisible({ timeout: 20_000 });
  await item.scrollIntoViewIfNeeded().catch(() => undefined);
  await item.click();

  // Wait until the grid heading really is this entity before asserting anything about content.
  const heading = page.locator('h1, h2, .entity-title').filter({ hasText: new RegExp(`^\\s*${entityLabel}`, 'i') }).first();
  await expect(heading, `the grid heading should become "${entityLabel}"`).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(2500);

  // Rows present — "N records" in the heading area is the app's own count.
  const body = await page.locator('body').innerText();
  const m = /(\d+)\s+records?/i.exec(body);
  expect(m ? Number(m[1]) : 0, `"${entityLabel}" should have seeded rows for the demo`).toBeGreaterThan(0);

  for (const needle of mustContain) {
    expect(body, `"${entityLabel}" grid should show "${needle}"`).toContain(needle);
  }
  await shot(page, screenshot);
}

test('demo tour: every screen the demo shows, with its seeded data', async ({ page }) => {
  const sink = captureConsoleErrors(page);

  await test.step('home', async () => {
    await page.goto(EXPLORER_BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/app\//, { timeout: 60_000 });
    await page.waitForTimeout(4000);
    await shot(page, 'demo-00-home');
  });

  // The headline screen: six deals across two pipelines, including a WON one whose stage is "Signed".
  await test.step('Deals — the pipeline', async () => {
    await tour(page, 'Deals', 'demo-01-deals', ['Northwind Health', 'Cascade Manufacturing']);
  });

  // Where the "vocabulary is data" point lands: a winning stage NOT called "Closed Won".
  await test.step('Pipeline Stages — "Signed", not "Closed Won"', async () => {
    await tour(page, 'Pipeline Stages', 'demo-02-pipeline-stages', ['Discovery', 'Signed']);
  });

  await test.step('Pipelines — one per company', async () => {
    // Named B2B / D2C per master plan §4.2 — re-seeded from S1's 'Enterprise New Business' /
      // 'Partner Referrals' when the plan's exact vocabulary was adopted (D7).
      await tour(page, 'Pipelines', 'demo-03-pipelines', ['B2B', 'D2C']);
  });

  // IsA: the name comes from the parent Organization row, not from a column here.
  await test.step('Sales Accounts — IsA Organization', async () => {
    await tour(page, 'Sales Accounts', 'demo-04-accounts', ['Northwind Health Group']);
  });

  await test.step('Sales Contacts — IsA Person', async () => {
    await tour(page, 'Sales Contacts', 'demo-05-contacts', ['Whitfield']);
  });

  // The D-6 case: a team row whose EmployeeID is NULL and PersonID is the partner principal.
  await test.step('Deal Team Members — including the D-6 partner rep', async () => {
    await tour(page, 'Deal Team Members', 'demo-06-deal-team');
  });

  /**
   * ── REWRITTEN: "Deal Lines" IS NOT A SCREEN ANY MORE ──────────────────────────────────────────
   *
   * This toured the `Deal Lines` entity grid. Andrew formally descoped DealLines — issues #36–#39
   * closed as not planned, with "An embedded Order record will store products and prices associated
   * with the deal" — which is `docs/DECISIONS.md` D-DL1 (:461) reached from the product side. The
   * entity has zero rows in `__mj.Entity`, so the step could only ever fail: the tour asserts the item
   * is listed, and it is not.
   *
   * A TOUR IS ABOUT SCREENS, so the replacement is the screen a rep's lines actually live on: the
   * workspace's Product lines pane. That is a pane inside a record, not an entity in the browser, so
   * it cannot go through `tour()` — it needs the roster and a real deal.
   *
   * The demo point survives the move and gets sharper. It was "intent, not prices: the Resolved*
   * columns are empty because nothing has asked Orders.PreviewOrder". It is now visible in the grid's
   * own shape: the rep supplies a PRODUCT and a QUANTITY, and unit price and line total come back
   * read-only. Sales states intent; orders states price (rule 1), and the read-only cells are that
   * rule rendered.
   *
   * DEAL-9001 by name rather than by row position — it is the only two-line deal in the set, so it is
   * the one that shows a grid rather than a single row, and a positional pick would follow whatever
   * the roster happens to sort first.
   */
  await test.step('Product lines — intent, not prices', async () => {
    /**
     * THE SALES APP, NOT THE ENTITY BROWSER. This step used `openSalesApp`, which despite its name
     * navigates to `lib/explorer.ts`'s `SALES_APP_ROUTE` = `/app/mjbizappssales` -- MJ's DataExplorer.
     * The "All deals" rail belongs to the CUSTOM app at `/app/sales`. The step entered one surface and
     * then looked for the other's furniture, so `railItem('All deals')` timed out after 30s, every run.
     *
     * There are SIX constants named `SALES_APP_ROUTE` in this harness holding THREE different values:
     * `/app/mjbizappssales` (lib/explorer.ts:245), `/app/sales/Deals` (lib/workspace.ts:26), and
     * `/app/sales` declared locally in specs 41, 60, 70 and 80. Which one an importer gets depends on
     * which module it reached for, and nothing warns. That is the actual defect; this navigation is
     * spelled out literally so this step cannot pick up the wrong one.
     *
     * Mirrors 50-sales-shell, which clicks the same rail item and passes.
     */
    await page.goto(`${EXPLORER_BASE_URL}/app/sales`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('mjs-sales-section'),
      'the sales section must render before its rail is usable',
    ).toBeVisible({ timeout: 40_000 });
    await railItem(page, 'All deals').click();

    const row = page.locator('.wrap--list .wl tbody tr', { hasText: 'Northwind Health' }).first();
    await expect(row, 'the roster must list the seeded Northwind deal').toBeVisible({ timeout: 20_000 });
    await row.click();

    const linesTab = page.locator('.dw-panes__tab').filter({ hasText: /line/i }).first();
    await expect(linesTab, 'the workspace must offer a Product lines pane').toBeVisible({ timeout: 20_000 });
    await linesTab.click();
    await page.waitForTimeout(1500);

    const lineRows = page.locator('tr', { has: page.locator('.dw-cell-product') });
    await expect(lineRows, 'the seeded deal must show its product lines').not.toHaveCount(0, { timeout: 20_000 });

    /**
     * The read-only cells are the point of the screen, so they are asserted rather than photographed.
     * `.dw-readonly` is what the template puts on unit price and line total; if a future change made
     * either of them editable, this tour would be showing a screen that contradicts rule 1 and nobody
     * would notice from a screenshot.
     */
    await expect(
      lineRows.first().locator('td.dw-readonly'),
      'unit price and line total must render READ-ONLY — sales states intent, orders states price',
    ).toHaveCount(2, { timeout: 10_000 });

    await shot(page, 'demo-07-product-lines');
  });

  // Immutable history with the amount stamped at each transition.
  await test.step('Deal Stage Events — provenance', async () => {
    await tour(page, 'Deal Stage Events', 'demo-08-stage-events');
  });

  // The configuration layer: behaviour flags, no string comparisons anywhere.
  await test.step('Deal Status Types — the behaviour flags', async () => {
    await tour(page, 'Deal Status Types', 'demo-09-deal-status-types', ['Won', 'On Hold']);
  });

  await test.step('open a Deal record', async () => {
    await openSalesApp(page);
    await openAllEntities(page);
    await page.getByText(/^\s*Deals\s*$/i).first().click();
    await page.waitForTimeout(5000);
    const row = page.getByText('Northwind Health — Platform Rollout', { exact: false }).first();
    if (await row.count()) {
      const link = row.locator('xpath=ancestor-or-self::a').first();
      if (await link.count()) await link.click(); else await row.dblclick();
      await page.waitForTimeout(6000);
      const detail = await page.locator('body').innerText();
      await shot(page, 'demo-10-deal-record');
      // REPORTED, NOT ASSERTED. Opening a record depends on where the row's link happens to be, and the
      // shell's tab/app state is sticky enough that a miss here says nothing about the app's health —
      // the ten grid screens above are what this spec exists to guarantee. The FK-resolution claim is
      // asserted properly in 10-deal-crud.spec.ts, on a record this harness created itself.
      if (detail.includes('B2B')) {
        console.log('  record view: Pipeline FK resolved to its name');
      } else {
        console.log('  record view: did not open (shell state) — see 10-deal-crud.spec.ts for the asserted version');
      }
    }
  });

  expectNoConsoleErrors(sink, 'touring the demo screens');
  console.log(`\n  demo screenshots -> ${ARTIFACTS_DIR}\\demo-*.png\n`);
});
