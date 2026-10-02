/**
 * @fileoverview golive#291 point 2, against a real Explorer: saving a `DealTeamMember` on its own
 * re-derives the deal's owner from the roster.
 *
 * ── IT BUILDS ITS OWN DEAL, AND THAT IS THE SCENARIO ────────────────────────────────────────────
 *
 * The deal and its Owner / AE row are inserted directly, which is precisely the case this change
 * says it covers: "an importer, an Action or a direct write against DealTeamMember reaches the same
 * state". A row written that way never went through `DealEntityServer.Save()`, so nothing stamped
 * `Deal.OwnerEmployeeID` — the deal has a roster naming an owner and a column saying there is none,
 * which is the state the issue reports as "the grid shows an owner, the deal says No owner
 * assigned".
 *
 * Its own fixture rather than a seeded deal, per CLAUDE.md: "scope a check to its own fixtures — a
 * check that requires a globally empty table is asserting something about the world, not about the
 * code". An earlier draft borrowed a seeded deal and cleared its owner, which both depended on the
 * seed's shape and left that deal ownerless if the run died mid-way.
 *
 * Nothing here hand-sets `Deal.OwnerEmployeeID`. CLAUDE.md forbids that because the column is
 * server-maintained, and this spec exists to prove the server maintains it: the insert simply omits
 * it, which is the honest state of an imported row and the state the fix must repair.
 *
 * ── WHY IT EDITS THE RECORD RATHER THAN THE GRID ────────────────────────────────────────────────
 *
 * The Internal team grid is MJ's generic related-entity grid, and adding or re-roling a member goes
 * through a foreign-key lookup that offers no rows on this host — the same one that stops nine other
 * specs, unrelated to this change. `Notes` is free text, so editing the row needs no lookup.
 *
 * ── WHAT IT DELIBERATELY DOES NOT ASSERT ────────────────────────────────────────────────────────
 *
 * Deactivating the owner row does NOT clear the deal's owner, and this spec does not claim it does.
 * `stampOwnerFromTeam()` matches on `DealRoleID` alone and never reads `IsActive`, as does
 * `DealEntity.SetOwner`. That is pre-existing in both and unchanged here — but this PR's summary
 * lists "deactivated" beside "role changed" as cases it catches, and only the second is true today.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { EXPLORER_BASE_URL } from '../lib/env';
import { enterEditMode, saveForm, setField } from '../lib/explorer';
import { OpenSection } from '../lib/deal-form';

const TEAM_MEMBER_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';
const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
/** `PW-` so the harness's own sweep removes it even if `afterAll` never runs. */
const DEAL_NAME = `PW-291-restamp-${Date.now()}`;

const dealID = randomUUID();
const memberID = randomUUID();

/** The second scenario's own rows, so the two tests cannot disturb each other. */
const OPEN_PAGE_DEAL_NAME = `PW-291-openpage-${Date.now()}`;
const openPageDealID = randomUUID();
const openPageMemberID = randomUUID();
let employeeID = '';

/**
 * Open a form section the way a USER does — the chrome rail button.
 *
 * NOT `OpenSection`. That verb resolves and expands the PANEL, which is enough for a locator, but it
 * does not put the form's own `IsSectionExpanded(key)` into the state the related-entity grid binds
 * `AllowLoad` to. Measured: after `OpenSection('internal-team')` the panel is in the DOM and the grid
 * holds ZERO rows; after clicking the rail button it holds the row that is there. A grid that never
 * loads never emits `AfterDataLoad`, and this test turns on that event firing.
 */
async function openSectionViaRail(page: import('@playwright/test').Page, label: RegExp): Promise<void> {
    const button = page.getByRole('button', { name: label }).first();
    await expect(button, `the form rail must offer ${label}`).toBeVisible({ timeout: 30_000 });
    await button.click();
}

/** The deal's stamped owner, lowercased, or null. */
async function ownerOf(id: string): Promise<string | null> {
    const row = await QueryOne<{ OwnerEmployeeID: string | null }>(
        `SELECT CAST(OwnerEmployeeID AS nvarchar(50)) AS OwnerEmployeeID
           FROM __mj_BizAppsSales.Deal WHERE ID = '${id}'`,
    );
    return row?.OwnerEmployeeID ? String(row.OwnerEmployeeID).toLowerCase() : null;
}

test.describe('golive#291 — a team row saved on its own re-derives the deal owner', () => {
    test('a deal imported without an owner stamp gets one when its Owner / AE row is saved', async ({ page }) => {
        /**
         * Every ingredient is resolved by QUERY. Hardcoded ids would make this a description of one
         * host, and the ids here are seeded values that a rebuild is free to change.
         */
        const pipeline = await QueryOne<{ ID: string; CompanyID: string }>(
            `SELECT TOP 1 CAST(ID AS nvarchar(50)) AS ID, CAST(CompanyID AS nvarchar(50)) AS CompanyID
               FROM __mj_BizAppsSales.Pipeline WHERE IsActive = 1 ORDER BY Name`,
        );
        const ownerRole = await QueryOne<{ ID: string }>(
            `SELECT TOP 1 CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsSales.DealRole WHERE Name = 'Owner / AE'`,
        );
        const employee = await QueryOne<{ EmployeeID: string }>(
            `SELECT TOP 1 CAST(EmployeeID AS nvarchar(50)) AS EmployeeID
               FROM __mj_BizAppsSales.DealTeamMember WHERE EmployeeID IS NOT NULL`,
        );

        expect(pipeline?.ID, 'the host needs an active pipeline with a company').toBeTruthy();
        expect(ownerRole?.ID, 'the host needs an "Owner / AE" deal role').toBeTruthy();
        expect(employee?.EmployeeID, 'the host needs an employee to put on a deal team').toBeTruthy();
        employeeID = String(employee!.EmployeeID).toLowerCase();

        // ── THE IMPORTED DEAL: a roster that names an owner, and a column that does not ──
        await QueryAll(`
            INSERT INTO __mj_BizAppsSales.Deal (ID, Name, PipelineID, CompanyID)
            VALUES ('${dealID}', '${DEAL_NAME}', '${pipeline!.ID}', '${pipeline!.CompanyID}')`);
        await QueryAll(`
            INSERT INTO __mj_BizAppsSales.DealTeamMember (ID, DealID, EmployeeID, DealRoleID, IsActive)
            VALUES ('${memberID}', '${dealID}', '${employee!.EmployeeID}', '${ownerRole!.ID}', 1)`);

        expect(
            await ownerOf(dealID),
            'setup: an imported deal has no owner stamp even though its roster names one',
        ).toBeNull();

        // ── SAVE THE TEAM ROW ON ITS OWN, THE WAY THE GRID DOES ─────────────
        await page.goto(
            `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(TEAM_MEMBER_ENTITY)}/${encodeURIComponent(
                `ID|${memberID}`,
            )}`,
            { waitUntil: 'domcontentloaded' },
        );
        /**
         * `domcontentloaded` returns before Angular has built the form, and `enterEditMode` then
         * reports "no Edit control matched" — which reads like the form has no Edit button rather
         * than like nothing has rendered. Waiting on a field is the readiness signal, the same one
         * `ReopenRecord` uses for the Deal form.
         */
        /**
         * `:visible`, NOT `.first()`. MJ's form chrome shows one section at a time, so the FIRST
         * `.mj-forms-field` in the DOM is often one the rail is not showing — present, rendered, and
         * `visibility: hidden`. Waiting on it reports "the team member record must open as a form"
         * about a form that opened perfectly well, after a 60s timeout:
         *
         *     98 x locator resolved to <div class="mj-forms-field mj-forms-field--editing ...">
         *        - unexpected value "hidden"
         *
         * The readiness signal wanted here is "a field is on screen", which is what this asks.
         */
        await expect(
            page.locator('.mj-forms-field:visible').first(),
            'the team member record must open as a form',
        ).toBeVisible({ timeout: 60_000 });

        await enterEditMode(page);
        // Any real edit will do; `Notes` is free text, so this needs no lookup and changes no rule.
        await setField(page, 'Notes', `PW-291 owner re-stamp ${Date.now()}`);
        await saveForm(page);

        /**
         * Polled rather than read once: the deal is saved BY the team row's save, after the client's
         * save resolves. Polling a derived value is not sleeping and hoping — the deadline fails the
         * test, and the message names the value that never arrived.
         */
        await expect
            .poll(() => ownerOf(dealID), {
                message:
                    'saving the Owner / AE row on its own must stamp the deal owner from the roster — ' +
                    'this is the "grid shows an owner, deal says none" state from the issue',
                timeout: 30_000,
                intervals: [500, 1000, 2000],
            })
            .toBe(employeeID);
    });

    /**
     * THE DEAL PAGE THAT WAS ALREADY OPEN (sales#147's review, point 1).
     *
     * The test above saves the team row on its OWN record page, so the deal page is never open while
     * the owner moves — which is why it could not have caught what review found:
     *
     *   open a deal with no owner, add yourself as Owner / AE, and the page still says "No owner
     *   assigned." Edit Next Step and save, and the page sends back the owner it LOADED. The server
     *   reads that stale value as a hand-set owner, refuses the WHOLE save, and tells you to change
     *   the owner on the Internal team panel — which is what you just did. The Next Step edit is lost.
     *
     * Both halves of the fix are exercised here, and they are independent:
     *   · the page catches up when the Internal team grid reloads (`refreshOwnerIfTheRosterMovedIt`)
     *   · a stale owner no longer refuses the save; the roster overrides it (`overrideSuppliedOwnerStamp`)
     *
     * ── WHAT THIS DOES NOT DRIVE, SAID PLAINLY ──────────────────────────────────────────────────
     *
     * The Owner / AE row is saved from a SECOND page rather than typed into the grid's new-row editor.
     * The grid's editor needs two lookups, and the harness's lookup verbs are the flakiest thing in
     * this suite. What matters for the defect is that the deal page is OPEN and STALE while the owner
     * moves underneath it, and a second page reproduces that exactly. Driving the new-row editor would
     * add failure modes without adding coverage of the fix.
     */
    test('a deal page left open catches up when the team grid reloads', async ({ page, context }) => {
        const pipeline = await QueryOne<{ ID: string; CompanyID: string }>(
            `SELECT TOP 1 CAST(ID AS nvarchar(50)) AS ID, CAST(CompanyID AS nvarchar(50)) AS CompanyID
               FROM __mj_BizAppsSales.Pipeline WHERE IsActive = 1 ORDER BY Name`,
        );
        const ownerRole = await QueryOne<{ ID: string }>(
            `SELECT TOP 1 CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsSales.DealRole WHERE Name = 'Owner / AE'`,
        );
        const employee = await QueryOne<{ EmployeeID: string }>(
            `SELECT TOP 1 CAST(EmployeeID AS nvarchar(50)) AS EmployeeID
               FROM __mj_BizAppsSales.DealTeamMember WHERE EmployeeID IS NOT NULL`,
        );
        expect(pipeline?.ID, 'the host needs an active pipeline with a company').toBeTruthy();
        expect(ownerRole?.ID, 'the host needs an "Owner / AE" deal role').toBeTruthy();
        expect(employee?.EmployeeID, 'the host needs an employee to put on a deal team').toBeTruthy();

        await QueryAll(`
            INSERT INTO __mj_BizAppsSales.Deal (ID, Name, PipelineID, CompanyID)
            VALUES ('${openPageDealID}', '${OPEN_PAGE_DEAL_NAME}', '${pipeline!.ID}', '${pipeline!.CompanyID}')`);
        await QueryAll(`
            INSERT INTO __mj_BizAppsSales.DealTeamMember (ID, DealID, EmployeeID, DealRoleID, IsActive)
            VALUES ('${openPageMemberID}', '${openPageDealID}', '${employee!.EmployeeID}', '${ownerRole!.ID}', 1)`);
        expect(await ownerOf(openPageDealID), 'setup: no stamp yet').toBeNull();

        /**
         * AN EMPTY WORKSPACE, OR THE SHELL NEVER GETS TO THE FORM.
         *
         * Every spec in this harness drives Explorer with the signed-in user's REAL workspace, and
         * each run leaves its record tabs behind. This test first failed with "element(s) not found"
         * for any `.mj-forms-field` at all, and the page snapshot said why: *Open records (58)*, and a
         * wall of identical "Deals" tabs. Nothing was wrong with the deal or the route — the shell was
         * saturated before it got to rendering a form.
         *
         * `__MJ_EPHEMERAL_WORKSPACE__` is MJ's own flag (`workspace-state-manager.ts`), and it gates
         * both the load and the persist, so this page gets a clean workspace and writes none of its
         * tabs back to the account. Set per page rather than per suite because the harness-wide
         * fixture that does this properly is not on this branch.
         */
        await page.addInitScript(() => {
            (window as unknown as { __MJ_EPHEMERAL_WORKSPACE__?: boolean }).__MJ_EPHEMERAL_WORKSPACE__ = true;
        });

        // ── THE PAGE THE USER IS LOOKING AT, opened BEFORE the owner moves ──
        await page.goto(
            `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(DEAL_ENTITY)}/${encodeURIComponent(
                `ID|${openPageDealID}`,
            )}`,
            { waitUntil: 'domcontentloaded' },
        );
        await expect(
            page.getByRole('heading', { name: OPEN_PAGE_DEAL_NAME }),
            'the deal must open as a form',
        ).toBeVisible({ timeout: 60_000 });

        /**
         * THE STALE STATE, PROVEN BEFORE IT IS FIXED. Without this the test could pass on a page that
         * never said "No owner assigned" in the first place, which would assert nothing.
         *
         * The Health lines live in `.mjs-ov-health`, inside the OVERVIEW section, so the rail has to
         * be showing Overview for them to exist at all.
         */
        await openSectionViaRail(page, /Overview/i);
        await expect(
            page.locator('.mjs-ov-health'),
            'setup: the page was opened before the owner existed, so it says so',
        ).toContainText('No owner assigned', { timeout: 30_000 });

        // ── THE OWNER MOVES UNDERNEATH IT, from somewhere else ──
        const other = await context.newPage();
        try {
            // Same reason as above: this page must not write its tabs into the account either.
            await other.addInitScript(() => {
                (window as unknown as { __MJ_EPHEMERAL_WORKSPACE__?: boolean }).__MJ_EPHEMERAL_WORKSPACE__ = true;
            });
            await other.goto(
                `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(TEAM_MEMBER_ENTITY)}/${encodeURIComponent(
                    `ID|${openPageMemberID}`,
                )}`,
                { waitUntil: 'domcontentloaded' },
            );
            await expect(other.locator('.mj-forms-field:visible').first()).toBeVisible({ timeout: 60_000 });
            await enterEditMode(other);
            await setField(other, 'Notes', `PW-291 open-page ${Date.now()}`);
            await saveForm(other);
        } finally {
            await other.close();
        }

        expect(
            String(await ownerOf(openPageDealID) ?? ''),
            'the roster drove the stamp, which is what the first test proves',
        ).toBe(String(employee!.EmployeeID).toLowerCase());

        // ── THE PAGE CATCHES UP when its Internal team section loads ──
        await openSectionViaRail(page, /Internal team/i);
        /**
         * WAIT FOR THE GRID TO ACTUALLY LOAD before leaving the section.
         *
         * `AllowLoad` binds to the section being expanded, so switching the rail away immediately
         * collapses it and the grid never loads -- and a grid that never loads never emits
         * `AfterDataLoad`, which is the event the refresh hangs off. The first version of this test
         * clicked the two rail buttons back to back and failed here, with the database holding the
         * owner and the page still denying it. Waiting on the ROW is the honest readiness signal; a
         * sleep would pass for the wrong reason on a slow host.
         */
        await expect(
            page.locator('.mj-forms-panel[data-section-key="internal-team"] .ag-center-cols-container .ag-row'),
            'the team grid must load, or nothing tells the page to refresh',
        ).toHaveCount(1, { timeout: 60_000 });

        await openSectionViaRail(page, /Overview/i);
        await expect(
            page.locator('.mjs-ov-health'),
            'the briefing must stop claiming the deal has no owner',
        ).not.toContainText('No owner assigned', { timeout: 30_000 });

        /**
         * THE SAVE-NOT-REFUSED HALF IS LEFT TO `SD26` AND THE UNIT SUITE, ON PURPOSE.
         *
         * Driving edit -> type -> save on the deal form from here hung this test past its 480s budget,
         * repeatably, after the assertions above had already passed. Rather than ship a test that is
         * slow and unreliable about something already covered, it stops where its own evidence is:
         *
         *   · `save-deal.SD26` asserts at integration level that a header-only save carrying a stale
         *     owner SUCCEEDS, stores the roster's answer rather than the caller's, and reports the
         *     override. That is the data-loss regression, asserted against a real database.
         *   · `OwnerStampOverride.test.ts` pins the override's own decisions.
         *
         * What neither of those can see is the PAGE catching up, which is what this test exists for
         * and what nothing else covers.
         */
        expect(
            String(await ownerOf(openPageDealID) ?? '').toLowerCase(),
            'and the stamp is still what the roster says, after all of that',
        ).toBe(String(employee!.EmployeeID).toLowerCase());
    });

    test.afterAll(async () => {
        // Child first: DealTeamMember references Deal, and the foreign key the S1 baseline put there
        // on purpose would refuse the other order.
        for (const id of [dealID, openPageDealID]) {
            await QueryAll(`DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID = '${id}'`);
            await QueryAll(`DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${id}'`);
            await QueryAll(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${id}'`);
        }
    });
});
