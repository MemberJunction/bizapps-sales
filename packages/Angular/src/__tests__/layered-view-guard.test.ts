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
 * ---------------------------------------------------------------------------------------------
 * WHAT A CURATED PREDICATE IS ALLOWED TO BE. Adversarial review found the previous list failing in
 * BOTH directions, which is the worst place a guard can be: it passed semantics-breaking rewrites
 * and failed semantics-preserving ones.
 *
 * So only two kinds of thing are curated here, because only two kinds survive a legitimate rewrite:
 *
 *   - A STRING LITERAL. `'PARTNERMGR'` is the same ten characters however the SQL around it is
 *     formatted, and it cannot be reformatted away. If it is gone, the meaning changed.
 *   - A REFERENCED OBJECT NAME, matched through `references()` — the selector's own name matcher, so
 *     bracketed, bare and `${...}`-qualified spellings are all the same name, because to the
 *     database they are.
 *
 * Everything that was SYNTAX is gone, each entry for a measured reason:
 *
 *   - `LEFT OUTER JOIN \(\s*SELECT[\s\S]*?tm\.DealID` is the worst of the old entries and it failed
 *     BOTH ways. `LEFT JOIN` is the identical operator and failed red; and because the wildcard
 *     bridges anything at all, the pattern went on matching from the FIRST derived table's
 *     `LEFT OUTER JOIN` across to `tm.DealID` in the second — so turning the team join INNER, which
 *     deletes every team-less deal from the view, left all eight tests green. A predicate that
 *     cannot fail when the thing it guards breaks is worse than no predicate.
 *   - `GROUP BY DealID` / `GROUP BY tm.DealID` pinned clause syntax and an alias.
 *   - `ISNULL(ps.HasPaymentSchedule, 0)` and its two siblings pinned a function spelling AND an
 *     alias. `COALESCE` is the same answer here and was a red build.
 *   - `INNER JOIN[\s\S]*?ON g.[ID] = p.[ID]` pinned a join keyword, two aliases, a bracketing
 *     choice, an argument order — and bridged them with a wildcard.
 *   - `CONCAT\(` and the exact `NULLIF(LTRIM(RTRIM(p.[PrimaryEmail])), '')` spelling pinned function
 *     spellings and an alias. Both rules still have a dedicated home in
 *     `sales-contact-name-field.test.ts`, which is where the GUID-picker defect is documented.
 *   - `g.Amount >= 100000` IS DROPPED and nothing replaces it. A THRESHOLD IS NOT A MEANING THE
 *     GUARD CAN DEFEND: the number is a business rule that legitimately changes, this file has no
 *     way to know which value is current, and a guard that fails whenever the business updates its
 *     own tiering is a guard that gets deleted rather than consulted.
 *   - `FROM \[__mj_BizAppsSales\]\.\[vwSalesContactsGenerated\]` pinned one spelling of a name this
 *     repo writes both ways — a literal schema here, the `${flyway:defaultSchema}` placeholder in
 *     `vwDeals` three files away.
 *
 * WHAT THIS DELIBERATELY NO LONGER CATCHES, so nobody is surprised: a rewrite that keeps every
 * literal and every object name but changes a join's CARDINALITY — the INNER-join deletion above
 * included — passes here. That is not an oversight, it is the price of a list that never fails
 * correct work, and the old list did not catch it either. `producedColumns` covers the "a column
 * vanished" half; the row-count half belongs to a test with a database behind it, not to a regex
 * over DDL.
 *
 * Four assertions per view, and they fail for different reasons on purpose.
 *
 * 1. THE NEWEST DEFINER IS THE ONE WE THINK IT IS. `newestViewDefiner` matches any DDL naming the
 *    view and throws if a later migration carries view DDL naming it without matching. The previous
 *    generation of these guards matched only `CREATE OR ALTER VIEW`; both views here are defined
 *    with `DROP` + `CREATE`, so such a selector would have resolved NOTHING.
 *
 * 2. THE LOAD-BEARING LITERALS AND NAMES SURVIVE. Curated, because only a person knows which ones
 *    carry meaning. Both views' worst cases are identities INSIDE a column that keeps its name —
 *    `'PARTNERMGR'` and the `'LOST', 'ABANDONED'` set on `vwDeals`, common's `vwPeople` on
 *    `vwSalesContacts` — which is the half a diff does not show.
 *
 * 3. A FRAGMENT KNOWN TO FAIL SILENTLY NEVER COMES BACK. Nothing is forbidden for `vwDeals`, and
 *    that assertion SKIPS out loud for it rather than passing on an empty list.
 *
 * 4. A RE-CREATION MAY ADD COLUMNS BUT NEVER DROP ONE. Cheap and needs no curation. Both sides of
 *    the comparison are read through `producedColumns`, so the columns inherited through `g.*` from
 *    the generated inner view are protected too — an alias-only BEFORE left every one of them free
 *    to disappear the moment a re-creation spelled the star out as an explicit list.
 *
 * There is no business-day assertion here: neither view joins `fnBusinessToday()`, and an assertion
 * about a predicate a view does not have would pass forever without reading anything.
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
    newestViewDefiner,
    producedColumns,
    references,
    viewBody,
} from './helpers/view-definer';

const MIGRATIONS = fileURLToPath(new URL('../../../../migrations', import.meta.url));

/**
 * Literals and object names that must survive every re-creation, per view. Matched against the
 * view's own body with comments stripped, so a copied comment block cannot satisfy one — and
 * V202609190901 carries a 35-line header that names `CONCAT`, `NULLIF` and `vwPeople` in prose,
 * which is precisely the text a stale retype brings forward without the code underneath it.
 *
 * String literals are matched CASE-SENSITIVELY: a `DealStatusType.Code` of `'won'` is not `'WON'`
 * under a case-sensitive collation, so a guard that accepted either would be lying about which.
 */
const REQUIRED: Record<string, RegExp[]> = {
    vwDeals: [
        // The outer view must read the CodeGen base view, never the Deal table: twelve FK display
        // columns come through that star and nothing here regenerates them.
        references('vwDealsGenerated'),
        // WinOutcome reads a STATUS CODE, and this is the table those codes live in. Read anything
        // else and the label keeps its name and its three-way shape while classifying by something
        // other than the deal's status.
        references('DealStatusType'),
        // WINOUTCOME IS A THREE-WAY LABEL BUILT FROM A STATUS CODE SET, and the set is the logic.
        // Lose 'ABANDONED' from the losing side and abandoned deals stop being 0 and become NULL —
        // they leave the labelled population silently, which a win-rate reads as an improvement.
        /'WON'/,
        /'LOST'/,
        /'ABANDONED'/,
        // HasPaymentSchedule is an existence test over THIS table; against any other the flag keeps
        // its name and its 0/1 shape while answering a different question.
        references('DealPaymentSchedule'),
        // TeamMemberCount and HasPartnerInvolved are both aggregates over the TEAM.
        references('DealTeamMember'),
        // And the role code that makes HasPartnerInvolved mean "a partner manager is on this deal"
        // is looked up here. Without the role table and its code, MAX(...) over the team returns 1
        // for every deal with any member at all — the column keeps its name, its type and its
        // plausibility. This is #59's exact shape.
        references('DealRole'),
        /'PARTNERMGR'/,
    ],
    vwSalesContacts: [
        references('vwSalesContactsGenerated'),
        // READS COMMON'S VIEW rather than re-deriving what a person is called. `DisplayName` and
        // `PrimaryEmail` are both COMPUTED in common's view, not stored on Person, so copying
        // either rule into sales would drift the first time common changed it and would put a
        // second app in charge of the answer.
        references('vwPeople'),
    ],
};

/**
 * Fragments that must NEVER appear, per view. `cm_email` is common's contact-method fallback: its
 * presence here means someone re-derived `PrimaryEmail` in sales instead of reading it, which
 * cannot fail loudly — it just starts disagreeing with common the next time common changes. It
 * stays as a NEGATIVE because a negative on a name from another repo cannot fail a legitimate
 * rewrite of this one: there is no reason for that identifier to appear in sales at all.
 *
 * Nothing qualifies for `vwDeals`: it has no known-bad spelling it has ever regressed to. The entry
 * is ABSENT rather than empty, and the assertion below skips rather than passing — an empty list
 * would have been a green tick over zero assertions.
 */
const FORBIDDEN: Record<string, RegExp[]> = {
    vwSalesContacts: [/cm_email/i],
};

describe('layered views: the newest definer is resolvable and loses nothing', () => {
    /**
     * A forbidden entry that names a view nobody guards, or that is present but empty, asserts
     * nothing while looking like it does. Both are caught here rather than by a silently empty loop.
     */
    it('curates no forbidden list for a view this file does not guard', () => {
        for (const [view, forbidden] of Object.entries(FORBIDDEN)) {
            expect(REQUIRED[view], `FORBIDDEN names ${view}, which is not a guarded view`).toBeDefined();
            expect(forbidden, `FORBIDDEN[${view}] is empty — remove it or fill it in`).not.toEqual([]);
        }
    });

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

            it('never reintroduces a fragment known to fail silently', (context) => {
                const forbidden = FORBIDDEN[view];
                // NOT `?? []`. A view with no forbidden entry used to run this test with an empty
                // loop and report a PASS — a green tick standing for zero assertions, which on a
                // results page is indistinguishable from a check that actually ran. `vwDeals` is
                // exactly that view, and this is exactly that green tick.
                if (forbidden === undefined) {
                    context.skip(`nothing is forbidden for ${view}, so this asserts nothing`);
                    return;
                }
                const { code, file } = newestViewDefiner(MIGRATIONS, view);
                const body = viewBody(code, view);
                expect(body, `${file} has no CREATE VIEW body for ${view}`).toBeTruthy();
                for (const pattern of forbidden) {
                    expect(body, `${file} reintroduced ${pattern}`).not.toMatch(pattern);
                }
            });

            it('drops no column a previous definer produced', (context) => {
                const { chain } = newestViewDefiner(MIGRATIONS, view);
                // A view with a single definer has no BEFORE to compare a re-creation against. This
                // used to `return` quietly and report a pass, so the day someone consolidated the
                // history into one migration the column guard would have switched itself off with
                // nothing in the output to say so.
                if (chain.length < 2) {
                    context.skip(`${view} has one definer (${chain[0]}) — there is no BEFORE to compare`);
                    return;
                }
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
