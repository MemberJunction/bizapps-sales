/**
 * @fileoverview Inline account creation from the Deal form's Account field — the record must come back
 * to the field it was launched from.
 *
 * ── WHAT MOVED (#88) ────────────────────────────────────────────────────────────────────────────
 *
 * This drove the removed deal workspace's "New account" button, a Customer `<select>`, and the
 * workspace's own `CreateRelated`. The Deal form's Account field is MJ's FK type-ahead instead, and
 * inline create is that control's own "Create …" footer: it asks the host to open the related entity's
 * form in a dialog, and selects the saved record back into the field. The behaviour a rep sees is the
 * same, so the claims are kept:
 *
 *   1. the created record is SELECTED BACK into the field it was launched from — proven from the deal
 *      row after saving, not from the screen
 *   2. the field shows the new name rather than rendering BLANK
 *   3. a create yields ONE account, an Organization with its SalesAccount IsA child on the same UUID
 *
 * **The create still runs TWICE**, on one form: a selection-back that works once may be luck, and the
 * second create replaces the first, so the deal row proves the field follows the LATEST create.
 *
 * DROPPED: "the option list grew by exactly the accounts created" and "exactly one option for it".
 * Both counted `<option>`s in the workspace's select; a type-ahead has no standing option list. The
 * no-duplicate intent is kept as a row count in the database.
 */
import { expect, test, type Page } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { Field, FirstOpenStatus, OpenNewDeal, PickLookup, SaveDeal, SetStatusByID, SetText } from '../lib/deal-form';
import { PurgeByPrefix } from '../lib/deal-flow';

/** Unique per run, and prefixed so a leak is identifiable and removable by one predicate. */
const RUN = `PW-INLINE-${Date.now().toString(36)}`;
const DEAL_NAME = `${RUN} deal`;

/**
 * Types a name into an FK type-ahead and launches its inline create, then saves the dialog it opens.
 *
 * LOCAL HELPER. `.mj-fk-create-footer`, `mj-form-dialog` and the dialog's Save button are MJ markup
 * (`@memberjunction/ng-base-forms`), not this app's. The footer is looked for page-wide because MJ
 * portals the type-ahead's dropdown out of the field.
 */
async function createFromLookup(page: Page, fieldName: string, name: string): Promise<void> {
    const input = (await Field(page, fieldName)).locator('.mj-fk-search input').first();
    await expect(input, `lookup ${fieldName} must be editable`).toBeVisible({ timeout: 15_000 });
    await input.click();
    await input.fill('');
    await input.pressSequentially(name, { delay: 30 });

    const create = page.locator('.mj-fk-create-footer:visible').first();
    await expect(create, `the ${fieldName} lookup must offer to create "${name}"`).toBeVisible({ timeout: 20_000 });
    await create.click();

    const dialog = page.locator('mj-form-dialog').last();
    await expect(dialog, 'inline create must open the related form in a dialog').toBeVisible({ timeout: 30_000 });

    // The typed text prefills the new record's name field; filled here only if it did not.
    const nameBox = dialog.locator('mj-form-field[fieldname="Name"] input:visible').first();
    if ((await nameBox.count()) > 0 && (await nameBox.inputValue()) !== name) {
        await nameBox.fill(name);
    }

    await dialog.locator('mj-dialog-actions button').filter({ hasText: /^\s*Save\s*$/ }).first().click();
    await expect(dialog, 'the dialog must close once the account saves').toBeHidden({ timeout: 30_000 });
}

test.describe('inline create — the record comes back to the field it was launched from', () => {
    test.afterAll(async () => {
        /**
         * THE DEAL FIRST (it references the account), then CHILD BEFORE PARENT, then ASSERT.
         *
         * `SalesAccount` IS an Organization on the same UUID, so the IsA child goes first. Deleting only
         * the parent would fail on the FK; deleting only the child would leave an orphan Organization
         * that shows up in nobody's account picker and in everybody's Organization count.
         */
        await PurgeByPrefix(RUN);
        const ids = await QueryAll<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsCommon.Organization WHERE Name LIKE '${RUN}%'`,
        );
        if (ids.length > 0) {
            const list = ids.map((r) => `'${r.ID}'`).join(',');
            await QueryAll(`DELETE FROM __mj_BizAppsSales.SalesAccount WHERE ID IN (${list})`);
            await QueryAll(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID IN (${list})`);
        }
        const left = await QueryOne<{ Orgs: number; Deals: number }>(`
            SELECT (SELECT COUNT(*) FROM __mj_BizAppsCommon.Organization WHERE Name LIKE '${RUN}%') AS Orgs,
                   (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN}%') AS Deals`);
        expect(Number(left?.Orgs ?? -1), 'every account this spec created must be gone').toBe(0);
        expect(Number(left?.Deals ?? -1), 'and the deal it saved').toBe(0);
    });

    test('created twice, selected back both times, and never blank', async ({ page }) => {
        test.setTimeout(420_000);
        const sink = captureConsoleErrors(page);

        await OpenNewDeal(page);

        let lastID = '';
        for (const attempt of [1, 2]) {
            const name = `${RUN}-${attempt}`;
            await createFromLookup(page, 'AccountID', name);

            // ── THE DATABASE FIRST, because a green screen with no row is the failure being hunted ──
            const rows = await (async () => {
                for (let i = 0; i < 30; i += 1) {
                    const found = await QueryAll<{ ID: string; HasChild: number }>(`
                        SELECT o.ID, CASE WHEN a.ID IS NULL THEN 0 ELSE 1 END AS HasChild
                          FROM __mj_BizAppsCommon.Organization o
                          LEFT JOIN __mj_BizAppsSales.SalesAccount a ON a.ID = o.ID
                         WHERE o.Name = '${name}'`);
                    if (found.length > 0) return found;
                    await page.waitForTimeout(1_000);
                }
                return [];
            })();

            expect(rows.length, `attempt ${attempt}: exactly one Organization row must exist for "${name}"`).toBe(1);
            expect(
                Number(rows[0].HasChild),
                `attempt ${attempt}: and its SalesAccount IsA child on the same UUID — the parent alone ` +
                    'is a half-created account that no picker will ever offer',
            ).toBe(1);
            lastID = String(rows[0].ID);

            // ── CLAIM 2: the field shows the name, not a blank box ──────────
            const input = (await Field(page, 'AccountID')).locator('.mj-fk-search input').first();
            await expect(
                input,
                `attempt ${attempt}: the Account field must SHOW the new name — a blank box after a ` +
                    'successful create reads to a rep as the create having failed',
            ).toHaveValue(name, { timeout: 15_000 });
        }

        // ── CLAIM 1: the record is selected back into the field ─────────────
        /**
         * Proven from the ROW. The field's text can match while its value is a different key — the GUID
         * case mismatch between a client-generated key and the view is how a picker once showed one
         * thing and held another — so the saved deal's AccountID is the answer, compared
         * case-insensitively for that same reason.
         */
        await SetText(page, 'Name', DEAL_NAME);
        await PickLookup(page, 'PipelineID');
        await SetStatusByID(page, (await FirstOpenStatus()).ID);
        await SaveDeal(page);

        const deal = await (async () => {
            for (let i = 0; i < 30; i += 1) {
                const found = await QueryOne<{ AccountID: string | null }>(
                    `SELECT AccountID FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
                );
                if (found) return found;
                await page.waitForTimeout(1_000);
            }
            return undefined;
        })();
        expect(deal, 'the deal must save').toBeTruthy();
        expect(
            String(deal!.AccountID ?? '').toLowerCase(),
            'the deal must hold the account created LAST — selected, not merely offered',
        ).toBe(lastID.toLowerCase());

        expectNoConsoleErrors(sink, 'inline create');
    });
});
