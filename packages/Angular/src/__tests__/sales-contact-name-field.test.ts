import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationFiles, newestViewDefiner, viewBody } from './helpers/view-definer';

/**
 * THE SALES CONTACT PICKER SHOWED GUIDS.
 *
 * `Sales Contacts` had no name field at all — IsNameField was false on all 30 registered fields — so
 * every lookup to it rendered a raw id. It is an IS-A asymmetry: `vwSalesAccounts` inherits `Name` from
 * Organization and CodeGen auto-marks it, while Person's name field is `DisplayName`, which is COMPUTED
 * in vwPeople rather than stored on the Person table. The generated child view joins the TABLE, so the
 * one column that names a person could not be inherited and CodeGen correctly found nothing to mark.
 *
 * The fix is a layered base view adding `DisplayNameAndEmail`. These assertions cover the two ways it
 * silently un-fixes itself — both of which are invisible in a diff and only show up as GUIDs coming
 * back, which is precisely the defect returning.
 *
 * HOW THIS FILE FINDS ITS MIGRATION, AND WHY IT CHANGED. It used to search for the FIRST file whose
 * text contained `DisplayNameAndEmail`, over an UNSORTED `readdirSync`. Three things were wrong with
 * that, and they compound:
 *
 *   - Unsorted. `readdirSync` order is filesystem order, so which file satisfied the marker was not
 *     decided by this repo at all. The sibling assertion below keyed on `[BaseViewGenerated] = 0`,
 *     which TWO migrations now contain, and the one it happened not to pick is full of GUIDs that
 *     its own `not.toMatch` would have rejected. It was passing by luck of directory order.
 *   - First match, not last. Migrations apply in order and the LAST definer is the one the database
 *     ends up running. Resolving to an earlier one means asserting, truthfully, about SQL that has
 *     since been replaced.
 *   - The marker is not a definer. A future re-creation of `vwSalesContacts` would also contain the
 *     string `DisplayNameAndEmail`, so the search would keep finding the old file while the new one
 *     quietly dropped a predicate. That is exactly how bizapps-contracts PR #59's guard stayed green
 *     while `IsAwaitingDocument` lost its joins.
 *
 * So the migration is now resolved by `newestViewDefiner`, which matches any DDL naming the view —
 * `DROP VIEW` + `CREATE VIEW` included, which is how this one is written — and throws if anything
 * later carries view DDL naming it without matching. `layered-view-guard.test.ts` covers the
 * layered-view invariants; every assertion this file already made is kept below, and several now
 * read the executable view body instead of the whole file, which is strictly harder to satisfy.
 *
 * TWO THINGS THAT REPOINTING GOT WRONG, AND HOW THEY READ NOW:
 *
 *   - NOT EVERY ASSERTION BELONGS TO THE VIEW. `AutoUpdateIsNameField` is written by a ONE-TIME
 *     `EntityField` INSERT, not by the view; reading it off the newest VIEW definer only passed
 *     because both happen to sit in the same migration today, and would have failed — unfixably —
 *     on the first legitimate re-creation of `vwSalesContacts`. Each assertion now resolves the
 *     migration that actually carries the statement it is about.
 *   - FILENAME ORDER IS NOT APPLY ORDER. "The flags must precede the wrapper" was a `<` between two
 *     filenames. Flyway runs every repeatable after every versioned migration, so an
 *     `R__` flags migration passed that comparison while the database applied it AFTER the wrapper,
 *     destroying the wrapper on a fresh install — precisely the failure the assertion exists to
 *     prevent. It now compares positions in `migrationFiles`, which is Flyway's own order.
 */

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'migrations');
const VIEW = 'vwSalesContacts';

/** The migration the database actually runs last for this view. Throws rather than guess. */
const definer = newestViewDefiner(MIGRATIONS, VIEW);

/** The `CREATE VIEW` body, comments stripped, so prose quoting a rule cannot satisfy one. */
const definerBody = viewBody(definer.code, VIEW);

/**
 * IN THE ORDER FLYWAY APPLIES THEM, which is not the order the filenames sort in. A repeatable
 * (`R__`) sorts before every `V__` and runs after all of them, and a `V<ts>.1__` hotfix sorts before
 * `V<ts>__` because `.` < `_` — so a filename comparison is a claim about the directory listing,
 * not about the database.
 */
const APPLY_ORDER = migrationFiles(MIGRATIONS);

/** The raw text of one migration, comments included. */
function migrationSql(file: string): string {
    return readFileSync(join(MIGRATIONS, file), 'utf8');
}

/**
 * The LAST migration in apply order whose text matches every marker — last, because a marker
 * present in several migrations is decided by which one the database runs last, never by which one
 * a directory listing happens to hand back first.
 */
function migrationCarrying(what: string, ...markers: string[]): string {
    const hits = APPLY_ORDER.filter((file) => {
        const sql = migrationSql(file);
        return markers.every((marker) => sql.includes(marker));
    });
    expect(hits, `a migration must ${what}`).not.toEqual([]);
    return hits[hits.length - 1];
}

/**
 * The migration that hands CodeGen a private view name FOR SALES CONTACTS. Keyed on both markers:
 * `[BaseViewGenerated] = 0` alone now matches the Deals layering migration too.
 */
function flagsMigration(): string {
    return migrationCarrying(
        'set BaseViewGenerated = 0 for Sales Contacts',
        '[BaseViewGenerated] = 0',
        "'MJ_BizApps_Sales: Sales Contacts'",
    );
}

/**
 * The migration that REGISTERS the DisplayNameAndEmail field — a ONE-TIME `EntityField` INSERT, and
 * the only place `AutoUpdateIsNameField` is ever written for this entity.
 *
 * THIS USED TO READ THE NEWEST VIEW DEFINER, which was my mistake when I repointed this file at
 * `newestViewDefiner`. The flag and the wrapper happen to live in the same migration TODAY, so the
 * assertion passed — but they are different kinds of statement with different lifetimes. The view
 * is re-created every time the schema changes; the `EntityField` row is inserted once and must
 * never be inserted again. So the first legitimate re-creation of `vwSalesContacts` moves the
 * newest definer to a migration that CANNOT contain this INSERT, and the assertion fails with no
 * correct way to satisfy it — a guard that would have to be deleted to do the right thing.
 */
function nameFieldMigration(): string {
    return migrationCarrying(
        'register DisplayNameAndEmail with AutoUpdateIsNameField for Sales Contacts',
        'AutoUpdateIsNameField',
        "'MJ_BizApps_Sales: Sales Contacts'",
    );
}

describe('the Sales Contact name field', () => {
    it('is defined by a migration nothing later redefines unseen', () => {
        expect(definer.file).toBeTruthy();
        expect(definerBody, `${definer.file} has no CREATE VIEW body for ${VIEW}`).toBeTruthy();
    });

    /**
     * THE FLAG THAT KEEPS IT. `AutoUpdateIsNameField` defaults to 1, meaning the next CodeGen run
     * re-derives IsNameField from the schema — and schema-derivation is what produced no name field in
     * the first place, because no inherited column is called Name. Left on, the next codegen quietly
     * clears the flag and the pickers go back to GUIDs with nothing in the diff to explain it.
     */
    it('turns off the auto-update that would clear it on the next codegen', () => {
        // Read RAW, comments included, and deliberately so: `0,   -- AutoUpdateIsNameField` is how
        // the positional INSERT says which column that zero belongs to, and stripping comments
        // would take the only label with it.
        const sql = migrationSql(nameFieldMigration());
        expect(sql, 'the column must be written as 0, not left to its default of 1')
            .toMatch(/0,\s*--\s*AutoUpdateIsNameField/);
    });

    /**
     * CONCAT, NOT `+`. `NULL + ' (' + email + ')'` is NULL in T-SQL, which would produce a BLANK name
     * field — the same defect, in the one case nobody seeds data for.
     */
    it('builds the string with CONCAT so a null name cannot blank the whole value', () => {
        expect(definerBody).toContain('CONCAT(');
        expect(definerBody, 'string concatenation with + propagates NULL').not.toMatch(/\]\s*\+\s*'/);
    });

    /** An empty or whitespace email must give the bare name, not a trailing empty bracket. */
    it('treats a blank email as no email', () => {
        expect(definerBody).toContain("NULLIF(LTRIM(RTRIM(p.[PrimaryEmail])), '')");
    });

    /**
     * READS COMMON'S VIEW rather than re-deriving. `PrimaryEmail` is a contact-method lookup with a
     * fallback, and `DisplayName` comes out of common's own generated view — copying either into sales
     * would drift the first time common changed it, and would put a second app in charge of what a
     * person is called.
     */
    it('derives both halves from common rather than restating its rules', () => {
        /**
         * Scoped to the VIEW BODY, not the file. The header explains what common's rule IS — naming
         * `COALESCE(cm_email.Value, g.Email)` to say why it must not be copied — so a file-wide check
         * failed on its own documentation. A test that cannot tell code from a comment about code is
         * asserting about the wrong text.
         */
        expect(definerBody).toContain('[__mj_BizAppsCommon].[vwPeople]');
        expect(definerBody, 'the contact-method fallback belongs to common').not.toContain('cm_email');
    });

    /**
     * THE FLAGS MIGRATION MUST EXIST AND MUST PRECEDE THE WRAPPER. Without BaseViewGenerated = 0, the
     * first codegen on a fresh environment resolves to the PUBLIC name and DROP/CREATEs vwSalesContacts
     * as a plain generated view, destroying the wrapper silently.
     */
    it('hands CodeGen a private view name, in an earlier migration than the wrapper', () => {
        const flags = flagsMigration();
        // COMPARED IN APPLY ORDER, NOT BY FILENAME. `flags < definer.file` is a string comparison
        // over names, and Flyway does not run migrations in that order: an `R__Layered_Views.sql`
        // sorts before every `V__` and is applied after all of them, so moving the flags into a
        // repeatable would have passed this test green while the database ran it AFTER the wrapper
        // — the exact sequence this assertion exists to forbid.
        const flagsAt = APPLY_ORDER.indexOf(flags);
        const wrapperAt = APPLY_ORDER.indexOf(definer.file);
        expect(flagsAt, `${flags} is not a migration Flyway applies`).toBeGreaterThanOrEqual(0);
        expect(wrapperAt, `${definer.file} is not a migration Flyway applies`).toBeGreaterThanOrEqual(0);
        expect(flagsAt, `Flyway applies ${flags} after the wrapper ${definer.file}`)
            .toBeLessThan(wrapperAt);
    });

    /** Keyed by entity NAME: entity ids are minted per database, so a UUID stops matching on rebuild. */
    it('is keyed by entity name, never by a hardcoded id', () => {
        const sql = migrationSql(flagsMigration());
        expect(sql).toContain("'MJ_BizApps_Sales: Sales Contacts'");
        expect(sql).not.toMatch(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/);
    });
});
