/**
 * #443 — the Sales Account's Contacts panel links an existing Sales Contact.
 *
 * Before: the panel listed the people linked to the account and had no way to add one; a person was
 * linked only from the person's own form. Now "Link person" writes a Common Relationship From the
 * person To the account, and the grid reloads with the person in it.
 *
 * Every ingredient is resolved by QUERY: an account, a Sales Contact with no active link to it, and an
 * active person-to-organization relationship type (by its Category, never by a type name).
 */
import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { EXPLORER_BASE_URL } from '../lib/env';

const ACCOUNT_ENTITY = 'MJ_BizApps_Sales: Sales Accounts';
let accountID = '';
let personID = '';

test.afterAll(async () => {
    if (accountID && personID) {
        await QueryAll(`
            DELETE FROM __mj_BizAppsCommon.Relationship
             WHERE FromPersonID = '${personID}' AND ToOrganizationID = '${accountID}'`);
    }
});

test('Link person on a Sales Account adds the person to its Contacts', async ({ page }) => {
    const pair = await QueryOne<{ AccountID: string; PersonID: string; LastName: string }>(`
        SELECT TOP 1 CAST(a.ID AS nvarchar(50)) AS AccountID, CAST(c.ID AS nvarchar(50)) AS PersonID,
               p.LastName
          FROM __mj_BizAppsSales.SalesAccount a
         CROSS JOIN __mj_BizAppsSales.SalesContact c
          JOIN __mj_BizAppsCommon.Person p ON p.ID = c.ID
         WHERE LEN(p.LastName) >= 2
           AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Relationship r
                            WHERE r.Status = 'Active'
                              AND ((r.FromPersonID = c.ID AND r.ToOrganizationID = a.ID)
                                OR (r.FromOrganizationID = a.ID AND r.ToPersonID = c.ID)))
         ORDER BY a.ID, c.ID`);
    const type = await QueryOne<{ ID: string }>(`
        SELECT TOP 1 CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsCommon.RelationshipType
         WHERE Category = 'PersonToOrganization' AND IsActive = 1 ORDER BY Name`);
    expect(pair?.AccountID, 'the host needs a Sales Account and a Sales Contact not linked to it').toBeTruthy();
    expect(type?.ID, 'the host needs an active person-to-organization relationship type').toBeTruthy();
    accountID = pair!.AccountID;
    personID = pair!.PersonID;

    await page.goto(
        `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(ACCOUNT_ENTITY)}/${encodeURIComponent(`ID|${accountID}`)}`,
        { waitUntil: 'domcontentloaded' },
    );
    const contacts = page.getByRole('button', { name: /Contacts/ }).first();
    await expect(contacts, 'the account form must offer the Contacts section').toBeVisible({ timeout: 60_000 });
    await contacts.click();

    await page.locator('[data-testid="account-contacts-link-person"]:visible').first().click();
    const form = page.locator('[data-testid="account-contacts-link-form"]:visible').first();
    await expect(form, 'Link person opens the inline form').toBeVisible({ timeout: 15_000 });

    const input = form.locator('bizapps-party-field input.mj-combobox-input').first();
    await input.click();
    await input.pressSequentially(pair!.LastName, { delay: 40 });
    const option = page
        .locator('.mj-dropdown-panel .mj-dropdown-option:visible:not(:has(.mj-fk-create-footer))')
        .filter({ hasText: pair!.LastName })
        .first();
    await expect(option, 'the picker offers the Sales Contact').toBeVisible({ timeout: 20_000 });
    await option.click();

    await form.locator('[data-testid="account-contacts-link-type"]').selectOption({ value: type!.ID });
    await form.locator('[data-testid="account-contacts-link-save"]').click();

    await expect
        .poll(
            async () =>
                (await QueryOne<{ N: number }>(`
                    SELECT COUNT(*) AS N FROM __mj_BizAppsCommon.Relationship
                     WHERE FromPersonID = '${personID}' AND ToOrganizationID = '${accountID}' AND Status = 'Active'`))?.N ?? 0,
            { message: 'Link saves one active relationship From the person To the account', timeout: 30_000 },
        )
        .toBe(1);
    await expect(
        page.locator('mj-explorer-entity-data-grid:visible').getByText(pair!.LastName).first(),
        'the person appears in the Contacts grid',
    ).toBeVisible({ timeout: 30_000 });
});
