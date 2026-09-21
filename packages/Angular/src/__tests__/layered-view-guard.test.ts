/**
 * @fileoverview The guard that would have caught bizapps-contracts PR #59, for this repo's views.
 *
 * `vwDeals` had no guard at all: eight derived columns, two aggregate derived tables, and a
 * `DROP VIEW` + `CREATE VIEW` definer. `vwSalesContacts` had one — `sales-contact-name-field.test.ts`
 * — but it resolved its migration with `readdirSync(...).find()`, which is UNSORTED and takes the
 * FIRST match, keyed on a marker (`DisplayNameAndEmail`) that any future re-creation of the view
 * would also contain. That guard now resolves its file through `newestViewDefiner` instead; every
 * assertion it already made is still there, and this file adds the layered-view invariants on top.
 *
 * Three assertions per view, and they fail for different reasons on purpose.
 *
 * 1. THE NEWEST DEFINER IS THE ONE WE THINK IT IS. `newestViewDefiner` matches any DDL naming the
 *    view and throws if a later migration carries view DDL naming it without matching. The previous
 *    generation of these guards matched only `CREATE OR ALTER VIEW`; both views here are defined
 *    with `DROP` + `CREATE`, so such a selector would have resolved NOTHING.
 *
 * 2. THE LOAD-BEARING PREDICATES SURVIVE. Curated, because only a person knows which ones carry
 *    meaning. Both views' worst cases are predicates INSIDE a column that keeps its name —
 *    `r.Code = 'PARTNERMGR'` and the `'LOST', 'ABANDONED'` set on `vwDeals`, `CONCAT` and the
 *    blank-email `NULLIF` on `vwSalesContacts` — which is the half a diff does not show.
 *
 * 3. A RE-CREATION MAY ADD COLUMNS BUT NEVER DROP ONE. Cheap and needs no curation. Both sides of the comparison are read
 *    through `producedColumns`, so the columns inherited through `g.*` from the generated
 *    inner view are protected too — an alias-only BEFORE left every one of them free to
 *    disappear the moment a re-creation spelled the star out as an explicit list.
 *
 * There is no business-day assertion here: neither view joins `fnBusinessToday()`, and an assertion
 * about a predicate a view does not have would pass forever without reading anything.
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
    newestViewDefiner,
    producedColumns,
    viewBody,
} from './helpers/view-definer';

const MIGRATIONS = fileURLToPath(new URL('../../../../migrations', import.meta.url));

/**
 * Predicates that must survive every re-creation, per view. Matched against the view's own body
 * with comments stripped, so a copied comment block cannot satisfy one — and V202609190901 carries
 * a 35-line header that names `CONCAT`, `NULLIF` and `vwPeople` in prose, which is precisely the
 * text a stale retype brings forward without the code underneath it.
 */
const REQUIRED: Record<string, RegExp[]> = {
    vwDeals: [
        // The outer view must read the CodeGen base view, never the Deal table: twelve FK display
        // columns come through that star and nothing here regenerates them.
        /FROM\s+\[\$\{flyway:defaultSchema\}\]\.\[vwDealsGenerated\]/i,
        // WINOUTCOME IS A THREE-WAY LABEL BUILT FROM A STATUS CODE SET, and the set is the logic.
        // Lose 'ABANDONED' from the losing side and abandoned deals stop being 0 and become NULL —
        // they leave the labelled population silently, which a win-rate reads as an improvement.
        /\[Code\]\s*=\s*'WON'\s+THEN\s+1/i,
        /\[Code\]\s+IN\s*\(\s*'LOST'\s*,\s*'ABANDONED'\s*\)\s+THEN\s+0/i,
        // THE ROLE PREDICATE INSIDE HasPartnerInvolved. `DealRole.Code = 'PARTNERMGR'` is the only
        // thing making the flag mean "a partner manager is on this deal"; without it MAX(...) over
        // the team returns 1 for every deal that has any member at all. The column keeps its name,
        // its type and its plausibility. This is #59's exact shape.
        /r\.Code\s*=\s*'PARTNERMGR'/i,
        // GROUP BY is what keeps each derived table to one row per deal. Without it the joins fan
        // out and every column on the row — inherited ones included — multiplies.
        /GROUP\s+BY\s+DealID/i,
        /GROUP\s+BY\s+tm\.DealID/i,
        // Both aggregates must stay OUTER joins. An INNER join does not change a number, it
        // DELETES deals: every deal with no payment schedule or no team member vanishes from the
        // view, which reads as a smaller pipeline rather than as missing rows.
        /LEFT\s+OUTER\s+JOIN\s*\(\s*SELECT\s+DealID/i,
        /LEFT\s+OUTER\s+JOIN\s*\(\s*SELECT[\s\S]*?tm\.DealID/i,
        // ISNULL is the difference between "none" and "unknown". Dropped, a deal with no team
        // reports NULL rather than 0 and poisons every comparison it reaches.
        /ISNULL\(\s*ps\.HasPaymentSchedule\s*,\s*0\s*\)/i,
        /ISNULL\(\s*team\.TeamMemberCount\s*,\s*0\s*\)/i,
        /ISNULL\(\s*team\.HasPartnerInvolved\s*,\s*0\s*\)/i,
        // The enterprise threshold is a business rule living as a literal. A re-typed digit is the
        // cheapest possible silent change to it.
        /g\.Amount\s*>=\s*100000/,
    ],
    vwSalesContacts: [
        /FROM\s+\[__mj_BizAppsSales\]\.\[vwSalesContactsGenerated\]/i,
        // READS COMMON'S VIEW rather than re-deriving what a person is called. `DisplayName` and
        // `PrimaryEmail` are both COMPUTED in common's view, not stored on Person, so copying
        // either rule into sales would drift the first time common changed it and would put a
        // second app in charge of the answer.
        /\[__mj_BizAppsCommon\]\.\[vwPeople\]/i,
        // JOINED ON IDENTITY. A SalesContact IS a Person and shares its ID; any other join
        // condition is a different question wearing the same column name.
        /INNER\s+JOIN[\s\S]*?ON\s+g\.\[ID\]\s*=\s*p\.\[ID\]/i,
        // CONCAT, NOT `+`. `NULL + ' (' + email + ')'` is NULL in T-SQL, so a contact with no
        // display name would get a BLANK name field — reintroducing the GUID-picker defect this
        // view exists to fix, in the one case nobody seeds data for.
        /CONCAT\(/i,
        // A blank or whitespace email must read as NO email, so the name comes back bare instead
        // of with a trailing empty bracket.
        /NULLIF\(\s*LTRIM\(\s*RTRIM\(\s*p\.\[PrimaryEmail\]\s*\)\s*\)\s*,\s*''\s*\)/,
    ],
};

/**
 * Fragments that must NEVER appear, per view. `cm_email` is common's contact-method fallback: its
 * presence here means someone re-derived `PrimaryEmail` in sales instead of reading it, which
 * cannot fail loudly — it just starts disagreeing with common the next time common changes.
 */
const FORBIDDEN: Record<string, RegExp[]> = {
    vwSalesContacts: [/cm_email/i],
};

describe('layered views: the newest definer is resolvable and loses nothing', () => {
    for (const view of Object.keys(REQUIRED)) {
        describe(view, () => {
            it('resolves a newest definer, and nothing later redefines it unseen', () => {
                const definer = newestViewDefiner(MIGRATIONS, view);
                expect(definer.file).toBeTruthy();
                expect(definer.chain.length).toBeGreaterThan(0);
            });

            it('keeps every predicate that must survive a re-creation', () => {
                const { code, file } = newestViewDefiner(MIGRATIONS, view);
                const body = viewBody(code, view);
                expect(body, `${file} has no CREATE VIEW body for ${view}`).toBeTruthy();
                for (const required of REQUIRED[view]) {
                    expect(body, `${file} lost ${required}`).toMatch(required);
                }
            });

            it('never reintroduces a fragment known to fail silently', () => {
                const { code, file } = newestViewDefiner(MIGRATIONS, view);
                const body = viewBody(code, view);
                for (const forbidden of FORBIDDEN[view] ?? []) {
                    expect(body, `${file} reintroduced ${forbidden}`).not.toMatch(forbidden);
                }
            });

            it('drops no column a previous definer produced', () => {
                const { chain } = newestViewDefiner(MIGRATIONS, view);
                if (chain.length < 2) return;
                const previous = chain[chain.length - 2];
                // BOTH SIDES ARE READ THE SAME WAY: own columns plus the ones inherited through
                // `g.*`, each measured as of the migration it belongs to. Comparing an alias-only
                // BEFORE against an inheritance-aware NOW left every inherited column unprotected —
                // a re-creation that replaced `g.*` with an explicit list minus one column passed.
                const before = producedColumns(MIGRATIONS, view, previous);
                expect(before, `${previous} produced no readable columns — this check is vacuous`).not.toEqual([]);
                const now = producedColumns(MIGRATIONS, view);
                const lost = before.filter((column) => !now.includes(column));
                expect(lost, `columns ${previous} produced and the newest definer does not`).toEqual([]);
            });
        });
    }
});
