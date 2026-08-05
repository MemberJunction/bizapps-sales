/**
 * DELETE-AFFORDANCE PROBE.
 *
 * Deleting a record through the generated UI turned out to be the one operation whose control could
 * not be found by inspection: the grid toolbar shows only New · Refresh · Export · Add to List · ⋮
 * even with a row selected; a `Delete` button DOES exist in the DOM but belongs to the view-management
 * panel and sits behind `.ag-viewport`, so clicking it is intercepted. This probe enumerates every
 * candidate control — with geometry, visibility and icon classes — in three states, so the CRUD spec's
 * delete step can target something real instead of another guess.
 *
 * Skipped unless PW_PROBE=1.
 */
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_DIR, DEV_COMPANY_NAME, TEST_PREFIX } from '../lib/env';
import { clickNew, openAllEntities, openSalesApp, saveForm, setField, setLookup, shot } from '../lib/explorer';

test.skip(process.env.PW_PROBE !== '1', 'diagnostic only — set PW_PROBE=1');

const NAME = `${TEST_PREFIX} DelProbe`;

/** Every button-ish element, with everything needed to decide whether it is really clickable. */
async function dumpControls(page: import('@playwright/test').Page, label: string) {
  const controls = await page
    .locator('button, [role="button"], [role="menuitem"], a.k-button, .k-menu-item')
    .evaluateAll((els) =>
      els.map((e) => {
        const el = e as HTMLElement;
        const r = el.getBoundingClientRect();
        const icons = Array.from(el.querySelectorAll('i')).map((i) => (i as HTMLElement).className);
        return {
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          title: el.getAttribute('title') ?? '',
          aria: el.getAttribute('aria-label') ?? '',
          cls: el.className?.toString().slice(0, 90) ?? '',
          icons,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          offsetParentNull: el.offsetParent === null,
        };
      }),
    )
    .catch(() => []);
  const interesting = controls.filter(
    (c) =>
      c.rect.w > 0 &&
      c.rect.h > 0 &&
      !c.offsetParentNull &&
      (/delete|remove|trash/i.test(c.text + c.title + c.aria + c.icons.join(' ')) ||
        /ellipsis|trash|times|xmark/i.test(c.icons.join(' ')) ||
        c.text.length === 0),
  );
  console.log(`\n---- ${label}: ${interesting.length} candidate(s) of ${controls.length} ----`);
  console.log(JSON.stringify(interesting, null, 1).slice(0, 4000));
  return { all: controls, interesting };
}

test('probe: locate a working Delete affordance', async ({ page }) => {
  const report: Record<string, unknown> = {};

  // A throwaway Pipeline to select and (eventually) delete.
  await openSalesApp(page);
  await openAllEntities(page);
  await page.getByText(/^\s*Pipelines\s*$/i).first().click();
  await page.waitForTimeout(5000);
  await clickNew(page);
  await setField(page, 'Name', NAME);
  await setField(page, 'Code', `${TEST_PREFIX}-DP`);
  await setLookup(page, 'Company', DEV_COMPANY_NAME);
  await saveForm(page);
  await page.waitForTimeout(2000);

  // ---- STATE A: the open record's own toolbar -------------------------------------------------
  await shot(page, '30-probe-record-view');
  report.recordViewControls = (await dumpControls(page, 'RECORD VIEW toolbar')).interesting;

  // ---- STATE B: the grid, with the row selected ----------------------------------------------
  await openSalesApp(page);
  await openAllEntities(page);
  await page.getByText(/^\s*Pipelines\s*$/i).first().click();
  await page.waitForTimeout(5000);

  const row = page.locator('tr, .ag-row, [role="row"]').filter({ hasText: NAME }).first();
  const box = row.locator('input[type="checkbox"], .ag-selection-checkbox').first();
  if (await box.count()) await box.click().catch(() => undefined);
  await page.waitForTimeout(1500);
  await shot(page, '31-probe-grid-row-selected');
  report.gridSelectedControls = (await dumpControls(page, 'GRID with row selected')).interesting;

  // ---- STATE C: after opening the ⋮ overflow --------------------------------------------------
  const kebabs = page.locator('button:has(i[class*="ellipsis"]), button:has(i[class*="vertical"])');
  report.kebabCount = await kebabs.count();
  if (report.kebabCount) {
    await kebabs.last().click({ timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
    await shot(page, '32-probe-kebab-open');
    report.kebabMenuControls = (await dumpControls(page, 'AFTER ⋮')).interesting;
    report.kebabMenuText = (await page.locator('body').innerText().catch(() => '')).slice(0, 1500);
  }

  // ---- STATE D: right-click the row (context menu?) -------------------------------------------
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(800);
  await row.click({ button: 'right' }).catch(() => undefined);
  await page.waitForTimeout(1800);
  await shot(page, '33-probe-row-context-menu');
  report.contextMenuControls = (await dumpControls(page, 'ROW RIGHT-CLICK')).interesting;

  writeFileSync(path.join(AUTH_DIR, 'recon-delete.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nfull dump -> ${path.join(AUTH_DIR, 'recon-delete.json')}\n`);
});
