/**
 * PHASE 2 DEFINITION OF DONE #1 — `/app/sales` has the family's general layout, and the roster opens a
 * deal as an Explorer record tab.
 *
 * WHAT THIS IS FOR. It checks the two things that can silently be wrong about a shell:
 *
 *   1. **The nav item resolves.** `ResourceType: 'Custom'` + `DriverClass` only works if a class is
 *      registered under that exact key AND survives tree-shaking. When it does not, Explorer mounts a
 *      BLANK TAB with no error in the console, no failed request, and nothing in the server log — which
 *      is the single most misleading failure in this stack.
 *   2. **A row actually opens an Explorer record.** Opening is `OpenEntityRecord`, rendering
 *      `mjs-deal-form` in a record tab. Contracts records that its version was once a bare `return` on
 *      load failure, indistinguishable from a dead control.
 *
 * It also asserts the structural pieces the layout brief is about — the MJ page chrome, the left rail,
 * exactly the rail items `nav/sales-nav.model.ts` declares, and the header's New deal — because
 * "matches the general layout" is otherwise an opinion.
 *
 * ── WHAT CHANGED (#88) ──────────────────────────────────────────────────────────────────────────
 *
 * The Workspace rail is gone and All deals is now MJ's `mj-entity-viewer` rather than a hand-built
 * table, so the roster steps read the viewer's grid rows. The KI-8 customer-name check went with the
 * hand-built table: the service-side account join it guarded no longer renders anything. The new
 * checks are that no Workspace item is offered and that New deal opens the Deal record form.
 *
 * READ-ONLY apart from New deal, which opens an UNSAVED form and is never saved, so it leaves nothing
 * behind and is safe to re-run. Creating and saving is covered by `70-lifecycle.spec.ts`.
 */
import { expect, test } from '@playwright/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectOnlyKnownErrors, KNOWN_POST_DELETE_ERRORS, shot } from '../lib/explorer';
import { DEAL_FORM_ROOT, DealForm, OpenNewDeal } from '../lib/deal-form';

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
      const primary = page.locator('[data-testid="sales-primary"]:visible').first();
      await expect(primary, 'the header primary action must be present').toBeVisible({ timeout: 15_000 });
      await expect(primary, 'and on the Deals section it must be New deal').toHaveText(/New deal/i);

      // Every rail item from the nav model. See `railItem` for why this is by ROLE and by PREFIX — an
      // earlier text-based locator matched 33 hidden switcher-label spans and picked chrome instead.
      for (const label of RAIL_ITEMS) {
        await expect(railItem(page, label), `the rail must offer "${label}"`).toBeVisible({ timeout: 15_000 });
      }
      // Removed in #88: records are Explorer tabs, so a rail item for an in-section workspace would
      // mount a page nothing renders.
      await expect(railItem(page, 'Workspace'), 'the rail must not offer a Workspace item').toHaveCount(0);
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
    /**
     * MJ's entity viewer, scoped to the LIST page. Every page stays in the DOM (hidden, not removed),
     * and the dashboard's Inspect card is an entity viewer too — unscoped, the rows below could be
     * Inspect's. The centre container only, because AG Grid repeats each row in its pinned containers.
     */
    const rosterRows = page.locator('.wrap--list mj-entity-viewer .ag-center-cols-container .ag-row');
    await test.step('All deals lists the demo deals', async () => {
      await railItem(page, 'All deals').click();
      await expect(rosterRows.first(), 'the roster must list the seeded deals').toBeVisible({ timeout: 30_000 });

      const firstRowText = ((await rosterRows.first().innerText()) || '').trim();
      expect(firstRowText.length, 'the first row must render its values').toBeGreaterThan(0);
      await shot(page, '50-04-roster');
    });

    // ── 5. A row opens an Explorer record tab ───────────────────────────────
    await test.step('opening a row opens that deal as an Explorer record', async () => {
      // The entity viewer opens a record on DOUBLE-click; a single click selects the row.
      await rosterRows.first().dblclick();
      await expect(DealForm(page), 'Explorer must mount the Deal record form').toBeVisible({ timeout: 40_000 });
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

    // ── 6. New deal opens the Deal record form ──────────────────────────────
    await test.step('New deal opens an unsaved Deal record form', async () => {
      await OpenNewDeal(page);
      await expect(
        page.locator(`${DEAL_FORM_ROOT}:visible`),
        'exactly one Deal form must be on screen — the new record, not a hidden tab behind it',
      ).toHaveCount(1);
      await shot(page, '50-07-new-deal');
    });

    // ── 7. The keystone ─────────────────────────────────────────────────────
    await test.step('console stayed clean', async () => {
      expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'sales shell run');
    });
  });
});
