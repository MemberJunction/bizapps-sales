/**
 * @mj-biz-apps/sales-integration-tests — BizApps Sales' integration-check content.
 *
 * PRIVATE, never published. Importing this module registers every check bundle on the shared
 * `IntegrationCheckRegistry` (from `@memberjunction/testing-integration`) as an import side effect —
 * that is the package's entire runtime job. The MJ testing CLI loads it via `mj.config.cjs`:
 *
 *     testing: { checkModules: ['@mj-biz-apps/sales-integration-tests'] }
 *
 * BUNDLES
 *   save-deal   SD1–SD12   Sales.SaveDeal: three tables in one transaction, numbering, and the
 *                          no-pricing guarantee, against a live database with nothing mocked
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check is `RequiresMutation` — this suite exists to
 * write to the database. Without that variable the suite runs ZERO checks and PASSES, which is the
 * vacuous pass this repo's definition of done calls out. Treat "0 checks" as a failure wearing a pass.
 *
 * They are safe to run repeatedly because each one rolls its transaction back; see `fixture.ts`.
 *
 * PRECONDITION: the seeds must have been run (`scripts/seed-dev-data.sh`, `scripts/seed-demo-data.sh`).
 * This suite DISCOVERS its fixture from the seeded rows rather than creating one, so a check failure is
 * about the operation under test rather than about fixture construction. A missing fixture fails with an
 * instruction, not a null reference twelve frames deep.
 *
 * ── STILL SPECIFIED, NOT YET BUILT ──────────────────────────────────────────────────────────────
 *
 * The two checks the definition of done named at S1 are still absent, and both need code that does not
 * exist yet — they are listed here rather than stubbed, so the gap stays visible:
 *   1. `Deal.Amount` for a lined deal equals the `Orders.PreviewOrder` result for the same draft (§6).
 *      Needs the pricing bridge — S2, blocked on orders' C0 seam.
 *   2. A closed deal is immutable at the ENTITY-SERVER level, proven by a direct `BaseEntity.Save()`
 *      that is refused (§7.3, L-17). Needs the close lock — S4. Asserting it through the UI would prove
 *      nothing; the point of the lock is that an Action or an agent hits the same wall.
 */

// ─── Register the code under test ──────────────────────────────────────────────────────────────
//
// `mj test` loads ONLY the modules named in `testing.checkModules` — it has no reason to know about this
// app's server packages. Without these imports the ClassFactory never sees `DealEntityServer` or
// `SaveDealOperation`: every save would run against the plain generated entity and the suite would
// silently measure nothing. Worse than nothing — a check expecting a REFUSAL would still pass, because a
// save with no logic behind it fails too. So the check package owns the registration.
import '@mj-biz-apps/sales-server';
import { LoadBizAppsSalesServer } from '@mj-biz-apps/sales-server';

LoadBizAppsSalesServer();

// ─── The bundles ───────────────────────────────────────────────────────────────────────────────
import './checks/save-deal.checks.js';

export { SaveDealChecks } from './checks/save-deal.checks.js';
export * from './fixture.js';
