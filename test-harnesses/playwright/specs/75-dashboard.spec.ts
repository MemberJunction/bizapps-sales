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
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryOne } from '../lib/db';
import { OpenWorkspace, SALES_APP_ROUTE } from '../lib/workspace';
import { EXPLORER_BASE_URL } from '../lib/env';

/** The digits of a rendered money/count string, so `$251,220` and `251220` compare equal. */
function digits(text: string | null): number {
    return Number((text ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

test.describe('dashboard — every tile against the database', () => {
    test('the four tiles, the closing-soon order, and the priced/stated distinction', async ({ page }) => {
        test.setTimeout(240_000);
        const sink = captureConsoleErrors(page);

        /**
         * THE EXPECTED NUMBERS COME FROM SQL, NOT FROM THE BRIEF.
         *
         * The baseline today is seven deals and 251,220 of open pipeline made of 213,720 priced and
         * 37,500 stated — but hardcoding those would make this spec a statement about one afternoon's
         * seed rather than about the dashboard. Computing them here means the spec still means something
         * after the seed changes, and it still catches the dashboard disagreeing with the database.
         *
         * Every predicate reads a FLAG (`IsOpen`, `IsWon`) exactly as the component does. Comparing on
         * status NAMES would pass while the app was doing the forbidden thing.
         */
        const expected = await QueryOne<{
            OpenAmount: number;
            OpenCount: number;
            TotalCount: number;
            PastDue: number;
            WonCount: number;
            PricedOpen: number;
            StatedOpen: number;
        }>(`
            SELECT
                SUM(CASE WHEN t.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)              AS OpenAmount,
                SUM(CASE WHEN t.IsOpen = 1 THEN 1 ELSE 0 END)                                AS OpenCount,
                COUNT(*)                                                                     AS TotalCount,
                SUM(CASE WHEN t.IsOpen = 1 AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS date)
                         THEN 1 ELSE 0 END)                                                  AS PastDue,
                SUM(CASE WHEN t.IsWon = 1 THEN 1 ELSE 0 END)                                 AS WonCount,
                SUM(CASE WHEN t.IsOpen = 1 AND d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                             AS PricedOpen,
                SUM(CASE WHEN t.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                             AS StatedOpen
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID`);
        expect(expected, 'the database must answer the baseline query').toBeTruthy();

        // A guard on the guard: if the host has no deals, every comparison below is 0 === 0 and the
        // spec would pass while proving nothing. That is the vacuous pass this project keeps hitting.
        expect(Number(expected!.TotalCount), 'the host needs seeded deals or this spec proves nothing')
            .toBeGreaterThan(0);
        expect(
            Number(expected!.PricedOpen),
            'the host needs at least one PRICED open deal, or the priced/stated split is untestable',
        ).toBeGreaterThan(0);
        expect(
            Number(expected!.StatedOpen),
            'and at least one STATED open deal — with only one kind present, a swapped split still passes',
        ).toBeGreaterThan(0);

        await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
        const dash = page.locator('mj-left-nav').getByRole('button', { name: /^Dashboard/i });
        await expect(dash, 'the Sales left-nav must offer Dashboard').toBeVisible({ timeout: 90_000 });
        await dash.click();

        // ── The four tiles ──────────────────────────────────────────────────
        const tile = (label: RegExp) =>
            page.locator('.sx-kpi', { hasText: label }).first().locator('.sx-kpi__value');

        const openPipeline = tile(/Open pipeline/i);
        await expect(openPipeline, 'the Open pipeline tile must render').toBeVisible({ timeout: 60_000 });

        expect(
            digits(await openPipeline.textContent()),
            'Open pipeline must equal the SUM of Amount over deals whose status carries IsOpen',
        ).toBe(Number(expected!.OpenAmount));

        expect(
            digits(await tile(/Open deals/i).textContent()),
            'Open deals must equal the COUNT of IsOpen deals',
        ).toBe(Number(expected!.OpenCount));

        expect(
            digits(await tile(/Past expected close/i).textContent()),
            'Past expected close must equal open deals whose ExpectedCloseDate has gone',
        ).toBe(Number(expected!.PastDue));

        expect(
            digits(await tile(/^Won/i).textContent()),
            'Won must equal the COUNT of deals whose status carries IsWon',
        ).toBe(Number(expected!.WonCount));

        // ── Closing soonest, IN ORDER ───────────────────────────────────────
        /**
         * ORDER IS THE ASSERTION, not membership. The list is documented as soonest-first and used to
         * rely on the roster query's ORDER BY two files away; it now sorts for itself. A spec that only
         * checked which deals appeared would pass on a reversed list.
         */
        const rowNames = await page.locator('.sx-table tbody tr td:first-child').allTextContents();
        const shown = rowNames.map((r) => r.trim()).filter(Boolean);
        expect(shown.length, 'the closing-soon table must render rows').toBeGreaterThan(0);

        const dbOrder = await QueryOne<{ Names: string }>(`
            SELECT STRING_AGG(CAST(x.Name AS nvarchar(MAX)), '||') WITHIN GROUP (ORDER BY x.rn) AS Names
              FROM (
                SELECT d.Name, ROW_NUMBER() OVER (ORDER BY d.ExpectedCloseDate ASC, d.Name ASC) rn
                  FROM __mj_BizAppsSales.Deal d
                  JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
                 WHERE t.IsOpen = 1 AND d.ExpectedCloseDate IS NOT NULL
              ) x
             WHERE x.rn <= 8`);
        const expectedOrder = (dbOrder?.Names ?? '').split('||').filter(Boolean);
        expect(shown, 'the closing-soon list must be soonest-expected-close first').toEqual(expectedOrder);

        // ── Priced versus stated must be VISIBLY different ──────────────────
        /**
         * The tag is the whole point of the tile: `Deal.Amount` is either a cached answer from orders or
         * a human's figure, and a dashboard that renders them identically is telling the reader the two
         * are the same kind of number. The count of `stated` markers must equal the count of open deals
         * carrying AmountIsComputed = 0, and it must not be zero or all of them.
         */
        const statedMarkers = await page.locator('.sx-table tbody tr .flag', { hasText: /stated/i }).count();
        const statedRows = await QueryOne<{ N: number }>(`
            SELECT COUNT(*) AS N
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
             WHERE t.IsOpen = 1 AND d.ExpectedCloseDate IS NOT NULL AND d.AmountIsComputed = 0
               AND d.ID IN (
                 SELECT TOP 8 d2.ID FROM __mj_BizAppsSales.Deal d2
                   JOIN __mj_BizAppsSales.DealStatusType t2 ON t2.ID = d2.DealStatusTypeID
                  WHERE t2.IsOpen = 1 AND d2.ExpectedCloseDate IS NOT NULL
                  ORDER BY d2.ExpectedCloseDate ASC, d2.Name ASC)`);
        expect(
            statedMarkers,
            'every hand-typed amount in the visible rows must carry the "stated" marker, and no priced one may',
        ).toBe(Number(statedRows?.N ?? -1));
        expect(statedMarkers, 'and at least one must be marked, or the distinction is invisible')
            .toBeGreaterThan(0);
        expect(
            statedMarkers,
            'but not ALL of them — a screen where everything is stated proves nothing about the cache',
        ).toBeLessThan(shown.length);

        /**
         * ZERO CONSOLE ERRORS IS PART OF THE PASS. A RunView naming a retired entity logs an error and
         * renders an empty pane, which is indistinguishable from "no data" on a dashboard made of counts.
         */
        expectNoConsoleErrors(sink, 'dashboard');
    });
});
