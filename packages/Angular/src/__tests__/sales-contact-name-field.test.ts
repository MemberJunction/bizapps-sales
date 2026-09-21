import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newestViewDefiner, viewBody } from './helpers/view-definer';

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
 */

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'migrations');
const VIEW = 'vwSalesContacts';

/** The migration the database actually runs last for this view. Throws rather than guess. */
const definer = newestViewDefiner(MIGRATIONS, VIEW);

/**
 * The definer's RAW text, comments included. Needed by exactly one assertion below, which is
 * deliberately about a COMMENT — `0,   -- AutoUpdateIsNameField` is how the positional INSERT says
 * which column that zero belongs to, and stripping comments would take the only label with it.
 */
const definerSql = readFileSync(join(MIGRATIONS, definer.file), 'utf8');

/** The `CREATE VIEW` body, comments stripped, so prose quoting a rule cannot satisfy one. */
const definerBody = viewBody(definer.code, VIEW);

/** Sorted, so "must precede the wrapper" is a real ordering claim and not a directory accident. */
function migrations(): string[] {
    return readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
}

/**
 * The migration that hands CodeGen a private view name FOR SALES CONTACTS. Keyed on both markers:
 * `[BaseViewGenerated] = 0` alone now matches the Deals layering migration too.
 */
function flagsMigration(): string {
    const hit = migrations().find((f) => {
        const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
        return sql.includes('[BaseViewGenerated] = 0') && sql.includes("'MJ_BizApps_Sales: Sales Contacts'");
    });
    expect(hit, 'a migration must set BaseViewGenerated = 0 for Sales Contacts').toBeDefined();
    return hit as string;
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
        expect(definerSql).toMatch(/AutoUpdateIsNameField/);
        expect(definerSql, 'the column must be written as 0, not left to its default of 1')
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
        expect(flags < definer.file, 'the flags must sort before the wrapper').toBe(true);
    });

    /** Keyed by entity NAME: entity ids are minted per database, so a UUID stops matching on rebuild. */
    it('is keyed by entity name, never by a hardcoded id', () => {
        const sql = readFileSync(join(MIGRATIONS, flagsMigration()), 'utf8');
        expect(sql).toContain("'MJ_BizApps_Sales: Sales Contacts'");
        expect(sql).not.toMatch(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/);
    });
});
