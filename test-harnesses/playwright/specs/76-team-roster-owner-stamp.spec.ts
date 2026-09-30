/**
 * @fileoverview golive#291 point 2, against a real Explorer: saving a `DealTeamMember` on its own
 * re-derives the deal's owner from the roster.
 *
 * ── IT REPRODUCES THE REPORTED SYMPTOM, NOT AN ANALOGUE OF IT ───────────────────────────────────
 *
 * The issue describes a deal whose team grid shows an Owner / AE while the deal still reports "No
 * owner assigned". That is a deal row whose `OwnerEmployeeID` disagrees with its roster, so the
 * setup puts the database in exactly that state -- owner cleared, roster untouched -- and then saves
 * the team row the way the grid does.
 *
 * Before the fix that save did nothing to the deal: `stampOwnerFromTeam()` is guarded by
 * `RosterDrivesThisSave`, which is false when a team row is saved by itself, so the deal kept
 * reporting no owner. With `DealTeamMemberEntityServer` the save re-derives it. The assertion is
 * that the deal REPAIRS itself, which cannot pass without something re-deriving on that save.
 *
 * ── WHY IT EDITS THE ROW RATHER THAN USING THE GRID ─────────────────────────────────────────────
 *
 * The grid is MJ's generic related-entity grid, and adding or re-roling a member goes through a
 * foreign-key lookup that offers no rows on this host -- it is what stops nine other specs, and has
 * nothing to do with this change. Editing the record is not a lesser test: the subclass exists
 * BECAUSE the rule belongs to the deal rather than one screen, and its own reasoning is that "an
 * importer, an Action or a direct write against DealTeamMember reaches the same state". This is that
 * write, performed through the real client against a real MJAPI. `Notes` is a plain text column, so
 * nothing here needs a lookup.
 *
 * ── WHAT IT DELIBERATELY DOES NOT ASSERT ────────────────────────────────────────────────────────
 *
 * Deactivating the owner row does NOT clear the deal's owner, and this spec no longer claims it
 * does. `stampOwnerFromTeam()` matches on `DealRoleID` alone and never reads `IsActive`, as does
 * `DealEntity.SetOwner`, so an inactive member still owns the deal. That is pre-existing behaviour
 * in both, not something this change introduced -- but the change's own summary lists "deactivated"
 * alongside "role changed" as cases it catches, and only the second is true today.
 */
import { expect, test } from '@playwright/test';

import { QueryAll, QueryOne } from '../lib/db';
import { EXPLORER_BASE_URL } from '../lib/env';
import { enterEditMode, saveForm, setField } from '../lib/explorer';

const TEAM_MEMBER_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';

/**
 * A type alias rather than an interface: `QueryOne` constrains to `Record<string, unknown>`, and an
 * interface carries no implicit index signature so it does not satisfy that constraint.
 */
type Target = {
    MemberID: string;
    DealID: string;
    DealName: string;
    EmployeeID: string;
    Notes: string | null;
};

let target: Target | undefined;

/** The deal's stamped owner, lowercased, or null. */
async function ownerOf(dealID: string): Promise<string | null> {
    const row = await QueryOne<{ OwnerEmployeeID: string | null }>(
        `SELECT CAST(OwnerEmployeeID AS nvarchar(50)) AS OwnerEmployeeID
           FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
    );
    return row?.OwnerEmployeeID ? String(row.OwnerEmployeeID).toLowerCase() : null;
}

test.describe('golive#291 — a team row saved on its own re-derives the deal owner', () => {
    test('a deal whose owner was lost repairs itself when its Owner / AE row is saved', async ({ page }) => {
        /**
         * Resolved by QUERY, not by a hardcoded id, so this describes the rule rather than one host.
         * The shape it needs is a deal currently owned by its active Owner / AE member -- that is the
         * state the owner will be knocked out of and must return to.
         */
        const found = await QueryOne<Target>(`
            SELECT TOP 1 CAST(tm.ID AS nvarchar(50)) AS MemberID,
                         CAST(d.ID AS nvarchar(50)) AS DealID,
                         d.Name AS DealName,
                         CAST(tm.EmployeeID AS nvarchar(50)) AS EmployeeID,
                         tm.Notes AS Notes
              FROM __mj_BizAppsSales.DealTeamMember tm
              JOIN __mj_BizAppsSales.Deal d ON d.ID = tm.DealID
              JOIN __mj_BizAppsSales.DealRole r ON r.ID = tm.DealRoleID
             WHERE r.Name = 'Owner / AE' AND tm.IsActive = 1 AND tm.EmployeeID = d.OwnerEmployeeID
             ORDER BY d.Name`);

        expect(
            found?.MemberID,
            'the host needs a deal owned by its active Owner / AE member',
        ).toBeTruthy();
        target = found;
        const employee = String(found!.EmployeeID).toLowerCase();

        /**
         * ── PUT THE DATABASE IN THE REPORTED STATE ──────────────────────────────────────────────
         *
         * Straight to SQL rather than through the UI: the point is a deal whose stamp disagrees with
         * its roster, and every UI route to that state goes through the very save being tested. The
         * roster is left exactly as it was, so the only thing wrong is the deal's own column.
         */
        await QueryAll(`UPDATE __mj_BizAppsSales.Deal SET OwnerEmployeeID = NULL WHERE ID = '${found!.DealID}'`);
        expect(
            await ownerOf(found!.DealID),
            'setup: the deal must start with no owner while its roster still names one',
        ).toBeNull();

        // ── SAVE THE TEAM ROW ON ITS OWN, THE WAY THE GRID DOES ─────────────
        await page.goto(
            `${EXPLORER_BASE_URL}/resource/record/${encodeURIComponent(TEAM_MEMBER_ENTITY)}/${encodeURIComponent(
                `ID|${found!.MemberID}`,
            )}`,
            { waitUntil: 'domcontentloaded' },
        );
        /**
         * `domcontentloaded` returns before Angular has built the form, and `enterEditMode` reports
         * "no Edit control matched" when it is merely early -- which reads like the form has no Edit
         * button rather than like nothing has rendered. Waiting on a field is the readiness signal,
         * the same one `ReopenRecord` uses for the Deal form.
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
         * Polled rather than read once: the deal is saved by the team row's save, after the client's
         * save resolves. Polling a derived value is not sleeping and hoping -- the deadline is what
         * fails the test, and the message names the value that never arrived.
         */
        await expect
            .poll(() => ownerOf(found!.DealID), {
                message:
                    'saving the Owner / AE row on its own must re-derive the deal owner from the roster — ' +
                    'this is the "grid shows an owner, deal says none" state from the issue',
                timeout: 30_000,
                intervals: [500, 1000, 2000],
            })
            .toBe(employee);
    });

    test.afterAll(async () => {
        // Repairs seeded data by id however the body exited. A run that failed after the UPDATE would
        // otherwise leave a seeded deal ownerless and quietly change what every later spec reads.
        if (!target?.MemberID) return;
        await QueryAll(
            `UPDATE __mj_BizAppsSales.Deal SET OwnerEmployeeID = '${target.EmployeeID}' WHERE ID = '${target.DealID}'`,
        );
        const notes = target.Notes === null ? 'NULL' : `'${String(target.Notes).replace(/'/g, "''")}'`;
        await QueryAll(
            `UPDATE __mj_BizAppsSales.DealTeamMember SET Notes = ${notes} WHERE ID = '${target.MemberID}'`,
        );
    });
});
