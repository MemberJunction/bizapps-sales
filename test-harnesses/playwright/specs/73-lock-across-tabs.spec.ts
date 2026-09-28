/**
 * @fileoverview The close lock, across Explorer record TABS.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────────────────────────
 *
 * A lock held once for several open deals makes an OPEN deal render read-only after a CLOSED one was
 * looked at: every field obeys the wrong deal's lock. The removed deal workspace had exactly that — one
 * component-level lock that a tab switch did not refresh — and it was invisible for weeks.
 *
 * Deals are Explorer record tabs now (#88), each its own `mjs-deal-form` resolving its own lock in
 * `ngOnInit`. Explorer keeps every tab's form in the DOM and only hides the inactive ones, so the same
 * class of defect comes back the moment the lock moves anywhere shared — a service, an engine cache, a
 * static. This asserts the behaviour, so it does not matter where the lock lives.
 *
 * ── WHY THIS CANNOT BE AN API TEST ──────────────────────────────────────────────────────────────
 *
 * Nothing about it is server-side. The server refuses the write either way (`close-deal.CD5`); this is
 * purely about which deal's lock the FORM believes it is showing. Only a browser with two tabs open can
 * see it.
 *
 * ── IT MUTATES NOTHING ──────────────────────────────────────────────────────────────────────────
 *
 * Opens two existing deals, enters edit mode and reads the DOM. Nothing is saved.
 *
 * ── DROPPED WITH THE WORKSPACE ──────────────────────────────────────────────────────────────────
 *
 * The workspace's "New account" inline-create button, asserted absent on the locked deal and present
 * on the open one. The form has no such button: inline create is the FK type-ahead's own footer, which
 * a read-only field never renders, so the editability checks below already cover it.
 */
import { expect, test, type Page } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryOne } from '../lib/db';
import { DealForm, EditDeal, FieldIsEditable } from '../lib/deal-form';
import { ReopenRecord } from '../lib/deal-flow';

/**
 * The field whose editability stands for the lock. Name is frozen on every locked deal — it is not in
 * the `DealFieldsEditableWhileLocked` carve-outs for either outcome — and editable on every open one.
 */
const PROBE_FIELD = 'Name';

/**
 * EDITABILITY, ASSERTED WITH RETRY RATHER THAN SAMPLED ONCE.
 *
 * The lock is resolved ASYNCHRONOUSLY after the form mounts, so a single read races a server
 * round-trip. A permanently wrong lock — the defect — never settles and still fails, after 30s.
 */
async function expectEditable(page: Page, editable: boolean, why: string): Promise<void> {
    await expect.poll(() => FieldIsEditable(page, PROBE_FIELD), { message: why, timeout: 30_000 }).toBe(editable);
}

/**
 * Brings an already-open record tab to the front by its title.
 *
 * LOCAL HELPER, and the one selector here not declared in this repo: Explorer's shell renders record
 * tabs as Golden Layout tabs (`mj-tab-container .lm_tab`), which is MJ's markup, not the app's. Clicking
 * the tab is the point — navigating to the record route would reload the page and rebuild every form,
 * which is not a switch.
 */
async function selectRecordTab(page: Page, name: string): Promise<void> {
    const tab = page.locator('mj-tab-container .lm_tab').filter({ hasText: name.slice(0, 18) }).first();
    await expect(tab, `an Explorer tab for "${name}" must be open`).toBeVisible({ timeout: 30_000 });
    await tab.click();
    await expect(DealForm(page), `switching to "${name}" must show its form`).toContainText(name, {
        timeout: 30_000,
    });
}

test.describe('close lock — per record tab', () => {
    test('a closed deal stays locked, an open deal stays editable, across tab switches', async ({ page }) => {
        test.setTimeout(360_000);
        const sink = captureConsoleErrors(page);

        /**
         * BOTH DEALS ARE RESOLVED FROM THE DATABASE BY FLAG, never by name or deal number. A spec that
         * hardcoded a seeded deal's name would silently stop testing the locked case the day the seed
         * renamed it, and would still pass.
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
             WHERE t.IsOpen = 1 AND t.LocksDeal = 0
             ORDER BY d.DealNumber`);
        expect(locked?.Name, 'the host needs a deal in a LOCKING status, or there is nothing to test')
            .toBeTruthy();
        expect(open?.Name, 'and an OPEN one, or the second half of the test is untestable').toBeTruthy();
        const lockedName = String(locked!.Name);
        const openName = String(open!.Name);

        // ── 1. The closed deal is locked ────────────────────────────────────
        await ReopenRecord(page, lockedName);
        await expect(
            DealForm(page).locator('.mjs-deal-hero__chip:has(.fa-lock)'),
            'a locked deal must say so — the Locked chip is what tells a rep why nothing responds',
        ).toBeVisible({ timeout: 30_000 });
        await EditDeal(page);
        await expectEditable(page, false, 'a locked deal\'s name must be read-only, even in edit mode');

        // ── 2. The open deal, in a second tab, is editable ──────────────────
        // A record-route navigation reloads the page; Explorer restores the first deal's tab beside it.
        await ReopenRecord(page, openName);
        await expect(
            DealForm(page).locator('.mjs-deal-hero__chip:has(.fa-lock)'),
            'an open deal must not show the Locked chip',
        ).toHaveCount(0);
        await EditDeal(page);
        await expectEditable(page, true, 'an open deal must be editable');

        // ── 3. Back to the closed one — still locked ────────────────────────
        await selectRecordTab(page, lockedName);
        // Edit mode again: opening the second deal reloaded the page, and outside edit mode every field
        // reads as not editable, which would make this check pass on any deal.
        await EditDeal(page);
        await expectEditable(page, false, 'returning to the closed deal must find it still locked');

        // ── 4. Back to the open one — STILL EDITABLE. This is the defect. ───
        /**
         * THE ASSERTION A SHARED LOCK FAILS. The open deal would inherit the closed deal's lock and the
         * whole form would go read-only on a deal nothing is wrong with. A rep's report of this reads
         * "the form randomly stops working".
         */
        await selectRecordTab(page, openName);
        await EditDeal(page);
        await expectEditable(
            page,
            true,
            'the OPEN deal must still be editable after returning from a closed one',
        );

        expectNoConsoleErrors(sink, 'close lock across tabs');
    });
});
