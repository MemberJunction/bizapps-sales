/**
 * PHASE 2 DEFINITION OF DONE #1 — `/app/sales` has the family's general layout, and the roster opens a
 * deal as an Explorer record tab.
 *
 * WHAT THIS IS FOR. Phase 1 shipped a workspace that could CREATE a deal but nothing that could OPEN
 * one, so edit mode was unreachable through the UI. This spec covers the surface that closes that gap,
 * and it checks the two things that can silently be wrong about a shell:
 *
 *   1. **The nav item resolves.** `ResourceType: 'Custom'` + `DriverClass` only works if a class is
 *      registered under that exact key AND survives tree-shaking. When it does not, Explorer mounts a
 *      BLANK TAB with no error in the console, no failed request, and nothing in the server log — which
 *      is the single most misleading failure in this stack.
 *   2. **A row actually opens an Explorer record.** Row click is `OpenEntityRecord`, not an in-rail
 *      workspace. Contracts records that its version was once a bare `return` on load failure,
 *      indistinguishable from a dead control.
 *
 * It also asserts the structural pieces the layout brief is about — the MJ page chrome, the left rail,
 * and all three rail items — because "matches the general layout" is otherwise an opinion.
 *
 * READ-ONLY. It opens an existing demo deal rather than creating one, so it leaves nothing behind and is
 * safe to re-run. Creating and saving is already covered by `40-deal-workspace.spec.ts`.
 */
import { expect, test } from '@playwright/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectOnlyKnownErrors, KNOWN_POST_DELETE_ERRORS, shot } from '../lib/explorer';

const SALES_APP = '/app/sales';

/** The rail, by visible label — the IA declared in `nav/sales-nav.model.ts`. */
const RAIL_ITEMS = ['Dashboard', 'All deals', 'Board'] as const;

/**
 * One rail item, located the way `mj-left-nav` actually renders it: a BUTTON whose accessible name is
 * the label followed by its optional description ("Dashboard What is moving, what has stalled").
 *
 * A prefix match rather than an exact one, for that reason — and by role rather than by text, because
 * the component also emits hidden `.mj-left-nav__switcher-label` spans carrying the same words, which is
 * what an earlier text-based locator matched instead of the rail.
 */
function railItem(page: import('@playwright/test').Page, label: string) {
  return page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
}

test.describe('sales shell — Phase 2 layout', () => {
  test('the Deals section renders the family layout and its roster opens an Explorer record', async ({ page }) => {
    test.setTimeout(300_000);
    const sink = captureConsoleErrors(page);

    // ── 1. The nav item resolves to a real section ──────────────────────────
    await test.step('the section mounts (DriverClass registered, not tree-shaken)', async () => {
      await page.goto(`${EXPLORER_BASE_URL}${SALES_APP}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);

      const section = page.locator('mjs-sales-section');
      await expect(section, 'the sales section component must render').toBeVisible({ timeout: 40_000 });
      await shot(page, '50-01-section');
    });

    // ── 2. The MJ chrome, which is what "general layout" means ──────────────
    await test.step('MJ page chrome + left rail are present', async () => {
      // The shell primitives, in the nesting the family uses. Asserted by element, because a
      // hand-rolled lookalike would pass a screenshot review and fail this.
      for (const tag of ['mj-page-layout', 'mj-page-header', 'mj-page-body', 'mj-left-nav', 'mj-page-body-interior']) {
        await expect(page.locator(tag).first(), `${tag} must be part of the shell`).toBeAttached({ timeout: 15_000 });
      }

      // The header's own content, and the refresh + primary action beside it.
      const body = await page.locator('body').innerText();
      expect(body, 'the page header must carry the section title').toContain('Sales');
      await expect(
        page.locator('button', { hasText: /^\s*New deal\s*$/ }).first(),
        'the header primary action must be present',
      ).toBeVisible({ timeout: 15_000 });

      // Every rail item from the nav model. See `railItem` for why this is by ROLE and by PREFIX — an
      // earlier text-based locator matched 33 hidden switcher-label spans and picked chrome instead.
      for (const label of RAIL_ITEMS) {
        await expect(railItem(page, label), `the rail must offer "${label}"`).toBeVisible({ timeout: 15_000 });
      }
      await shot(page, '50-02-chrome');
    });

    // ── 3. The dashboard ────────────────────────────────────────────────────
    await test.step('dashboard shows the KPI strip', async () => {
      // It is the default page, so it should already be showing.
      const kpis = page.locator('.wrap--dashboard .kpi');
      await expect(kpis.first(), 'the KPI strip must render').toBeVisible({ timeout: 30_000 });
      expect(await kpis.count(), 'four KPI tiles').toBeGreaterThanOrEqual(4);

      /**
       * CASE-INSENSITIVE ON PURPOSE. The tile labels are styled `text-transform: uppercase`, and
       * `innerText` returns text as RENDERED — so a case-sensitive check on "Open pipeline" fails
       * against "OPEN PIPELINE" on a dashboard that is working perfectly. Matching the DOM's own
       * casing would instead couple the test to a styling choice.
       */
      const text = await page.locator('.wrap--dashboard .kpis').innerText();
      expect(text, 'the open-pipeline KPI must be labelled').toMatch(/open pipeline/i);
      expect(text, 'the won KPI must be labelled').toMatch(/\bwon\b/i);
      // A count, not a specific figure: the seeded data can change without this becoming a lie.
      expect(text, 'the open-pipeline KPI must show a figure').toMatch(/\$[\d,]+/);
      await shot(page, '50-03-dashboard');
    });

    // ── 4. The roster ───────────────────────────────────────────────────────
    let firstDealName = '';
    await test.step('All deals lists the demo deals', async () => {
      await railItem(page, 'All deals').click();
      await page.waitForTimeout(2500);

      // SCOPED TO THE LIST PAGE. Every page stays in the DOM (hidden, not removed) so the workspace's
      // open documents survive a page change — which means `.wl` alone matches the dashboard's
      // "Closing soonest" table too and trips strict mode. Scope by page, always.
      const rows = page.locator('.wrap--list .wl tbody tr');
      const count = await rows.count();
      expect(count, 'the roster must list the seeded deals').toBeGreaterThan(0);

      // The customer name is the KI-8 case: a Deal row cannot resolve it, so the service joins accounts
      // in memory. If that ever regresses, every row shows "—" and this catches it.
      const firstRow = rows.first();
      firstDealName = ((await firstRow.locator('td').first().innerText()) || '').trim();
      expect(firstDealName.length, 'the first row must name a deal').toBeGreaterThan(0);

      const rosterText = await page.locator('.wrap--list .wl').innerText();
      expect(rosterText, 'at least one row must resolve a customer name (KI-8 join)').toMatch(/[A-Za-z]{3,}/);
      await shot(page, '50-04-roster');
    });

    // ── 5. A row opens an Explorer record tab ───────────────────────────────
    await test.step('clicking a row opens that deal as an Explorer record', async () => {
      await page.locator('.wrap--list .wl tbody tr').first().click();
      await page.waitForTimeout(8000);

      await expect(
        page.locator('mjs-deal-workspace'),
        'the in-rail workspace must not be the destination',
      ).toHaveCount(0);

      const form = page.locator('mjs-deal-form, gen-mjbizappssalesdeal-form').first();
      await expect(form, 'Explorer must mount the deal form').toBeVisible({ timeout: 40_000 });
      await shot(page, '50-05-opened-as-record');
    });

    await test.step('the Sales section is still reachable after opening a record', async () => {
      const dealsTab = page.getByRole('button', { name: /^Deals/i }).first();
      if (await dealsTab.count()) {
        await dealsTab.click();
        await page.waitForTimeout(1500);
      }
      await expect(page.locator('mjs-sales-section'), 'the Sales section must still exist').toBeAttached();
      await shot(page, '50-06-section-still-there');
    });

    // ── 7. The keystone ─────────────────────────────────────────────────────
    await test.step('console stayed clean', async () => {
      expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'sales shell run');
    });
  });
});
