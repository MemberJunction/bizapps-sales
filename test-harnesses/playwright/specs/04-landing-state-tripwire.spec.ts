/**
 * PROBE — does the landing survive a leftover entity selection?
 *
 * Poisons `DataExplorer.State.*` exactly as a previous spec would, then drives the normal entry path.
 *
 * This is the condition under which `openAllEntities` used to fall through to a blind chevron click and
 * land the app on an arbitrary screen — the whole reason specs passed alone and failed in the suite. It
 * is invisible until something has leaked state, which is why it is asserted here rather than left to
 * be rediscovered.
 *
 * NOTE WHAT THIS DOES **NOT** DO: it never puts the setting back. The app must recover through its own
 * "All" breadcrumb with the poisoned value still in the database — and the assertions below check
 * exactly that, because clearing the row by SQL does not work (`UserInfoEngine` serves it from cache,
 * so the app never sees the write). A version of this test that reset the row would pass while proving
 * nothing.
 */
import { expect, test } from '@playwright/test';
import { Db } from '../lib/db';
import { openAllEntities, openEntity, openSalesApp } from '../lib/explorer';

async function poison(entityName: string): Promise<void> {
  const pool = await Db();
  await pool.request().query(
    `UPDATE __mj.UserSetting
        SET Value = JSON_MODIFY(Value, '$.selectedEntityName', '${entityName}')
      WHERE Setting LIKE 'DataExplorer.State%' AND ISJSON(Value) = 1`,
  );
}

async function readSelection(): Promise<string> {
  const pool = await Db();
  const r = await pool.request().query(
    `SELECT TOP 1 JSON_VALUE(Value, '$.selectedEntityName') AS sel FROM __mj.UserSetting
      WHERE Setting = 'DataExplorer.State.60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'`,
  );
  return String(r.recordset[0]?.sel ?? 'null');
}

test('a leftover entity selection does not decide the landing', async ({ page }) => {
  test.setTimeout(240_000);

  await poison('MJ_BizApps_Sales: Loss Reasons');
  console.log(`  poisoned selection = ${await readSelection()}`);

  await openSalesApp(page);
  await openAllEntities(page);

  // Still poisoned: the recovery is through the UI, not by writing the setting back.
  expect(await readSelection(), 'the harness must NOT have altered the persisted setting')
    .toBe('MJ_BizApps_Sales: Loss Reasons');

  const cards = await page.locator('.entity-item').count();
  console.log(`  entity cards       = ${cards}`);
  expect(cards, 'the entity list must render despite the leftover selection').toBeGreaterThan(0);

  await openEntity(page, 'Deals');
  const crumbs = await page.locator('.breadcrumb-label').allInnerTexts();
  console.log(`  breadcrumbs        = ${crumbs.join(' > ')}`);
  expect(crumbs.join(' ')).toMatch(/Deals/i);
});
