/**
 * @mj-biz-apps/sales-integration-tests — BizApps Sales' integration-check content.
 *
 * PRIVATE, never published. Importing this module registers every check bundle on the shared
 * `IntegrationCheckRegistry` (from `@memberjunction/testing-integration`) as an import side effect —
 * that is the package's entire runtime job. The MJ testing CLI loads it via `mj.config.cjs`:
 *
 *     testing: { checkModules: ['@mj-biz-apps/sales-integration-tests'] }
 *
 * BUNDLES. The authoritative count for each is `scripts/expected-check-counts.json`, which the coverage
 * gate and the runner both read; the ranges here are a map, not a second source of truth.
 *   save-deal            Saving a deal, its EMBEDDED ORDER, that order's lines and its own children:
 *                        four tables across two schemas in one transaction, numbering, the
 *                        explicit-removal semantics of the collections, and the no-pricing guarantee
 *   close-deal           Sales.CloseDeal / Sales.ReopenDeal / the close lock: routing follows the POLICY
 *                        rather than any name, and a closed deal refuses a raw save — including one made
 *                        only against its CHILD COLLECTIONS (CD13)
 *   product-picker       The rule deciding which of orders' products a line may reference
 *   close-won-order      What a won close does NOT do to the order: no second order, no status change,
 *                        still editable afterwards (S-US5/S-US6)
 *   close-won-contract   The contract route, on the one stack that has contracts linked
 *
 * ⚠️ EVERY BUNDLE NOW REQUIRES bizapps-orders, including save-deal and close-deal. A deal cannot be
 * saved without it: `DealEntityServer.Save()` provisions the deal's embedded order (S-US4). `mj-app.json`
 * declares orders a hard dependency, so a host without it is misconfigured rather than minimal.
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
 * The definition of done named two checks at S1. The second is now BUILT — `close-deal.CD5` proves a
 * closed deal is immutable at the entity-server level with a direct `BaseEntity.Save()` that is refused
 * (§7.3, L-17). One remains, and it needs code that does not exist yet, so it is listed rather than
 * stubbed to keep the gap visible:
 *   1. `Deal.Amount` for a lined deal equals the `Orders.PreviewOrder` result for the same draft (§6).
 *      Needs the pricing bridge. The shape of that bridge changed with the rework — the lines now live on
 *      an order orders already owns and prices, so `save-deal.SD19` covers the per-line half (sales sends
 *      product and quantity; the price comes back). What is still unasserted is the HEADER roll-up.
 *
 * One check is also deliberately WEAKER than it will eventually be: `close-deal.CD7` asserts that a
 * stubbed downstream reports `Executed: false` with a reason and invents no ID. When orders links, CD7
 * is the check that should start failing — and that failure is the signal to write the real one.
 */

// ─── Register the code under test ──────────────────────────────────────────────────────────────
//
// `mj test` loads ONLY the modules named in `testing.checkModules` — it has no reason to know about this
// app's server packages. Without these imports the ClassFactory never sees `DealEntity` or
// `DealEntityServer`: every save would run against the plain generated entity and the suite would
// silently measure nothing. Worse than nothing — a check expecting a REFUSAL would still pass, because a
// save with no rules behind it fails too. So the check package owns the registration.
import '@mj-biz-apps/sales-server';
import { LoadBizAppsSalesServer } from '@mj-biz-apps/sales-server';

LoadBizAppsSalesServer();

// ─── The bundles ───────────────────────────────────────────────────────────────────────────────
import './checks/save-deal.checks.js';
import './checks/close-deal.checks.js';
import './checks/product-picker.checks.js';
import './checks/close-won-order.checks.js';
import './checks/close-won-contract.checks.js';

export { SaveDealChecks } from './checks/save-deal.checks.js';
export { CloseDealChecks } from './checks/close-deal.checks.js';
export { ProductPickerChecks } from './checks/product-picker.checks.js';
export { CloseWonOrderChecks } from './checks/close-won-order.checks.js';
export { CloseWonContractChecks } from './checks/close-won-contract.checks.js';
export * from './fixture.js';
