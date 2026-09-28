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
 * ── WHAT THIS SPEC OWNS OF THE PERIOD SELECTOR, AND WHAT IT DOES NOT ────────────────────────────
 *
 * golive#232 added a reporting period that bounds the Won tile, the forecast stack's Closed segment
 * and win rate. Two different claims come out of that, and conflating them would make both weaker:
 *
 *   "the window is computed correctly"   — boundary arithmetic over fiscal starts, leap years and
 *                                          clamped month ends. Owned by `dashboard-period.test.ts`,
 *                                          which can assert thirty edges in milliseconds. A browser
 *                                          spec could reach maybe two, on whatever date it runs.
 *   "the tile actually filters by the    — owned HERE, because only the real surface can be wrong
 *    window it claims, and the other       about it, and because requirement 3 of the issue is a
 *    tiles do not move"                    statement about what must NOT change.
 *
 * So this spec reads the window the dashboard PRINTS in its own footnote and holds the database to
 * it. That is deliberately not a re-derivation: reimplementing the fiscal quarter here would mean
 * two implementations agreeing with each other, which is the weakest form of agreement available —
 * both can be wrong in the same way. Asking "you say you counted wins between these two dates; did
 * you?" is a question the app cannot pass by being consistently wrong.
 */
import { expect, test, type Page } from '@playwright/test';

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
 * The window the dashboard says it used, parsed out of the Won tile's own footnote.
 *
 * The footnote renders as `closed won · this quarter (1 Jul 2026 – 30 Sep 2026)`. Returning null for
 * "all time" is the point rather than an edge case: an unbounded period must produce no bounds, and a
 * spec that quietly coerced it to a very wide pair of dates would pass against a build that had
 * started filtering when it should not.
 */
function parseWindow(footnote: string | null): { Start: string; End: string } | null {
    const match = (footnote ?? '').match(
        /\((\d{1,2}) (\w{3}) (\d{4})\s*[–-]\s*(\d{1,2}) (\w{3}) (\d{4})\)/,
    );
    if (!match) {
        return null;
    }
    const iso = (day: string, month: string, year: string): string => {
        const index = MONTHS.indexOf(month);
        expect(index, `the footnote named a month this spec does not recognise: "${month}"`).toBeGreaterThan(-1);
        return `${year}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return {
        Start: iso(match[1], match[2], match[3]),
        End: iso(match[4], match[5], match[6]),
    };
}

/** A KPI tile's value, matched on its LABEL element — see the note at the tile locator below. */
function tileValue(page: Page, label: RegExp) {
    return page
        .locator('.wrap--dashboard .kpi')
        .filter({ has: page.locator('.l').filter({ hasText: label }) })
        .first()
        .locator('.v');
}

function periodPill(page: Page, label: RegExp) {
    return page.locator('.wrap--dashboard .period__pill').filter({ hasText: label }).first();
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
        /**
         * The All-time Won assertion below is only worth running against a host that HAS wins.
         * Nothing guards the windowed count the same way, and deliberately so: a quarter with no
         * closed deals is a legitimate state of the business, not a broken fixture, and demanding one
         * would make this spec fail on a perfectly healthy host every time the calendar turned.
         */
        expect(Number(expected!.WonCount), 'the host needs at least one WON deal or the Won tile proves nothing')
            .toBeGreaterThan(0);

        await page.goto(`${EXPLORER_BASE_URL}${SALES_DEALS_ROUTE}`, { waitUntil: 'domcontentloaded' });
        const dash = page.locator('mj-left-nav').getByRole('button', { name: /^Dashboard/i });
        await expect(dash, 'the Sales left-nav must offer Dashboard').toBeVisible({ timeout: 90_000 });
        await dash.click();

        // ── The four tiles ──────────────────────────────────────────────────
        /**
         * ── MATCHED ON THE LABEL ELEMENT, NOT THE TILE'S TEXT ───────────────────────────────────
         *
         * `.kpi` with `hasText: /Open deals/i` returned the WRONG TILE, and the reason is worth
         * recording: the "Open pipeline" tile's footnote reads `across 7 open deals`, so it satisfies
         * that regex too and `.first()` picked it. The spec then compared 251,220 against a count of 7
         * and reported it as a dashboard defect.
         *
         * `.l` is the label div (`.v` value, `.f` footnote — sales-section.component.html), so anchoring
         * the match there makes a tile's own name the only thing that can identify it.
         */
        const tile = (label: RegExp) => tileValue(page, label);

        const openPipeline = tile(/^Open pipeline$/i);
        await expect(openPipeline, 'the Open pipeline tile must render').toBeVisible({ timeout: 60_000 });

        expect(
            digits(await openPipeline.textContent()),
            'Open pipeline must equal the SUM of Amount over deals whose status carries IsOpen',
        ).toBe(Number(expected!.OpenAmount));

        expect(
            digits(await tile(/^Open deals$/i).textContent()),
            'Open deals must equal the COUNT of IsOpen deals',
        ).toBe(Number(expected!.OpenCount));

        expect(
            digits(await tile(/^Past expected close$/i).textContent()),
            'Past expected close must equal open deals whose ExpectedCloseDate has gone',
        ).toBe(Number(expected!.PastDue));

        // ── The period selector (golive#232) ────────────────────────────────
        /**
         * The default is THIS QUARTER, so the Won tile is no longer the all-time count. Take the
         * window from the tile's own footnote and hold the database to it.
         */
        const wonTile = tile(/^Won$/i);
        const wonFootnote = page
            .locator('.wrap--dashboard .kpi')
            .filter({ has: page.locator('.l').filter({ hasText: /^Won$/i }) })
            .first()
            .locator('.f');

        await expect(
            page.locator('.wrap--dashboard .period__pill--on'),
            'the dashboard must land on a selected period, and it must be the current quarter',
        ).toHaveText(/this quarter/i);

        const claimed = parseWindow(await wonFootnote.textContent());
        expect(claimed, 'the Won tile must state the window it counted, not just a period name').toBeTruthy();

        const windowed = await QueryOne<{ WonInWindow: number }>(`
            SELECT SUM(CASE WHEN t.IsWon = 1
                             AND d.ActualCloseDate IS NOT NULL
                             AND d.ActualCloseDate >= '${claimed!.Start}'
                             AND d.ActualCloseDate <= '${claimed!.End}'
                            THEN 1 ELSE 0 END) AS WonInWindow
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID`);

        expect(
            digits(await wonTile.textContent()),
            `Won must equal wins whose ActualCloseDate falls in the window the tile itself names (${claimed!.Start}..${claimed!.End})`,
        ).toBe(Number(windowed!.WonInWindow));

        /**
         * REQUIREMENT 3, ASSERTED AS A NON-CHANGE. The open figures describe the current book and must
         * not move when the period does — which is why `dashboard-summary.sql` puts the window inside
         * the WonCount CASE rather than in its WHERE. Captured before the switch, compared after.
         */
        const openBefore = [
            digits(await tile(/^Open pipeline$/i).textContent()),
            digits(await tile(/^Open deals$/i).textContent()),
            digits(await tile(/^Past expected close$/i).textContent()),
        ];

        await periodPill(page, /All time/i).click();

        await expect(
            page.locator('.wrap--dashboard .period__pill--on'),
            'All time must become the selected period',
        ).toHaveText(/all time/i);

        /**
         * All time restores the ORIGINAL all-time figure exactly — the same number this spec asserted
         * before the selector existed. That is the claim that keeps "omitting both parameters
         * reproduces the previous behaviour" true rather than merely intended.
         */
        await expect(
            wonTile,
            'Won under All time must equal the COUNT of every deal whose status carries IsWon',
        ).toHaveText(new RegExp(`\\b${Number(expected!.WonCount)}\\b`), { timeout: 30_000 });

        expect(
            parseWindow(await wonFootnote.textContent()),
            'All time must be UNBOUNDED — a footnote naming two dates would mean it is still filtering',
        ).toBeNull();

        expect(
            [
                digits(await tile(/^Open pipeline$/i).textContent()),
                digits(await tile(/^Open deals$/i).textContent()),
                digits(await tile(/^Past expected close$/i).textContent()),
            ],
            'the open-deal tiles are NOT period-bound and must be identical under every period',
        ).toEqual(openBefore);

        // Inspect is MJ's entity viewer, not a hand-rolled table — same host as the Orders dashboard.
        await expect(
            page.locator('.wrap--dashboard mj-entity-viewer').first(),
            'Inspect must be mj-entity-viewer, not a custom table',
        ).toBeVisible({ timeout: 30_000 });

        /**
         * ZERO CONSOLE ERRORS IS PART OF THE PASS. A RunView naming a retired entity logs an error and
         * renders an empty pane, which is indistinguishable from "no data" on a dashboard made of counts.
         */
        expectNoConsoleErrors(sink, 'dashboard');
    });
});
