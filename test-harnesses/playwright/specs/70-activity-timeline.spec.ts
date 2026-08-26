/**
 * LOGGING AN ACTIVITY THROUGH THE UI — and proving the write is whole.
 *
 * ⚠️ **WRITTEN BUT NEVER RUN.** Authored on `feature/forecast-query-source`, which is the only branch
 * carrying the fix this spec describes. Explorer and `MJ_V6_Host` were in use by another session, so this
 * has not been executed once. Unrun-but-ready is the honest state; the first thing the post-merge pass
 * should do is the failure demonstration at the bottom of this file, THEN the green run.
 *
 * ── THE GAP THIS EXISTS TO CLOSE ────────────────────────────────────────────────────────────────
 *
 * The pane had never worked. `Activity.LoggedByUserID` is NOT NULL with no default, the component never
 * set it, and so every attempt to log an activity failed at the database with a raw constraint error. No
 * spec existed for this surface, and no integration check could have caught it: the checks drive
 * `ActivityWriterService`, which sets the field correctly. The defect lived entirely in the browser's
 * separate copy of the composition.
 *
 * That copy is now gone. The pane calls the `Sales.LogActivity` Action, which is the same
 * `ActivityWriterService` the ingest uses. So this spec is not only a regression guard for the missing
 * field — it is the proof that the UI reaches the real composition.
 *
 * ── WHY EVERY ASSERTION IS AGAINST THE DATABASE ─────────────────────────────────────────────────
 *
 * The screen said "the activity could not be saved" before, so a screen-level assertion would have
 * caught that one. It would NOT have caught the two things that actually matter now:
 *
 *   · `LoggedByUserID` populated — invisible on screen, and the whole original defect;
 *   · the account and contact attached as participants — which the browser's old copy never did, and
 *     which no visible element reports.
 *
 * A timeline row appearing is compatible with a half-written activity. Only the rows tell them apart.
 *
 * ── CLEANUP ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Activities are titled `AT-<base36 timestamp>` so re-runs cannot collide. To clear them:
 *
 *   DELETE FROM __mj_BizAppsCommon.ActivityLink
 *    WHERE ActivityID IN (SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Title LIKE 'AT-%');
 *   DELETE FROM __mj_BizAppsCommon.Activity WHERE Title LIKE 'AT-%';
 */
import { expect, test } from '@playwright/test';

import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, drain, shot } from '../lib/explorer';
import { CloseDb, QueryAll, QueryOne } from '../lib/db';

const SALES_APP_ROUTE = '/app/sales';
const RUN_TAG = `AT-${Date.now().toString(36).toUpperCase()}`;

type Page = import('@playwright/test').Page;

const railItem = (page: Page, label: string) =>
    page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();

/**
 * A timeline field addressed by its LABEL, scoped to the pane.
 *
 * `getByLabel` is not usable here: the workspace reuses short labels ("Type", "Notes") across panes, so a
 * document-wide lookup is ambiguous and would silently bind to whichever matched first.
 */
const timelineField = (page: Page, label: string) =>
    page.locator('.dat__form label.dat__field', { hasText: new RegExp(`^\\s*${label}`) });

/** The deal this run works against, chosen from real data rather than created. */
interface Subject {
    /** `QueryOne`/`QueryAll` constrain to `Record<string, unknown>`; a row shape needs the index signature to satisfy it. */
    [key: string]: unknown;
    ID: string;
    Name: string;
    AccountID: string;
    PrimaryContactID: string;
}

/**
 * An OPEN deal that has both an account and a primary contact.
 *
 * Both are required because the assertions are about the participants the Action attaches — on a deal
 * with neither, the spec would pass while proving nothing. Chosen by the `IsOpen` FLAG rather than a
 * status name, the same rule the product code follows.
 */
async function subjectDeal(): Promise<Subject> {
    const row = await QueryOne<Subject>(`
        SELECT TOP 1 d.ID, d.Name, d.AccountID, d.PrimaryContactID
        FROM __mj_BizAppsSales.Deal d
        JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
        WHERE s.IsOpen = 1 AND s.IsActive = 1
          AND d.AccountID IS NOT NULL AND d.PrimaryContactID IS NOT NULL
        ORDER BY d.__mj_CreatedAt DESC`);
    expect(
        row,
        'no OPEN deal with both an account and a primary contact exists — seed demo data first, or this '
            + 'spec would pass without exercising the participant links it is for',
    ).toBeTruthy();
    return row as Subject;
}

/** The MJ entity registry ID for a name — what `ActivityLink.EntityID` holds. */
async function entityID(name: string): Promise<string> {
    const row = await QueryOne<{ ID: string }>(
        `SELECT ID FROM __mj.Entity WHERE Name = '${name.replace(/'/g, "''")}'`,
    );
    expect(row, `the entity '${name}' is not registered on this host`).toBeTruthy();
    return (row as { ID: string }).ID;
}

interface ActivityRow {
    /** `QueryOne`/`QueryAll` constrain to `Record<string, unknown>`; a row shape needs the index signature to satisfy it. */
    [key: string]: unknown;
    ID: string;
    Title: string;
    LoggedByUserID: string | null;
    Source: string;
    Status: string;
    ActivityTypeID: string;
}

async function activityByTitle(title: string): Promise<ActivityRow | undefined> {
    return QueryOne<ActivityRow>(`
        SELECT ID, Title, CAST(LoggedByUserID AS nvarchar(50)) AS LoggedByUserID, Source, Status,
               CAST(ActivityTypeID AS nvarchar(50)) AS ActivityTypeID
        FROM __mj_BizAppsCommon.Activity WHERE Title = '${title.replace(/'/g, "''")}'`);
}

async function linksFor(activityID: string): Promise<
    { Role: string; EntityID: string | null; RecordID: string | null; IdentityValue: string | null }[]
> {
    return QueryAll(`
        SELECT Role, CAST(EntityID AS nvarchar(50)) AS EntityID, RecordID, IdentityValue
        FROM __mj_BizAppsCommon.ActivityLink WHERE ActivityID = '${activityID}'`);
}

/** Opens the workspace with a deal loaded, ready for the timeline. */
async function openDealInWorkspace(page: Page, deal: Subject): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`);
    /**
     * NO 'Deals' HOP. `mj-left-nav` renders the SUB-PAGES of the sales section — Dashboard, All deals,
     * Board, Workspace (`sales-nav.model.ts:75-78`). The 'Deals' entry at line 64 of that same file is
     * the APP-level item and lives on a different surface entirely, so clicking for it inside
     * `mj-left-nav` waits thirty seconds and times out. The route already lands in the section.
     */
    await railItem(page, 'All deals').click();
    /**
     * SCOPED TO THE ALL-DEALS TABLE. Every page in the sales section is rendered and switched with
     * `[hidden]` rather than `@if`, so the dashboard's "Closing soonest" table is still in the DOM with
     * the same deal names in it. An unscoped `getByText(...).first()` resolves to that HIDDEN row and
     * then spends thirty seconds reporting "element is not visible" about a cell nobody can click.
     */
    await page.locator('.wrap--list table.wl tbody tr').filter({ hasText: deal.Name }).first().click();
    // The timeline renders only for a SAVED deal — it needs an ID to link an activity to.
    await expect(page.locator('.dat')).toBeVisible({ timeout: 20_000 });
}

test.describe('deal activity timeline — S-US9 through the UI', () => {
    /**
     * CLEANUP, WHICH WAS A COMMENT. Fourth file tonight after 41, 60 and 40.
     *
     * The docblock above lists two DELETEs under "To clear them", and that was the whole of it. This
     * spec writes activities through the UI, so every run left two behind on a shared host -- measured
     * after one run: the host went from its 2 seeded Outlook activities to 4.
     *
     * That matters more here than for the deal specs. These rows land in __mj_BizAppsCommon, another
     * app's schema, and they show up on a real deal's timeline -- DEAL-9001 carries the demo's two
     * ingested mails, and test rows sitting beside them are indistinguishable to anyone looking at the
     * screen.
     *
     * Scoped to THIS run's tag rather than `AT-%`, so a concurrent run's rows are never touched.
     * Links first: ActivityLink has an FK to Activity.
     */
    test.afterAll(async () => {
        await QueryAll(
            `DELETE FROM __mj_BizAppsCommon.ActivityLink
              WHERE ActivityID IN (SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Title LIKE '${RUN_TAG}%')`,
        );
        await QueryAll(`DELETE FROM __mj_BizAppsCommon.Activity WHERE Title LIKE '${RUN_TAG}%'`);
        await CloseDb();
    });

    test('logging an activity writes ONE Activity with LoggedByUserID, and links the deal, account and contact', async ({
        page,
    }) => {
        const sink = captureConsoleErrors(page);
        const deal = await subjectDeal();
        const title = `${RUN_TAG} discovery call`;

        await openDealInWorkspace(page, deal);

        await page.locator('.dat__add').click();
        await timelineField(page, 'Type').locator('select').selectOption('Call');
        await timelineField(page, 'Subject').locator('input').fill(title);
        await timelineField(page, 'Notes').locator('textarea').fill('Logged by 70-activity-timeline.spec.ts');
        await page.locator('.dat__save').click();

        /**
         * The form closing is the UI's claim of success. It is a precondition for the real assertions, not
         * a substitute: the old code showed an error here, so this alone would have caught the original
         * defect and nothing since.
         */
        await expect(page.locator('.dat__error')).toHaveCount(0);
        await expect(page.locator('.dat__form')).toHaveCount(0, { timeout: 20_000 });
        await expect(page.locator('.dat__subject', { hasText: title })).toBeVisible();
        await shot(page, 'activity-logged');

        // ── THE ROW ─────────────────────────────────────────────────────────
        const activity = await activityByTitle(title);
        expect(activity, 'the activity is not in the database — the screen agreed with the user and the data did not').toBeTruthy();

        /**
         * THE ORIGINAL DEFECT, ASSERTED. NOT NULL with no default, never set by the old pane, invisible on
         * screen. If this is null the insert could not have succeeded — so reaching this assertion at all
         * means the field is populated; it is here to name the regression if the column ever gains a
         * default and starts silently accepting NULL-equivalent writes.
         */
        expect(activity!.LoggedByUserID, 'LoggedByUserID must be populated').toBeTruthy();
        expect(activity!.Source, 'a hand-logged activity is Manual, not Integration').toBe('Manual');
        expect(activity!.Status).toBe('Logged');

        /** Resolved by CODE. The type row asked for must be the one whose `Code` is `Call`. */
        const callType = await QueryOne<{ ID: string }>(
            `SELECT CAST(ID AS nvarchar(50)) AS ID FROM __mj_BizAppsCommon.ActivityType WHERE Code = 'Call'`,
        );
        expect(callType, "no ActivityType with Code 'Call' — bizapps-common seeds six").toBeTruthy();
        expect(activity!.ActivityTypeID.toLowerCase()).toBe((callType as { ID: string }).ID.toLowerCase());

        // ── EXACTLY ONE ─────────────────────────────────────────────────────
        const duplicates = await QueryAll(
            `SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Title = '${title.replace(/'/g, "''")}'`,
        );
        expect(duplicates.length, 'exactly one Activity row — a retry must not double it').toBe(1);

        // ── THE LINKS ───────────────────────────────────────────────────────
        const links = await linksFor(activity!.ID);
        const dealEntity = (await entityID('MJ_BizApps_Sales: Deals')).toLowerCase();
        const personEntity = (await entityID('MJ_BizApps_Common: People')).toLowerCase();
        const orgEntity = (await entityID('MJ_BizApps_Common: Organizations')).toLowerCase();

        const anchor = links.find((l) => (l.EntityID ?? '').toLowerCase() === dealEntity);
        expect(anchor, 'an activity with no Regarding link to the deal is unreachable from every surface').toBeTruthy();
        expect(anchor!.Role).toBe('Regarding');
        expect(anchor!.RecordID!.toLowerCase()).toBe(deal.ID.toLowerCase());

        /**
         * THE PARTICIPANTS THE OLD PANE NEVER ATTACHED, and the reason routing through the Action was the
         * fix rather than adding a field. `Deal.AccountID` IS the Organization ID and `Deal.PrimaryContactID`
         * IS the Person ID — shared-primary-key IsA — so these values cross over unchanged.
         */
        const org = links.find((l) => (l.EntityID ?? '').toLowerCase() === orgEntity);
        const person = links.find((l) => (l.EntityID ?? '').toLowerCase() === personEntity);
        expect(org, "the deal's account must be attached as a participant").toBeTruthy();
        expect(person, "the deal's primary contact must be attached as a participant").toBeTruthy();
        expect(org!.RecordID!.toLowerCase()).toBe(deal.AccountID.toLowerCase());
        expect(person!.RecordID!.toLowerCase()).toBe(deal.PrimaryContactID.toLowerCase());

        /** Parties go under COMMON's entities, never the sales children. See `activity-vocabulary.ts`. */
        const salesContact = await QueryOne<{ ID: string }>(
            `SELECT CAST(ID AS nvarchar(50)) AS ID FROM __mj.Entity WHERE Name = 'MJ_BizApps_Sales: Sales Contacts'`,
        );
        if (salesContact) {
            expect(
                links.some((l) => (l.EntityID ?? '').toLowerCase() === salesContact.ID.toLowerCase()),
                'no link may point at Sales Contacts — the convention is common\'s People',
            ).toBe(false);
        }

        expect(drain(sink), 'no console errors while logging').toEqual([]);
    });

    test('a REFUSED log leaves nothing behind — the atomicity a browser cannot provide', async ({ page }) => {
        const deal = await subjectDeal();
        const title = `${RUN_TAG} will be refused`;

        await openDealInWorkspace(page, deal);

        const before = await QueryAll(
            `SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Title LIKE '${RUN_TAG}%'`,
        );

        /**
         * FORCING A REFUSAL FROM THE UI, without touching the database.
         *
         * The Action refuses an unparseable `StartedAt` rather than defaulting it to now — a deliberate
         * choice, because a timeline is ordered by `StartedAt` and a silent fallback files the activity at
         * the wrong point. Clearing the datetime input and typing nonsense is the one refusal reachable
         * through the form alone; every other input the form produces is valid by construction.
         *
         * If the browser rejects the value before it is sent (a native `datetime-local` may), the fill
         * below leaves the field empty, the Action treats that as "now", and the log SUCCEEDS. That is why
         * the assertion is on the INVARIANT — no half-written activity — rather than on seeing an error.
         */
        await page.locator('.dat__add').click();
        await timelineField(page, 'Subject').locator('input').fill(title);
        const when = timelineField(page, 'When').locator('input');
        await when.fill('');
        await when.evaluate((el: HTMLInputElement) => {
            el.value = 'not-a-date';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.locator('.dat__save').click();
        await page.waitForTimeout(2_000);
        await shot(page, 'activity-refused');

        /**
         * THE INVARIANT, WHICHEVER WAY IT WENT. Either the Action refused and NOTHING was written, or it
         * accepted and a COMPLETE activity was written. What must never exist is an Activity with no
         * links — the state the old two-save pane produced on a link failure, committed and unreachable
         * from every surface.
         */
        const orphans = await QueryAll(`
            SELECT a.ID FROM __mj_BizAppsCommon.Activity a
            WHERE a.Title LIKE '${RUN_TAG}%'
              AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.ActivityLink l WHERE l.ActivityID = a.ID)`);
        expect(
            orphans.length,
            'an Activity with no links is committed and unreachable — exactly what routing through the '
                + 'Action was meant to make impossible',
        ).toBe(0);

        const after = await QueryAll(
            `SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Title LIKE '${RUN_TAG}%'`,
        );
        expect(
            after.length - before.length,
            'a refusal writes nothing; an acceptance writes exactly one',
        ).toBeLessThanOrEqual(1);
    });

    /**
     * S-US9's THIRD CRITERION, which the story audit recorded as NOT ESTABLISHED until now.
     *
     * The issue asks: "Activities on a closed deal remain visible; whether new ones can be added to a
     * closed deal follows the same rule as other open-on-purpose fields."
     *
     * `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` is that rule, and close-lock.ts gives the reasoning: the lock
     * is field-by-field rather than a wall "because a closed deal still needs notes: someone has to be
     * able to write 'customer asked about renewal' without reopening the deal and falsifying its
     * provenance". Description and NextStep stay open for exactly that.
     *
     * An activity is the same kind of thing -- the workspace template calls the timeline "a record of
     * what happened rather than a part of the draft" -- so logging must stay available. This asserts
     * that, and asserts the lock is genuinely ON first, so a green result cannot come from having
     * opened an OPEN deal by accident.
     */
    test('a CLOSED deal keeps its timeline, and logging follows the open-on-purpose rule', async ({ page }) => {
        const sink = captureConsoleErrors(page);

        /** BY THE FLAG, never by name -- a renamed seed must not silently stop testing the locked case. */
        const locked = await QueryOne<Subject>(`
            SELECT TOP 1 d.ID, d.Name, d.AccountID, d.PrimaryContactID
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
             WHERE s.LocksDeal = 1 AND d.AccountID IS NOT NULL AND d.PrimaryContactID IS NOT NULL
             ORDER BY d.DealNumber`);
        expect(
            locked,
            'the host needs a CLOSED deal with an account and a contact, or this criterion cannot be exercised',
        ).toBeTruthy();

        await openDealInWorkspace(page, locked as Subject);

        await expect(page.locator('.dat'), 'a closed deal must still show its activity timeline').toBeVisible({
            timeout: 20_000,
        });

        /** PROVE THE LOCK IS ON, so everything below is not a green result on an open deal. */
        await expect(
            page.locator('.dw-field', { hasText: 'Deal name' }).first().locator('input').first(),
            'the deal name sits OUTSIDE the editable-while-locked set, so it must be frozen -- if this is '
                + 'enabled the deal is not actually locked and the rest of this test proves nothing',
        ).toBeDisabled({ timeout: 20_000 });

        await expect(
            page.locator('.dat__add'),
            'logging must stay available on a closed deal, the same way Description and NextStep do',
        ).toBeEnabled({ timeout: 20_000 });

        /** AND IT MUST LAND. An offered button that writes nothing is the worse failure of the two. */
        const title = `${RUN_TAG} post-close note`;
        await page.locator('.dat__add').click();
        await timelineField(page, 'Type').locator('select').selectOption('Note');
        await timelineField(page, 'Subject').locator('input').fill(title);
        await timelineField(page, 'Notes').locator('textarea').fill('Logged against a CLOSED deal by 70-activity-timeline.spec.ts');
        await page.locator('.dat__save').click();

        await expect(page.locator('.dat__error'), 'logging on a closed deal must not error').toHaveCount(0, {
            timeout: 20_000,
        });
        await expect(page.locator('.dat__form')).toHaveCount(0, { timeout: 20_000 });

        const row = await activityByTitle(title);
        expect(row, 'the activity must exist in the database, not merely on the screen').toBeTruthy();

        const links = await linksFor((row as { ID: string }).ID);
        expect(links.length, 'and it must carry its participant links like any other activity').toBeGreaterThan(0);

        await shot(page, '70-closed-deal-logging');
        drain(sink);
    });
});

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  HOW TO MAKE THESE FAIL — do this FIRST on the post-merge run, before trusting a green result
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * A spec that has never failed has never been shown to test anything. These are the mutations, each
 * reverting a specific piece of the fix, with the assertion that must go red. Apply one, rebuild
 * `packages/Angular` and `packages/Server`, run, restore.
 *
 * 1. **The original defect.** In `log-activity.action.ts`, set `IncludeDealParties: false` on the
 *    `LogActivity` input. It must be set to false EXPLICITLY, not deleted: the writer guards on
 *    `input.IncludeDealParties !== false`, so an absent flag still attaches the parties and the
 *    mutation would be a no-op that reads as a surviving mutant.
 *    → the account/contact participant assertions must fail. If they pass, the spec is not reading the
 *    links it claims to.
 *
 * 2. **The composition regression.** In `deal-activity-timeline.component.ts`, replace the
 *    `client.RunAction(...)` call with the old hand-written pair — `GetEntityObject('…Activities')`,
 *    set the fields, save, then save a link — omitting `LoggedByUserID`.
 *    → the FIRST test must fail at the screen (`.dat__error` non-empty), which is the defect as a user met
 *    it. This is the one mutation that reproduces the original bug end to end.
 *
 * 3. **Atomicity.** In `ActivityWriterService.LogActivity`, replace `await scope.Rollback()` on the
 *    link-write failure path with `await scope.Commit()`, and make `writeLink` return `false`
 *    unconditionally.
 *    → the SECOND test's orphan query must find a row. If it does not, the orphan assertion is not
 *    reachable and needs a different provocation.
 *
 * 4. **Type resolution.** In `activity-vocabulary.ts` change nothing; instead in the Action swap
 *    `TypeCode: code` for a hardcoded `'Note'`.
 *    → the `ActivityTypeID` assertion must fail. This guards the code-not-name lookup from the UI side.
 *
 * 5. **The link convention.** In `activity-vocabulary.ts` set
 *    `E_PERSON = 'MJ_BizApps_Sales: Sales Contacts'`.
 *    → the person-link assertion AND the no-Sales-Contacts assertion must both fail.
 *
 * If any mutation leaves the suite green, the corresponding assertion is decorative and should be fixed
 * before the spec is trusted — that is what happened to `AC14`, which spent a day asserting a defect.
 */
