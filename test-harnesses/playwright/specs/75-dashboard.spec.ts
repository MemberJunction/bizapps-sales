/**
 * @fileoverview The Sales dashboard, asserted against the DATABASE rather than against itself.
 *
 * ── WHY A READ-ONLY SPEC IS WORTH ITS PLACE ─────────────────────────────────────────────────────
 *
 * Every number on this surface is a rollup, and a rollup is the easiest thing in the app to get
 * plausibly wrong: an open-pipeline figure that double-counts, a "past expected close" that reads zero
 * because a filter compares a DATE to a datetime, a priced/stated split that is uniform because the
 * seed made both columns the same. None of those look like failures on screen — they look like numbers.
 *
 * So every tile is compared to SQL computed independently of the app, in this file, from the flags the
 * app claims to branch on. If the app and the query disagree, one of them is wrong and the spec says
 * which values differed.
 *
 * ── IT MUTATES NOTHING ──────────────────────────────────────────────────────────────────────────
 *
 * No cleanup, no rollback, nothing to leak. That is deliberate: the demo host has had test rows leak
 * into it twice, and a spec that only reads cannot be the third.
 *
 * ── HOW TO MAKE IT FAIL, to prove it is not vacuous ─────────────────────────────────────────────
 *
 *   UPDATE __mj_BizAppsSales.Deal SET Amount = Amount + 1 WHERE DealNumber = 'DEAL-9001';
 *
 * The client tile and the SQL disagree by 1 and the first assertion fails. Undo it afterwards.
 *
 * ── WHAT THIS SPEC OWNS OF THE PERIOD, AND WHAT IT DOES NOT ─────────────────────────────────────
 *
 * The period bounds every tile (bc-aidp-next-golive#350): Won on the day a win closed, the open
 * figures on the day each open deal is expected to close. Two different claims come out of that:
 *
 *   "the window is computed correctly"   — boundary arithmetic over fiscal starts, leap years and
 *                                          clamped month ends. Owned by `dashboard-period.test.ts`.
 *   "each tile filters by the window     — owned HERE, because only the real surface can be wrong
 *    it claims, on its own date"           about it.
 *
 * So this spec reads the window the dashboard PRINTS beside its Period dropdown and holds the database
 * to it, rather than re-deriving the fiscal quarter (two implementations agreeing with each other is
 * the weakest agreement available). Then it selects All time and holds the tiles to the whole book.
 */
import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryOne } from '../lib/db';
import { SALES_DEALS_ROUTE } from '../lib/deal-form';
import { EXPLORER_BASE_URL } from '../lib/env';

/** The digits of a rendered money/count string, so `$251,220` and `251220` compare equal. */
function digits(text: string | null): number {
    return Number((text ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The window the dashboard says it used: `Jul 1, 2026 – Sep 30, 2026`, the shape every Sales date
 * uses. Null for "all time" is the point: an unbounded period must produce no bounds.
 */
function parseWindow(text: string | null): { Start: string; End: string } | null {
    const match = (text ?? '').match(/(\w{3}) (\d{1,2}), (\d{4})\s*[–-]\s*(\w{3}) (\d{1,2}), (\d{4})/);
    if (!match) {
        return null;
    }
    const iso = (month: string, day: string, year: string): string => {
        const index = MONTHS.indexOf(month);
        expect(index, `the window named a month this spec does not recognise: "${month}"`).toBeGreaterThan(-1);
        return `${year}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return { Start: iso(match[1], match[2], match[3]), End: iso(match[4], match[5], match[6]) };
}

/** A tile, matched on its LABEL element: a footnote naming another tile cannot match it. */
function tile(page: Page, label: RegExp) {
    return page
        .locator('.wrap--dashboard .kpi')
        .filter({ has: page.locator('.l').filter({ hasText: label }) })
        .first();
}

/** The tile figures the database should produce for a window, or for the whole book with null. */
async function expectedFigures(window: { Start: string; End: string } | null) {
    const openIn = window
        ? `AND d.ExpectedCloseDate >= '${window.Start}' AND d.ExpectedCloseDate <= '${window.End}'`
        : '';
    const wonIn = window ? `AND d.ActualCloseDate >= '${window.Start}' AND d.ActualCloseDate <= '${window.End}'` : '';
    // Every predicate reads a FLAG, as the app does; open deals in pipelines flagged out of the
    // forecast and Omitted categories are left out of the money, as dashboard-summary.sql leaves them.
    return QueryOne<{ OpenAmount: number; CommitAmount: number; WonAmount: number; WonCount: number; PastDue: number; TotalCount: number; PricedOpen: number; StatedOpen: number }>(`
        SELECT
            SUM(CASE WHEN t.IsOpen = 1 AND t.IsWon = 0 AND p.IncludeInForecast = 1 AND ISNULL(fc.IncludeInPipeline, 1) = 1 ${openIn}
                     THEN ISNULL(d.Amount, 0) ELSE 0 END)                                         AS OpenAmount,
            SUM(CASE WHEN t.IsOpen = 1 AND t.IsWon = 0 AND p.IncludeInForecast = 1 AND ISNULL(fc.IncludeInPipeline, 1) = 1
                      AND fc.IncludeInCommit = 1 ${openIn}
                     THEN ISNULL(d.Amount, 0) ELSE 0 END)                                         AS CommitAmount,
            SUM(CASE WHEN t.IsWon = 1 ${wonIn} THEN ISNULL(d.Amount, 0) ELSE 0 END)                AS WonAmount,
            SUM(CASE WHEN t.IsWon = 1 ${wonIn} THEN 1 ELSE 0 END)                                 AS WonCount,
            -- The business day, as dashboard-summary.sql reads it (golive#168), and never the period.
            SUM(CASE WHEN t.IsOpen = 1 AND p.IncludeInForecast = 1 AND d.ExpectedCloseDate < bt.Today
                     THEN 1 ELSE 0 END)                                                           AS PastDue,
            COUNT(*)                                                                              AS TotalCount,
            SUM(CASE WHEN t.IsOpen = 1 AND d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PricedOpen,
            SUM(CASE WHEN t.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS StatedOpen
          FROM __mj_BizAppsSales.Deal d
          JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
          JOIN __mj_BizAppsSales.Pipeline p ON p.ID = d.PipelineID
          LEFT JOIN __mj_BizAppsSales.ForecastCategoryType fc ON fc.ID = d.ForecastCategoryTypeID
          CROSS JOIN __mj_BizAppsCommon.fnBusinessToday() AS bt`);
}

/** The Needs attention row for Past close date: its count. */
function pastDueCount(page: Page) {
    return page.locator('.wrap--dashboard .queue').filter({ hasText: /Past close date/i }).first().locator('.qcount');
}

test.describe('dashboard — every tile against the database', () => {
    test('the tiles under this quarter and under All time, and the Won list', async ({ page }) => {
        test.setTimeout(240_000);
        const sink = captureConsoleErrors(page);

        const book = await expectedFigures(null);
        expect(book, 'the database must answer the baseline query').toBeTruthy();
        // A guard on the guard: with no deals every comparison below is 0 === 0 and proves nothing.
        expect(Number(book!.TotalCount), 'the host needs seeded deals or this spec proves nothing').toBeGreaterThan(0);
        expect(Number(book!.PricedOpen), 'the host needs a PRICED open deal').toBeGreaterThan(0);
        expect(Number(book!.StatedOpen), 'and a STATED open deal — with one kind only, a swapped split still passes').toBeGreaterThan(0);
        expect(Number(book!.WonCount), 'the host needs at least one WON deal or the Won tile proves nothing').toBeGreaterThan(0);

        await page.goto(`${EXPLORER_BASE_URL}${SALES_DEALS_ROUTE}`, { waitUntil: 'domcontentloaded' });
        const dash = page.locator('mj-left-nav').getByRole('button', { name: /^Dashboard/i });
        await expect(dash, 'the Sales left-nav must offer Dashboard').toBeVisible({ timeout: 90_000 });
        await dash.click();

        const period = page.locator('.wrap--dashboard [data-testid="sales-period"]');
        await expect(period, 'the dashboard must land on This quarter').toHaveValue('quarter', { timeout: 60_000 });
        const claimed = parseWindow(await page.locator('.wrap--dashboard [data-testid="sales-period-window"]').textContent());
        expect(claimed, 'the filter bar must state the window it counted, not just a period name').toBeTruthy();

        // ── This quarter: each tile on its own date ──────────────────────
        const quarter = await expectedFigures(claimed);
        const value = (label: RegExp) => tile(page, label).locator('.v');
        await expect(value(/^Open pipeline$/i), 'the Open pipeline tile must render').toBeVisible({ timeout: 60_000 });
        expect(digits(await value(/^Open pipeline$/i).textContent()), 'Open pipeline: open pipeline deals expected to close in the window')
            .toBe(Number(quarter!.OpenAmount));
        expect(digits(await value(/^Commit$/i).textContent()), 'Commit: Commit deals expected to close in the window')
            .toBe(Number(quarter!.CommitAmount));
        expect(digits(await value(/^Won$/i).textContent()), `Won: wins closed in ${claimed!.Start}..${claimed!.End}`)
            .toBe(Number(quarter!.WonAmount));
        expect(digits(await pastDueCount(page).textContent()), 'Past close date is about today, not the period')
            .toBe(Number(book!.PastDue));

        // ── The Won tile lists the deals it counted ──────────────────────
        await tile(page, /^Won$/i).click();
        await expect(page.locator('.wrap--dashboard [data-testid="sales-inspect-chip"]'), 'the Won list must say how many it shows')
            .toHaveText(new RegExp(`Showing won deals · ${Number(quarter!.WonCount)}$`), { timeout: 30_000 });
        await expect(tile(page, /^Won$/i), 'the clicked tile carries the selected style').toHaveAttribute('aria-pressed', 'true');

        // ── All time: the whole book ─────────────────────────────────────
        await period.selectOption('alltime');
        await expect(value(/^Open pipeline$/i), 'Open pipeline under All time is the whole open book')
            .toHaveText(new RegExp(Number(book!.OpenAmount).toLocaleString('en-US')), { timeout: 30_000 });
        expect(digits(await value(/^Won$/i).textContent()), 'Won under All time is every win').toBe(Number(book!.WonAmount));
        expect(
            parseWindow(await page.locator('.wrap--dashboard [data-testid="sales-period-window"]').textContent()),
            'All time must be UNBOUNDED — two dates would mean it is still filtering',
        ).toBeNull();
        expect(digits(await pastDueCount(page).textContent()), 'Past close date does not move with the period')
            .toBe(Number(book!.PastDue));

        // The deal list is MJ's entity viewer, not a hand-rolled table.
        await expect(page.locator('.wrap--dashboard mj-entity-viewer').first(), 'the deal list must be mj-entity-viewer')
            .toBeVisible({ timeout: 30_000 });

        /**
         * ZERO CONSOLE ERRORS IS PART OF THE PASS. A RunView naming a retired entity logs an error and
         * renders an empty pane, which is indistinguishable from "no data" on a dashboard made of counts.
         */
        expectNoConsoleErrors(sink, 'dashboard');
    });
});
