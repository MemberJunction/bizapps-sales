/**
 * @fileoverview Inline account creation from inside the deal workspace — the two claims nobody has seen.
 *
 * ── WHAT WAS ALREADY PROVEN, AND WHAT WAS NOT ───────────────────────────────────────────────────
 *
 * A manual browser pass verified four things: a slide-in opens rather than an Explorer tab, the title
 * comes from the launching field, Save/Cancel sit left/right, and the create control is hidden on a
 * locked deal. Two were left UNPROVEN because `spCreateOrganization` was missing from this host, so no
 * create could complete at all:
 *
 *   1. the created record is SELECTED BACK into the field it was launched from
 *   2. the picker shows the new name rather than rendering BLANK
 *
 * The procedure has since been restored (KI-23), so both are now observable. They are also the two that
 * matter: a field that stays empty after a successful create reads to a rep as the create having failed.
 *
 * ── TWO KNOWN HAZARDS, BOTH SUPPOSEDLY FIXED, BOTH CONFIRMED HERE RATHER THAN ASSUMED ───────────
 *
 * GUID CASE. `NewRecord()` generates the key client-side in lowercase; the view returns it uppercase;
 * `[ngValue]` compares by value. That combination renders a BLANK picker with the correct option sitting
 * in the list — every part individually right.
 *
 * A READ-AFTER-WRITE RACE. The lookup reload does not always contain the row that was just written. The
 * fix synthesises the option from the record in hand when the reload has not caught up.
 *
 * **So the create runs TWICE.** A race that passes once means nothing, and the first run is the one most
 * likely to be lucky: the second create hits a warmer cache and a longer list. Both are asserted, and
 * the second also asserts the option is not DUPLICATED — an earlier fix inserted the synthetic row and
 * then let a reload add the canonical one beside it.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `deal-workspace.component.ts`, in `CreateRelated`, replace `deal.AccountID = match.ID` with
 * `deal.AccountID = id` — the raw client-generated key. The record is still created, the option still
 * appears, and the picker renders blank: this spec's core assertion fails and nothing else does. That is
 * the original defect, and it is the reason this spec exists.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { OpenWorkspace, RealOptionLabels, SelectFor } from '../lib/workspace';

/** Unique per run, and prefixed so a leak is identifiable and removable by one predicate. */
const RUN = `PW-INLINE-${Date.now().toString(36)}`;

test.describe('inline create — the record comes back to the field it was launched from', () => {
    test.afterAll(async () => {
        /**
         * CHILD BEFORE PARENT, and then ASSERT the baseline is back.
         *
         * `SalesAccount` IS an Organization on the same UUID, so the IsA child goes first. Deleting only
         * the parent would fail on the FK; deleting only the child would leave an orphan Organization
         * that shows up in nobody's account picker and in everybody's Organization count.
         *
         * The assertion after the delete is the part that has been missing before: test rows have leaked
         * into this demo host twice, and both times the leak was found later by someone reading a total.
         */
        const ids = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsCommon.Organization WHERE Name LIKE '${RUN}%'`,
        );
        if (ids.length > 0) {
            const list = ids.map((r) => `'${r.ID}'`).join(',');
            await QueryAll(`DELETE FROM __mj_BizAppsSales.SalesAccount WHERE ID IN (${list})`);
            await QueryAll(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID IN (${list})`);
        }
        const left = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsCommon.Organization WHERE Name LIKE '${RUN}%'`,
        );
        expect(Number(left?.N ?? -1), 'every record this spec created must be gone').toBe(0);
    });

    test('created twice, selected back both times, and never blank', async ({ page }) => {
        test.setTimeout(420_000);
        const sink = captureConsoleErrors(page);

        await OpenWorkspace(page);

        const customer = SelectFor(page, 'Customer');
        await expect(customer, 'the Customer picker must render').toBeVisible({ timeout: 30_000 });
        const before = await RealOptionLabels(customer);

        for (const attempt of [1, 2]) {
            const name = `${RUN}-${attempt}`;

            const create = page.getByRole('button', { name: 'New account', exact: true }).first();
            await expect(
                create,
                `attempt ${attempt}: the New account control must be offered on an editable deal`,
            ).toBeVisible({ timeout: 20_000 });
            await create.click();

            // The slide-in, identified by the title the launching field supplies.
            const heading = page.getByRole('heading', { name: /New customer/i }).first();
            await expect(heading, `attempt ${attempt}: a slide-in titled "New customer" must open`)
                .toBeVisible({ timeout: 30_000 });

            /**
             * `exact: true` matters: the workspace behind the panel has a "Deal name" field, and a loose
             * match would fill THAT and then save an empty account — a spec that appears to work while
             * testing nothing.
             */
            const nameBox = page.getByRole('textbox', { name: 'Name', exact: true }).first();
            await expect(nameBox, `attempt ${attempt}: the slide-in must offer a Name field`)
                .toBeVisible({ timeout: 20_000 });
            await nameBox.fill(name);

            await page.getByRole('button', { name: 'Save', exact: true }).last().click();

            // ── THE DATABASE FIRST, because a green screen with no row is the failure being hunted ──
            const row = await (async () => {
                for (let i = 0; i < 30; i += 1) {
                    const found = await QueryOne<{ ID: string; HasChild: number }>(`
                        SELECT o.ID, CASE WHEN a.ID IS NULL THEN 0 ELSE 1 END AS HasChild
                          FROM __mj_BizAppsCommon.Organization o
                          LEFT JOIN __mj_BizAppsSales.SalesAccount a ON a.ID = o.ID
                         WHERE o.Name = '${name}'`);
                    if (found) return found;
                    await page.waitForTimeout(1_000);
                }
                return undefined;
            })();

            expect(row, `attempt ${attempt}: an Organization row must exist for "${name}"`).toBeTruthy();
            expect(
                Number(row!.HasChild),
                `attempt ${attempt}: and its SalesAccount IsA child on the same UUID — the parent alone ` +
                    'is a half-created account that no picker will ever offer',
            ).toBe(1);

            // ── CLAIM 1: the record is selected back into the field ─────────
            await expect(
                customer,
                `attempt ${attempt}: the created account must be SELECTED, not merely offered`,
            ).toHaveValue(row!.ID, { timeout: 30_000, ignoreCase: true });

            // ── CLAIM 2: the picker shows the name, not a blank box ─────────
            /**
             * This is the assertion the GUID-case defect fails. `toHaveValue` above can pass while the
             * rendered text is empty if the value matches no option, so the visible label is checked
             * separately — that is exactly the state the defect produced.
             */
            const shown = (await customer.locator('option:checked').textContent())?.trim() ?? '';
            expect(
                shown,
                `attempt ${attempt}: the picker must SHOW the new name — a blank box after a successful ` +
                    'create reads to a rep as the create having failed',
            ).toBe(name);

            // ── And exactly one option for it ───────────────────────────────
            const labels = await RealOptionLabels(customer);
            expect(
                labels.filter((l) => l === name).length,
                `attempt ${attempt}: exactly one option for the new account — a synthetic row plus a ` +
                    'reloaded canonical row is how the list came to offer the same account twice',
            ).toBe(1);
            expect(
                labels.length,
                `attempt ${attempt}: the option list must have grown by exactly the accounts created`,
            ).toBe(before.length + attempt);
        }

        expectNoConsoleErrors(sink, 'inline create');
    });
});
