/**
 * @fileoverview The close lock, across workspace TABS — the case that was broken for weeks.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────────────────────────
 *
 * `Lock` is a single component-level value and `SelectTab` did not refresh it. So opening a CLOSED deal
 * and switching back to an OPEN one left the open deal rendering read-only: every
 * `[disabled]="!IsFieldEditable(...)"` binding in the form obeyed the wrong deal's lock. It had been
 * present for weeks, and it was invisible until the inline-create buttons were gated on the same rule —
 * a missing control is louder than a greyed input.
 *
 * ── WHY THIS CANNOT BE AN API TEST ──────────────────────────────────────────────────────────────
 *
 * Nothing about it is server-side. The server refuses the write either way (`close-deal.CD5`); this is
 * purely about which deal's lock the FORM believes it is showing. Only a browser with two tabs open can
 * see it, which is why it survived a suite of green integration checks.
 *
 * ── IT MUTATES NOTHING ──────────────────────────────────────────────────────────────────────────
 *
 * Opens two existing deals and reads the DOM. No rows written, nothing to clean up.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `deal-workspace.component.ts`, delete the `void this.RefreshLock()...` line from `SelectTab`. The
 * final assertion — the open deal still editable after coming back from the closed one — fails, and
 * nothing else does.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryOne } from '../lib/db';
import { FieldIsEditable, WORKSPACE_ROOT } from '../lib/workspace';
import { EXPLORER_BASE_URL } from '../lib/env';
import { SALES_APP_ROUTE } from '../lib/workspace';

/** Opens a deal from the roster by its visible name. */
async function openFromRoster(page: import('@playwright/test').Page, name: string): Promise<void> {
    const nav = page.locator('mj-left-nav').getByRole('button', { name: /^All deals/i });
    await expect(nav, 'the Sales left-nav must offer All deals').toBeVisible({ timeout: 90_000 });
    await nav.click();
    // `.wrap--list table.wl`, NOT the invented `.sx-table`. Every page in the section is rendered and
    // switched with [hidden] rather than @if, so `table.wl` alone matches the dashboard's "Closing
    // soonest" table as well -- scoping to the wrap is what makes this row unambiguous.
    const row = page.locator('.wrap--list table.wl tbody tr', { hasText: name }).first();
    await expect(row, `the roster must list "${name}"`).toBeVisible({ timeout: 60_000 });
    await row.click();
    await expect(page.locator(WORKSPACE_ROOT), 'the workspace must open').toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
}

/** Brings an already-open workspace tab to the front by its label. */
async function selectTab(page: import('@playwright/test').Page, fragment: string): Promise<void> {
    const tab = page.locator('.mj-tabs__tab', { hasText: fragment }).first();
    await expect(tab, `a workspace tab matching "${fragment}" must be open`).toBeVisible({ timeout: 30_000 });
    await tab.click();
    await page.waitForTimeout(1_500);
}

test.describe('close lock — per tab, not per component', () => {
    test('a closed deal stays locked, an open deal stays editable, across switches', async ({ page }) => {
        test.setTimeout(360_000);
        const sink = captureConsoleErrors(page);

        /**
         * BOTH DEALS ARE RESOLVED FROM THE DATABASE BY FLAG, never by name or deal number. A spec that
         * hardcoded "Cascade Manufacturing — Line 2 Expansion" would silently stop testing the locked
         * case the day the seed renamed it, and would still pass.
         */
        const locked = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 d.Name
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
             WHERE t.LocksDeal = 1
             ORDER BY d.DealNumber`);
        const open = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 d.Name
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
             WHERE t.IsOpen = 1
             ORDER BY d.DealNumber`);
        expect(locked?.Name, 'the host needs a deal in a LOCKING status, or there is nothing to test')
            .toBeTruthy();
        expect(open?.Name, 'and an OPEN one, or the second half of the test is untestable').toBeTruthy();

        await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });

        // ── 1. The closed deal is locked ────────────────────────────────────
        await openFromRoster(page, locked!.Name);
        await expect(
            page.getByText(/closed .*and locked/i).first(),
            'a locked deal must say so — the notice is what tells a rep why nothing responds',
        ).toBeVisible({ timeout: 30_000 });
        expect(await FieldIsEditable(page, 'Deal name'), 'a locked deal name must be read-only').toBe(false);
        await expect(
            page.getByRole('button', { name: 'New account', exact: true }),
            'and the inline-create control must be ABSENT, not merely disabled — a locked deal must not ' +
                'create a record it would then fail to attach',
        ).toHaveCount(0);

        // ── 2. The open deal, in the same session, is editable ──────────────
        await openFromRoster(page, open!.Name);
        expect(await FieldIsEditable(page, 'Deal name'), 'an open deal must be editable').toBe(true);
        await expect(
            page.getByRole('button', { name: 'New account', exact: true }),
            'and it must offer inline create',
        ).toHaveCount(1);

        // ── 3. Back to the closed one — still locked ────────────────────────
        await selectTab(page, locked!.Name.slice(0, 18));
        expect(
            await FieldIsEditable(page, 'Deal name'),
            'returning to the closed deal must find it still locked',
        ).toBe(false);

        // ── 4. Back to the open one — STILL EDITABLE. This is the defect. ───
        /**
         * THE ASSERTION THE BUG FAILED. `Lock` is one field; without a refresh on tab switch the open
         * deal inherits the closed deal's lock and the whole form goes read-only, on a deal nothing is
         * wrong with. A rep's report of this reads "the form randomly stops working".
         */
        await selectTab(page, open!.Name.slice(0, 18));
        expect(
            await FieldIsEditable(page, 'Deal name'),
            'the OPEN deal must still be editable after returning from a closed one — this is the bug ' +
                'that left an unrelated deal read-only',
        ).toBe(true);
        await expect(
            page.getByRole('button', { name: 'New account', exact: true }),
            'and its inline-create control must be back',
        ).toHaveCount(1);

        expectNoConsoleErrors(sink, 'close lock across tabs');
    });
});
