/**
 * RECON — a living diagnostic, not a CRUD assertion.
 *
 * Answers "how does a user actually reach and edit this app's entities in Explorer", and keeps
 * answering it after an MJ upgrade moves things. It asserts only that the saved session works and the
 * generated Sales application opens; everything else it PRINTS, so a human (or the next agent) reads
 * the current shape of the UI instead of guessing at selectors.
 *
 * WHAT IT HAS ESTABLISHED SO FAR (2026-08-04, MJ 5.51):
 *   - authenticated shell lands on /app/home/Home
 *   - CodeGen auto-creates one MJ Application per schema; ours is at /app/mjbizappssales
 *   - opening that app AUTO-OPENS an entity grid and collapses its left rail to icons; the rail's
 *     database icon badges 19 (our entity count). The way back to the full list is the "All" breadcrumb
 *   - the entity grid is real and complete: (Default) view selector, filter box, and a toolbar with
 *     + New · Refresh · Export · Add to List · ⋮
 */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_DIR, ENTITY, EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, openAllEntities, openSalesApp, shot } from '../lib/explorer';

/** Dump every visible interactive label, for selector authoring. */
async function labels(page: import('@playwright/test').Page, selector: string): Promise<string[]> {
  const raw = await page
    .locator(selector)
    .evaluateAll((els) =>
      els
        .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 0 && t.length < 70),
    )
    .catch(() => [] as string[]);
  return [...new Set(raw)];
}

test('recon: map the route from the shell to an editable Deal', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  const report: Record<string, unknown> = { at: new Date().toISOString() };

  await page.goto(EXPLORER_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app\//, { timeout: 60_000 });
  await page.waitForTimeout(3000);
  expect(page.url(), 'saved session should land inside the app shell').toMatch(/\/app\//);
  report.landedUrl = page.url();

  // ---- the generated Sales application -------------------------------------------------------
  await openSalesApp(page);
  report.salesAppUrl = page.url();
  report.autoOpenedTitle = await page.locator('h1, h2, .entity-title').first().innerText().catch(() => '');
  await shot(page, '02-recon-sales-app');

  // ---- back to the full entity list ----------------------------------------------------------
  await openAllEntities(page);
  report.afterAllUrl = page.url();
  await shot(page, '03-recon-all-entities');

  const allLabels = await labels(page, 'a, .k-card, [role="treeitem"], [role="button"], li, .entity-card, td');
  report.entityListLabels = allLabels;
  report.salesLookingLabels = allLabels.filter((t) =>
    /deal|pipeline|sales account|sales contact|forecast|loss reason|lead source|lifecycle|buying role|account type/i.test(
      t,
    ),
  );

  // ---- open the Deals grid --------------------------------------------------------------------
  const deals = page.getByText(/^\s*Deals\s*$/i).first();
  report.dealsLabelFound = (await deals.count()) > 0;
  if (report.dealsLabelFound) {
    await deals.scrollIntoViewIfNeeded().catch(() => undefined);
    await deals.click().catch(() => undefined);
    await page.waitForTimeout(6000);
    report.dealsGridUrl = page.url();
    report.dealsGridTitle = await page.locator('h1, h2, .entity-title').first().innerText().catch(() => '');
    report.gridPresent = (await page.locator('.ag-root, kendo-grid, mj-user-view-grid, table').count()) > 0;
    report.gridRowCount = await page
      .locator('.ag-center-cols-container .ag-row, kendo-grid tbody tr')
      .count()
      .catch(() => -1);
    report.dealsToolbarButtons = await labels(page, 'button, [role="button"], a.k-button');
    await shot(page, '04-recon-deals-grid');

    // ---- open the New form, and record what it asks for ---------------------------------------
    const newBtn = page.getByRole('button', { name: /^\s*\+?\s*New\s*$/i }).first();
    report.newButtonFound = (await newBtn.count()) > 0;
    if (report.newButtonFound) {
      await newBtn.click().catch(() => undefined);
      await page.waitForTimeout(6000);
      report.newFormUrl = page.url();
      await shot(page, '05-recon-deal-new-form');

      // Field inventory: every labelled input the generated form renders.
      report.formInputs = await page
        .locator('input, select, textarea, kendo-combobox, kendo-dropdownlist, kendo-numerictextbox, kendo-datepicker')
        .evaluateAll((els) =>
          els.slice(0, 120).map((e) => {
            const el = e as HTMLElement & { name?: string; type?: string; placeholder?: string };
            return {
              tag: el.tagName.toLowerCase(),
              type: el.type ?? '',
              name: el.name ?? '',
              id: el.id ?? '',
              placeholder: el.placeholder ?? '',
              ariaLabel: el.getAttribute?.('aria-label') ?? '',
              visible: !!(el.offsetWidth || el.offsetHeight),
            };
          }),
        )
        .catch(() => []);
      report.formFieldLabels = await labels(page, 'label, .field-label, .k-label, legend');
      report.formButtons = await labels(page, 'button, [role="button"], a.k-button');
      report.formText = (await page.locator('body').innerText().catch(() => '')).slice(0, 3000);
    }
  }

  report.consoleErrors = sink.errors;
  report.targetEntity = ENTITY.Deals;

  writeFileSync(path.join(AUTH_DIR, 'recon-shell.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('\n================= RECON =================');
  console.log('sales app url     :', report.salesAppUrl);
  console.log('auto-opened       :', report.autoOpenedTitle);
  console.log('after "All"       :', report.afterAllUrl);
  console.log('sales-ish labels  :', JSON.stringify(report.salesLookingLabels));
  console.log('Deals label found :', report.dealsLabelFound);
  console.log('deals grid title  :', report.dealsGridTitle ?? '-');
  console.log('grid present      :', report.gridPresent, '| rows:', report.gridRowCount);
  console.log('toolbar buttons   :', JSON.stringify(report.dealsToolbarButtons));
  console.log('New button found  :', report.newButtonFound);
  console.log('new form url      :', report.newFormUrl ?? '-');
  console.log('form field labels :', JSON.stringify((report.formFieldLabels as string[] | undefined)?.slice(0, 60)));
  console.log('form buttons      :', JSON.stringify(report.formButtons));
  console.log('console errors    :', JSON.stringify(report.consoleErrors));
  console.log('full report       :', path.join(AUTH_DIR, 'recon-shell.json'));
  console.log('=========================================\n');
});
