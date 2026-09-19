import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 */

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'migrations');

/** Found by CONTENT, not by filename — a renamed or renumbered migration still has to satisfy this. */
function migrationContaining(needle: string): string {
    const hit = readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
        .find((sql) => sql.includes(needle));
    expect(hit, `no migration contains ${needle}`).toBeDefined();
    return hit as string;
}

describe('the Sales Contact name field', () => {
    /**
     * THE FLAG THAT KEEPS IT. `AutoUpdateIsNameField` defaults to 1, meaning the next CodeGen run
     * re-derives IsNameField from the schema — and schema-derivation is what produced no name field in
     * the first place, because no inherited column is called Name. Left on, the next codegen quietly
     * clears the flag and the pickers go back to GUIDs with nothing in the diff to explain it.
     */
    it('turns off the auto-update that would clear it on the next codegen', () => {
        const sql = migrationContaining('DisplayNameAndEmail');
        expect(sql).toMatch(/AutoUpdateIsNameField/);
        expect(sql, 'the column must be written as 0, not left to its default of 1')
            .toMatch(/0,\s*--\s*AutoUpdateIsNameField/);
    });

    /**
     * CONCAT, NOT `+`. `NULL + ' (' + email + ')'` is NULL in T-SQL, which would produce a BLANK name
     * field — the same defect, in the one case nobody seeds data for.
     */
    it('builds the string with CONCAT so a null name cannot blank the whole value', () => {
        const sql = migrationContaining('DisplayNameAndEmail');
        const view = sql.slice(sql.indexOf('CREATE VIEW'), sql.indexOf('GO', sql.indexOf('CREATE VIEW')));
        expect(view).toContain('CONCAT(');
        expect(view, 'string concatenation with + propagates NULL').not.toMatch(/\]\s*\+\s*'/);
    });

    /** An empty or whitespace email must give the bare name, not a trailing empty bracket. */
    it('treats a blank email as no email', () => {
        const sql = migrationContaining('DisplayNameAndEmail');
        expect(sql).toContain("NULLIF(LTRIM(RTRIM(p.[PrimaryEmail])), '')");
    });

    /**
     * READS COMMON'S VIEW rather than re-deriving. `PrimaryEmail` is a contact-method lookup with a
     * fallback, and `DisplayName` comes out of common's own generated view — copying either into sales
     * would drift the first time common changed it, and would put a second app in charge of what a
     * person is called.
     */
    it('derives both halves from common rather than restating its rules', () => {
        const sql = migrationContaining('DisplayNameAndEmail');
        expect(sql).toContain('[__mj_BizAppsCommon].[vwPeople]');
        /**
         * Scoped to the VIEW BODY, not the file. The header explains what common's rule IS — naming
         * `COALESCE(cm_email.Value, g.Email)` to say why it must not be copied — so a file-wide check
         * failed on its own documentation. A test that cannot tell code from a comment about code is
         * asserting about the wrong text.
         */
        const view = sql.slice(sql.indexOf('CREATE VIEW'), sql.indexOf('GO', sql.indexOf('CREATE VIEW')));
        expect(view, 'the contact-method fallback belongs to common').not.toContain('cm_email');
    });

    /**
     * THE FLAGS MIGRATION MUST EXIST AND MUST PRECEDE THE WRAPPER. Without BaseViewGenerated = 0, the
     * first codegen on a fresh environment resolves to the PUBLIC name and DROP/CREATEs vwSalesContacts
     * as a plain generated view, destroying the wrapper silently.
     */
    it('hands CodeGen a private view name, in an earlier migration than the wrapper', () => {
        const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
        const flags = files.find((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes("[BaseViewGenerated] = 0"));
        const wrapper = files.find((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes('DisplayNameAndEmail'));
        expect(flags, 'a migration must set BaseViewGenerated = 0').toBeDefined();
        expect(wrapper).toBeDefined();
        expect(flags! < wrapper!, 'the flags must sort before the wrapper').toBe(true);
    });

    /** Keyed by entity NAME: entity ids are minted per database, so a UUID stops matching on rebuild. */
    it('is keyed by entity name, never by a hardcoded id', () => {
        const sql = migrationContaining("[BaseViewGenerated] = 0");
        expect(sql).toContain("'MJ_BizApps_Sales: Sales Contacts'");
        expect(sql).not.toMatch(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/);
    });
});
