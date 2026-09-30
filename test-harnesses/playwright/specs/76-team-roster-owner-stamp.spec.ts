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

const TEAM_MEMBER_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';
/** `PW-` so the harness's own sweep removes it even if `afterAll` never runs. */
const DEAL_NAME = `PW-291-restamp-${Date.now()}`;

const dealID = randomUUID();
const memberID = randomUUID();
let employeeID = '';

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
        await expect(
            page.locator('.mj-forms-field').first(),
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

    test.afterAll(async () => {
        // Child first: DealTeamMember references Deal, and the foreign key the S1 baseline put there
        // on purpose would refuse the other order.
        await QueryAll(`DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID = '${dealID}'`);
        await QueryAll(`DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${dealID}'`);
        await QueryAll(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`);
    });
});
