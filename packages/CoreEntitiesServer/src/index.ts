/**
 * BizApps Sales — server-only entity subclasses.
 *
 * This package is where the app's rules that NEED A DATABASE get enforced, and they are a `Save()`
 * override rather than a UI concern, so that an Action, an agent or a raw `BaseEntity.Save()` all hit
 * the same wall.
 *
 * WHAT IS HERE NOW:
 *   - `DealEntityServer` — `DealNumber` assignment from a locked counter row inside the save's
 *     transaction, and the `Deal.OwnerEmployeeID` stamp DERIVED from the `DealTeamMember` carrying the
 *     owner role (§5.1) rather than a field anyone sets by hand.
 *
 * WHAT USED TO BE HERE AND IS NOW THE FRAMEWORK'S JOB. `DealEntityServer` used to hand-roll the whole
 * deal tree — transient `Lines` / `PaymentSchedule` arrays, a deletion queue, a re-sequencer and an
 * explicit transaction — and `SaveDealOperation` (`Sales.SaveDeal`) existed solely so a browser could
 * reach it, by rehydrating a `DealDraft` payload into that tree server-side.
 *
 * **Related Record Collections replaced both.** `Deal` declares `Lines`, `PaymentSchedule` and `Team`
 * in metadata; CodeGen puts typed collections on the generated entity; the same graph therefore exists
 * in the browser, travels over `MJ.SaveEntityGraph`, and persists through `EntitySavePlan` inside one
 * transaction. Header-before-children and deletions-before-inserts are the framework's orderings now,
 * which is right — they are inherent to the problem rather than specific to this app. See
 * `metadata/entity-relationships/README.md`.
 *
 * The form-shaped rules live on `DealEntity` in `sales-entities`, which `DealEntityServer` extends, so
 * they run on both tiers.
 *
 * WHAT IS STILL TO COME, and deliberately not stubbed:
 *   - The CLOSE LOCK (L-17, master plan §7.3), in `DealEntityServer` — once a deal enters a status
 *     where `DealStatusType.LocksDeal = 1`, the header (except Description / NextStep), its lines and
 *     its team become immutable, and reopening goes through `Sales.ReopenDeal` with a recorded reason.
 *     The schema is already shaped for it; the enforcement lands with S4.
 *   - `DealStageEvent` appends on stage transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition` — S4. Read the note on `DealEntityServer.Save()` first: it has to land
 *     inside the graph's transaction, and the mechanism for that changed in MJ `47ff71d68b`.
 *   - `DealLineEntityServer` — accepts the four `Resolved*` columns only from an `Orders.PreviewOrder`
 *     response (§6) — S2. Until it exists, nothing enforces that at the entity level.
 */
export * from './DealEntityServer.js';
export * from './CloseDealOperation.js';

/**
 * The REAL orders handoff. Selected automatically when orders' entities are registered; see
 * `resolveSeam` in CloseDealOperation. Exported so a test can install it deliberately.
 */
export * from './LiveOrdersSeam.js';

/** The REAL contracts handoff — selected automatically when contracts' entities are registered. */
export * from './LiveContractsSeam.js';

import { DealEntityServer } from './DealEntityServer.js';
import { CloseDealOperation, ReopenDealOperation } from './CloseDealOperation.js';

/**
 * Anchor for the server-side entity subclasses, called from the sales-server bootstrap.
 *
 * THIS FUNCTION LOOKS POINTLESS AND IS NOT. `@RegisterClass` registration is a side effect of the
 * module being imported, and nothing in this package is referenced directly by name from the server —
 * so a bundler is entirely correct to tree-shake the imports away, at which point `ClassFactory`
 * silently resolves a less-derived `Deal` class instead of `DealEntityServer` and every rule in it
 * quietly stops applying. Touching the symbols here is what keeps the imports alive.
 */
export function LoadSalesCoreEntitiesServer(): void {
    // Reference each registered class so the imports cannot be elided.
    const anchors: unknown[] = [DealEntityServer, CloseDealOperation, ReopenDealOperation];
    if (anchors.length === 0) {
        throw new Error('LoadSalesCoreEntitiesServer: registration anchors were tree-shaken away.');
    }
}
