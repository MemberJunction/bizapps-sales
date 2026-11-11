/**
 * PROMOTING AN EXISTING PARTY INTO SALES, THROUGH THE REAL UI (D-PR1–D-PR5).
 *
 * ── WHY THIS SPEC EXISTS ────────────────────────────────────────────────────────────────────────
 *
 * Because the unit suite was GREEN over three defects in this feature that a browser found in
 * minutes, and all three were of the kind only a browser can find:
 *
 *   1. The promote link was rendered by `MJSDealPartyPanel` only — the panel that deliberately
 *      drops the party fields while a deal is unsaved. On a NEW deal, which is the entire point of
 *      the feature, `MJSDealPipelinePanel` leads and the link was simply absent. 54 unit tests
 *      verified the component in isolation and never asked which panel mounts.
 *   2. The host had no `@mj-biz-apps/common-server`, so there was no GraphQL type for
 *      `MJ_BizApps_Common: Organizations`. The client's parent load returned nothing,
 *      `AttachToParent` answered false, and the UI told the rep their record no longer existed.
 *   3. The dialog resized between its states, under a pointer already travelling toward a row.
 *
 * Numbers 1 and 2 are invisible to any test that does not mount the real form against a real
 * server. That is what this file is for.
 *
 * ── WHAT IT PROVES ──────────────────────────────────────────────────────────────────────────────
 *
 *   PP1  The card appears on an Organization with no Sales Account, and NOT on one that has it.
 *        The negative half is the one that matters: a card there invites a second promotion, which
 *        reaches the database and dies on PK_SalesAccount.
 *   PP2  Promoting from that card writes the subtype row, leaves the parent's own columns alone,
 *        and sets Account Type from the IsProspect flag (D-PR1).
 *   PP3  The link is present on a NEW deal — the regression in (1) above — and names the field.
 *   PP4  The dialog lists both halves, badged; an existing Sales Account is SELECTED with no write.
 *   PP5  A promotable row promotes from the dialog and lands in the deal's Account field.
 *   PP6  With no match, Create offers the typed term and creates parent + child together.
 *   PP7  The Accounts rail page reaches the same dialog from "Add existing".
 *
 * ── FIXTURES ────────────────────────────────────────────────────────────────────────────────────
 *
 * Every row this spec touches it creates itself, under a token no seeded row carries, and removes
 * afterwards. It does NOT promote the demo organizations: that would consume a fixture other specs
 * read, and the second run would then be testing a different situation than the first.
 */
import { expect, test } from '../lib/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, expectOnlyKnownErrors, shot } from '../lib/explorer';
import { ByTestId, DealForm, OpenNewDeal, WaitForFormSettled } from '../lib/deal-form';
import type { Page } from '@playwright/test';
import { CloseDb, QueryAll, QueryOne } from '../lib/db';

const COMMON = '__mj_BizAppsCommon';
const SALES = '__mj_BizAppsSales';
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';

/** A token no seeded row starts with, so a prefix search can only find this spec's rows. */
const TOKEN = `zqpp${Math.random().toString(36).slice(2, 7).replace(/[0-9]/g, 'k')}`;

interface Fixture {
    /** Has a SalesAccount row: the picker can offer it, and the card must NOT appear. */
    PromotedID: string;
    PromotedName: string;
    /** No SalesAccount row: promotable. */
    PlainID: string;
    PlainName: string;
    /** A second promotable one, used by the deal-form path so the two never collide. */
    PlainBID: string;
    PlainBName: string;
}

let fx: Fixture;

/**
 * The promote link under one party field. The testid is the same on every party field — the
 * `data-field` wrapper is what says WHICH field, exactly as the form itself scopes them.
 */
function PromoteLinkFor(page: Page, fieldName: string) {
    return page.locator(`[data-field="${fieldName}"] [data-testid="deal-promote-party"]`).first();
}


async function newOrg(name: string, withSalesAccount: boolean): Promise<string> {
    const row = await QueryOne<{ ID: string }>(
        `INSERT INTO [${COMMON}].[Organization] (Name) OUTPUT INSERTED.ID VALUES (N'${name.replace(/'/g, "''")}')`,
    );
    const id = String(row!.ID);
    if (withSalesAccount) {
        await QueryAll(`INSERT INTO [${SALES}].[SalesAccount] (ID) VALUES ('${id}')`);
    }
    return id;
}

test.beforeAll(async () => {
    fx = {
        PromotedName: `${TOKEN} Already Account`,
        PlainName: `${TOKEN} Plain Org`,
        PlainBName: `${TOKEN} Plain Beta`,
        PromotedID: '',
        PlainID: '',
        PlainBID: '',
    };
    fx.PromotedID = await newOrg(fx.PromotedName, true);
    fx.PlainID = await newOrg(fx.PlainName, false);
    fx.PlainBID = await newOrg(fx.PlainBName, false);
});

test.afterAll(async () => {
    // Children first: deleting a Sales Account's only parent would take the Organization with it.
    for (const id of [fx?.PromotedID, fx?.PlainID, fx?.PlainBID].filter(Boolean)) {
        await QueryAll(`DELETE FROM [${SALES}].[SalesAccount] WHERE ID = '${id}'`).catch(() => undefined);
    }
    await QueryAll(
        `DELETE FROM [${SALES}].[SalesAccount] WHERE ID IN (SELECT ID FROM [${COMMON}].[Organization] WHERE Name LIKE N'${TOKEN}%')`,
    ).catch(() => undefined);
    await QueryAll(`DELETE FROM [${COMMON}].[Organization] WHERE Name LIKE N'${TOKEN}%'`).catch(() => undefined);
    await CloseDb();
});

/** Opens an Organization record tab by ID, the way `ReopenRecord` opens a deal. */
async function openOrganization(page: Page, id: string): Promise<void> {
    await page.goto(
        `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(ORG_ENTITY)}/${encodeURIComponent(`ID|${id}`)}`,
        { waitUntil: 'domcontentloaded' },
    );
    // The promote panel is contributed into the form, so the form itself must be up first.
    await expect(page.locator('mj-record-form-container, mj-form-panel-slot').first()).toBeVisible({
        timeout: 45_000,
    });
    await page.waitForTimeout(1500);
}

test.describe('promote an existing party into sales', () => {
    test('PP1: the card appears only where a Sales Account is MISSING', async ({ page }) => {
        const errors = captureConsoleErrors(page);

        await openOrganization(page, fx.PlainID);
        await expect(
            ByTestId(page, 'promote-card'),
            'an Organization with no Sales Account must offer the promote card',
        ).toBeVisible({ timeout: 30_000 });
        await shot(page, 'pp1-card-shown');

        await openOrganization(page, fx.PromotedID);
        // THE HALF THAT MATTERS. A card here invites a second promotion, which AttachToParent cannot
        // refuse (it only asks whether the PARENT exists) and the database then kills on PK_SalesAccount.
        await expect(
            ByTestId(page, 'promote-card'),
            'an Organization that is ALREADY a Sales Account must not offer to promote it again',
        ).toHaveCount(0, { timeout: 30_000 });
        await shot(page, 'pp1-card-hidden');

        expectOnlyKnownErrors(errors, [], 'PP1');
    });

    test('PP2: promoting writes the subtype row and nothing else', async ({ page }) => {
        await openOrganization(page, fx.PlainID);

        const card = ByTestId(page, 'promote-card');
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expect(ByTestId(page, 'promote-confirm')).toHaveText(/Promote to Sales Account/i);
        await ByTestId(page, 'promote-confirm').click();

        // The card removes itself once the record is a Sales Account.
        await expect(card, 'the card should disappear once promoted').toHaveCount(0, { timeout: 40_000 });

        const account = await QueryOne<{ ID: string; AccountTypeID: string | null }>(
            `SELECT ID, AccountTypeID FROM [${SALES}].[SalesAccount] WHERE ID = '${fx.PlainID}'`,
        );
        expect(account, 'the Sales Account row must exist, under the ORGANIZATION id').toBeTruthy();

        // D-PR1: Account Type comes from the IsProspect FLAG, never a name.
        const prospect = await QueryOne<{ ID: string }>(
            `SELECT TOP 1 ID FROM [${SALES}].[AccountType] WHERE IsProspect = 1 AND IsActive = 1 ORDER BY DisplayRank, ID`,
        );
        expect(String(account!.AccountTypeID ?? '').toLowerCase()).toBe(String(prospect!.ID).toLowerCase());

        // The parent is untouched: exactly one Organization, still named what it was.
        const orgs = await QueryAll<{ ID: string; Name: string }>(
            `SELECT ID, Name FROM [${COMMON}].[Organization] WHERE Name = N'${fx.PlainName}'`,
        );
        expect(orgs, 'promotion must not insert a second Organization').toHaveLength(1);
        expect(String(orgs[0].ID).toLowerCase()).toBe(fx.PlainID.toLowerCase());
    });

    test('PP3: a NEW deal offers the link, naming the field', async ({ page }) => {
        await OpenNewDeal(page);
        await WaitForFormSettled(page);

        // THE REGRESSION THIS FILE EXISTS FOR: the link lives on whichever panel leads an unsaved
        // deal, which is NOT the one named "party".
        const link = PromoteLinkFor(page, 'AccountID');
        await expect(link, 'a new deal must offer the route to a party the picker cannot show').toBeVisible({
            timeout: 30_000,
        });
        await expect(link).toHaveText(/Can't find the Account\?.*Search Organizations.*Add Account/i);
        await shot(page, 'pp3-link-on-new-deal');
    });

    test('PP4: the dialog badges both halves, and an existing account is SELECTED', async ({ page }) => {
        await OpenNewDeal(page);
        await WaitForFormSettled(page);
        await PromoteLinkFor(page, 'AccountID').click();

        const dialog = ByTestId(page, 'promote-dialog');
        await expect(dialog).toBeVisible({ timeout: 20_000 });
        await ByTestId(page, 'promote-search').fill(TOKEN);

        // Both halves, from the two complementary queries PL7/PL8 pin.
        await expect(ByTestId(page, 'promote-row-existing').first()).toBeVisible({ timeout: 25_000 });
        await expect(ByTestId(page, 'promote-row-promotable').first()).toBeVisible();
        await shot(page, 'pp4-both-halves');

        const before = await QueryAll(`SELECT ID FROM [${SALES}].[SalesAccount] WHERE ID = '${fx.PromotedID}'`);
        await page.locator('[data-testid="promote-row"]', { hasText: fx.PromotedName }).first().click();
        await expect(ByTestId(page, 'promote-dialog-confirm'), 'an existing account is chosen, not promoted').toHaveText(
            /^\s*Select\s*$/i,
        );
        await ByTestId(page, 'promote-dialog-confirm').click();
        await expect(dialog).toHaveCount(0, { timeout: 20_000 });

        // Nothing was written: it was already a Sales Account.
        const after = await QueryAll(`SELECT ID FROM [${SALES}].[SalesAccount] WHERE ID = '${fx.PromotedID}'`);
        expect(after.length).toBe(before.length);
    });

    test('PP5: a promotable row promotes from the dialog', async ({ page }) => {
        await OpenNewDeal(page);
        await WaitForFormSettled(page);
        await PromoteLinkFor(page, 'AccountID').click();
        await expect(ByTestId(page, 'promote-dialog')).toBeVisible({ timeout: 20_000 });
        await ByTestId(page, 'promote-search').fill(fx.PlainBName.slice(0, 12));

        const row = page.locator('[data-testid="promote-row"]', { hasText: fx.PlainBName }).first();
        await expect(row).toBeVisible({ timeout: 25_000 });
        await row.click();
        await expect(ByTestId(page, 'promote-dialog-confirm')).toHaveText(/Promote to Sales Account/i);
        await ByTestId(page, 'promote-dialog-confirm').click();
        await expect(ByTestId(page, 'promote-dialog')).toHaveCount(0, { timeout: 40_000 });

        const account = await QueryOne(`SELECT ID FROM [${SALES}].[SalesAccount] WHERE ID = '${fx.PlainBID}'`);
        expect(account, 'the dialog must have promoted the chosen Organization').toBeTruthy();
        await shot(page, 'pp5-promoted-from-dialog');
    });

    test('PP6: with no match, Create takes the typed term', async ({ page }) => {
        const name = `${TOKEN} Created Inline`;
        await OpenNewDeal(page);
        await WaitForFormSettled(page);
        await PromoteLinkFor(page, 'AccountID').click();
        await expect(ByTestId(page, 'promote-dialog')).toBeVisible({ timeout: 20_000 });
        await ByTestId(page, 'promote-search').fill(name);

        const create = ByTestId(page, 'promote-create-confirm');
        await expect(create, 'a search with no matches must offer to create one').toBeVisible({ timeout: 25_000 });
        // The term is the name: there is no second field to fill.
        await expect(create).toHaveText(new RegExp(`Create Account.*${TOKEN}`, 'i'));
        await create.click();
        await expect(ByTestId(page, 'promote-dialog')).toHaveCount(0, { timeout: 40_000 });

        // Parent AND child, from one chain save (IS1's rule).
        const org = await QueryOne<{ ID: string }>(
            `SELECT ID FROM [${COMMON}].[Organization] WHERE Name = N'${name}'`,
        );
        expect(org, 'creating must write the Organization').toBeTruthy();
        const child = await QueryOne(`SELECT ID FROM [${SALES}].[SalesAccount] WHERE ID = '${org!.ID}'`);
        expect(child, 'creating must write the Sales Account under the same key').toBeTruthy();
    });

    test('PP7: the Accounts page reaches the same dialog', async ({ page }) => {
        await page.goto(`${EXPLORER_BASE_URL}/app/sales/Deals?page=accounts`, { waitUntil: 'domcontentloaded' });
        const secondary = page.locator('[data-testid="sales-secondary"]');
        await expect(secondary, 'the Accounts page offers Add existing beside New').toBeVisible({ timeout: 45_000 });
        await expect(secondary).toHaveText(/Add existing/i);
        await secondary.click();
        await expect(ByTestId(page, 'promote-dialog')).toBeVisible({ timeout: 20_000 });
        await ByTestId(page, 'promote-dialog-cancel').click();
        await expect(ByTestId(page, 'promote-dialog')).toHaveCount(0);
        await shot(page, 'pp7-accounts-page-dialog');
    });
});

test.describe('the deal form no longer offers the picker its own Create', () => {
    test('PP8: creation is reachable only through the dialog (D-PR5)', async ({ page }) => {
        await OpenNewDeal(page);
        await WaitForFormSettled(page);
        // bizapps-party-field renders its create affordance as `.mj-fk-create-footer`; with
        // AllowCreate=false it must not appear, so creating cannot compete with the matches on screen.
        await expect(DealForm(page).locator('.mj-fk-create-footer')).toHaveCount(0);
    });
});
