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

  // Intent only: Resolved* columns are empty because nothing has asked Orders.PreviewOrder.
  await test.step('Deal Lines — intent, not prices', async () => {
    await tour(page, 'Deal Lines', 'demo-07-deal-lines');
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
