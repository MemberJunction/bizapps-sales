/**
 * DEMO SETUP — configure the grid columns that make each demo screen say something, through the UI.
 *
 * WHY THROUGH THE UI. Seeding this from SQL does not work: `__mj.UserView.GridState.columnSettings`,
 * `__mj.UserApplicationEntity` and `__mj.UserFavorite` were all tried and all left the grid unchanged,
 * even after restarting MJAPI to clear its metadata cache. MJ owns this state client-side. Driving the
 * real "Configure View" panel is therefore the only reliable route — and it persists, so this runs once.
 *
 * WHAT IT FIXES. Out of the box the Deals grid shows two columns and renders as though it has one:
 * six rows of truncated "Northwind Health…" with nothing to look at. The columns below are chosen so
 * each screen carries its argument:
 *
 *   Deals             — Stage, Status, Amount, Prob, Forecast, Close, Owner, Company, Pipeline
 *   Pipeline Stages   — the stage's Deal Status Type, which is THE point: "Signed" is a label, and
 *                       won-ness lives in the status it points at
 *   Deal Team Members — Employee AND Person side by side, so D-6's exactly-one-of is visible
 *   Deal Lines        — Quantity + Requested Discount + the EMPTY Resolved columns, which is how
 *                       "sales never computes money" looks as data
 *
 * Idempotent: a column already visible is skipped. Safe to re-run.
 */
import { test, expect } from '@playwright/test';
import { openAllEntities, openSalesApp, shot } from '../lib/explorer';

/** Columns to make visible, in the order they should read left-to-right. */
const SETUP: Array<{ entity: string; columns: string[] }> = [
  {
    entity: 'Deals',
    columns: ['Pipeline Stage', 'Amount', 'Probability', 'Forecast Category Type',
              'Expected Close Date', 'Owner Employee', 'Company', 'Pipeline'],
  },
  {
    entity: 'Pipeline Stages',
    columns: ['Pipeline', 'Display Order', 'Deal Status Type', 'Probability',
              'Forecast Category Type', 'Rotting Days'],
  },
  {
    entity: 'Deal Team Members',
    columns: ['Deal', 'Deal Role', 'Employee', 'Person ID', 'Attribution Pct'],
  },
  /**
   * `Deal Lines` WAS SET UP HERE AND IS DELIBERATELY GONE.
   *
   * Andrew closed issues #36-#39 as not planned — "An embedded Order record will store products and
   * prices associated with the deal" — which is `docs/DECISIONS.md` D-DL1 (:461) reached from the
   * product side. The entity has no rows in `__mj.Entity`, so it is not listed in the app and this
   * step could only ever fail.
   *
   * The demo point it carried is NOT lost, and that is worth being explicit about, because it was the
   * sharpest one here: signed figures sitting beside EMPTY Resolved* columns is what "sales never
   * computes money" looks like as data. That contrast now lives on the workspace's Product lines pane,
   * where unit price and line total render READ-ONLY, and `20-demo-tour` tours it there.
   */
  {
    // The exception payment schedule. Only DEAL-9001 has rows, which IS the point — no rows means
    // standard terms, so "did this deal negotiate payment terms?" is a row count.
    entity: 'Deal Payment Schedules',
    columns: ['Deal', 'Payment Date', 'Amount', 'Description', 'Display Order'],
  },
  /**
   * `Deal Line Types` IS GONE FOR THE SAME REASON `Deal Lines` IS, and it outlived it by four days.
   *
   * The note above removed the parent entity when D-DL1 retired it, and left the type table behind.
   * `DealLineType` was retired in the SAME commit (`0d3d1ed`) -- it has no table and no `__mj.Entity`
   * row, so this step asked the app to list an entity that does not exist and could only ever fail.
   * It did, every run, as `"Deal Line Types" must be listed`, and read as a demo-setup problem rather
   * than as a leftover.
   *
   * There is no demo point to relocate. The type table only ever classified DealLine rows as one-time
   * or recurring; nothing routes by line kind any more (see close-deal.checks.ts:138), and the
   * embedded order carries its own product lines.
   */
  {
    entity: 'Deal Stage Events',
    columns: ['Deal', 'Changed At', 'Amount At Transition', 'Probability At Transition',
              'Days In Previous Stage'],
  },
  {
    entity: 'Deal Status Types',
    columns: ['Code', 'Is Open', 'Is Closed', 'Is Won', 'Is Lost', 'Locks Deal'],
  },
];

/** Every "Show column" button currently offered, paired with the column name it reveals. */
async function hiddenColumns(page: import('@playwright/test').Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter((b) =>
        (b.getAttribute('title') ?? '').toLowerCase().includes('show column'),
      );
      return btns.map((b) => {
        let node: HTMLElement | null = b as HTMLElement;
        for (let i = 0; i < 5 && node; i++) {
          const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t && t.length > 1 && t.length < 60) return t;
          node = node.parentElement;
        }
        return '';
      });
    })
    .catch(() => [] as string[]);
}

test('demo setup: give every demo grid the columns that make its point', async ({ page }) => {
  test.setTimeout(600_000);

  for (const { entity, columns } of SETUP) {
    await test.step(entity, async () => {
      await openSalesApp(page);
      await openAllEntities(page);
      const item = page.getByText(new RegExp(`^\\s*${entity}\\s*$`, 'i')).first();
      await expect(item, `"${entity}" must be listed`).toBeVisible({ timeout: 20_000 });
      await item.click();
      await page.waitForTimeout(4500);

      // Open Configure View.
      const gear = page
        .locator('button[title*="Configure view settings" i], .vs-icon-btn:has(i.fa-sliders-h)')
        .first();
      await expect(gear, `${entity}: the view-settings gear must be present`).toBeVisible({ timeout: 15_000 });
      await gear.click();
      await page.waitForTimeout(2500);

      // Reveal each wanted column. RE-QUERY EVERY TIME: revealing one moves it from HIDDEN to VISIBLE,
      // which reshuffles the button list, so a cached index would click the wrong row.
      const added: string[] = [];
      const missing: string[] = [];
      for (const col of columns) {
        const labels = await hiddenColumns(page);
        const idx = labels.findIndex((l) => l === col);
        if (idx < 0) { missing.push(col); continue; }   // already visible, or not offered
        await page.locator('button[title*="Show column" i]').nth(idx).click({ timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(700);
        added.push(col);
      }

      /**
       * SAVE — and take the FOOTER Save specifically.
       *
       * The Configure View panel contains several controls whose accessible name is "Save" (the columns
       * footer, and the aggregate editor). An earlier version took `.first()`, clicked something inert,
       * and left the panel open with the grid unchanged — while still logging every column as "added",
       * because adding to the panel's model and persisting the view are different things. The footer
       * button is the lowest visible one.
       */
      // Matched on TEXT CONTENT, not accessible role-name: the footer button carries a save icon, which
      // perturbs its computed accessible name enough that `getByRole('button', {name: /^Save$/})` found
      // nothing at all — while the button sat plainly visible in the panel footer. Excludes the
      // neighbouring "Save As My Copy" / "Save Changes" controls.
      const saves = page
        .locator('button')
        .filter({ hasText: /\bSave\b/ })
        .filter({ hasNotText: /As My Copy|Changes|Aggregate/i });
      let footerSave: import('@playwright/test').Locator | null = null;
      let lowest = -1;
      for (let i = 0; i < (await saves.count()); i++) {
        const b = saves.nth(i);
        if (!(await b.isVisible().catch(() => false))) continue;
        const box = await b.boundingBox().catch(() => null);
        if (box && box.y > lowest) { lowest = box.y; footerSave = b; }
      }
      expect(footerSave, `${entity}: a visible Save must exist in the Configure View footer`).not.toBeNull();
      await footerSave!.click({ timeout: 10_000 });
      await page.waitForTimeout(3500);

      // Some builds ask whether to update a shared view or fork a copy — take the shared update.
      const shared = page.getByRole('button', { name: /Update Shared View/i }).first();
      if ((await shared.count()) && (await shared.isVisible().catch(() => false))) {
        await shared.click({ timeout: 8000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
      }

      // NOT asserting the panel closed. A `getByText(/Configure View/i)` check reported the panel still
       // visible on a run where the screenshot showed it plainly gone and the columns correctly applied —
      // the phrase survives elsewhere in the DOM. The column assertion below is the real proof, so this
      // just waits for the grid to settle.
      await page.waitForTimeout(3000);

      // PROVE IT. Assert the new columns are in the grid header, not merely that we clicked things.
      const body = await page.locator('body').innerText();
      const notShowing = added.filter((c) => !body.includes(c));
      expect(
        notShowing,
        `${entity}: these columns were added but are not in the grid after saving: ${notShowing.join(', ')}`,
      ).toEqual([]);

      await shot(page, `50-setup-${entity.toLowerCase().replace(/\s+/g, '-')}`);
      console.log(`  ${entity}: ${added.length} column(s) now visible [${added.join(', ')}]${missing.length ? `  |  not offered: [${missing.join(', ')}]` : ''}`);
    });
  }
});
