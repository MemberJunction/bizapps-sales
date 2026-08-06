/**
 * BizApps Sales — server-only entity subclasses and remote operations.
 *
 * This package is where the app's non-negotiable rules get enforced, and most of them are a `Save()`
 * override rather than a UI concern, so that an Action, an agent or a raw `BaseEntity.Save()` all hit
 * the same wall.
 *
 * WHAT IS HERE NOW (Phase 1):
 *   - `DealEntityServer` — the header + LINES + PAYMENT SCHEDULE collections, written in ONE
 *     transaction. This is what makes "save this deal" atomic instead of a sequence of round trips
 *     that can leave a numbered deal with nothing under it. It also owns `SetOwner`, which maintains
 *     `Deal.OwnerEmployeeID` as a stamp DERIVED from the `DealTeamMember` row rather than a field
 *     anyone sets by hand (§5.1).
 *   - `SaveDealOperation` — `Sales.SaveDeal`. Rehydrates a client `DealDraft` into that entity tree.
 *     Without it a browser cannot save a deal and its children atomically at all: the client holds the
 *     GENERATED `mjBizAppsSalesDealEntity`, not the server subclass, so the transient child
 *     collections have no way to cross the entity-save boundary as scalar fields.
 *
 * WHAT IS STILL TO COME, and deliberately not stubbed:
 *   - The CLOSE LOCK (L-17, master plan §7.3), in `DealEntityServer` — once a deal enters a status
 *     where `DealStatusType.LocksDeal = 1`, the header (except Description / NextStep), its lines and
 *     its team become immutable, and reopening goes through `Sales.ReopenDeal` with a recorded reason.
 *     The schema is already shaped for it; the enforcement lands with S4.
 *   - `DealStageEvent` appends on stage transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition` — S4.
 *   - `DealLineEntityServer` — refuses local arithmetic and accepts the four `Resolved*` columns only
 *     from an `Orders.PreviewOrder` response (§6) — S2.
 *   - `DealNumber` sequence assignment, mirroring accounting's `getNextJournalEntryNumber`.
 */
export * from './DealEntityServer.js';
export * from './SaveDealOperation.js';

import { DealEntityServer } from './DealEntityServer.js';
import { SaveDealOperation } from './SaveDealOperation.js';

/**
 * Anchor for the server-side entity subclasses and remote operations, called from the sales-server
 * bootstrap.
 *
 * THIS FUNCTION LOOKS POINTLESS AND IS NOT. `@RegisterClass` registration is a side effect of the
 * module being imported, and nothing in this package is referenced directly by name from the server —
 * so a bundler is entirely correct to tree-shake the imports away, at which point `ClassFactory`
 * silently resolves the GENERATED `Deal` entity instead of `DealEntityServer` and every rule in it
 * quietly stops applying. Touching the symbols here is what keeps the imports alive.
 */
export function LoadSalesCoreEntitiesServer(): void {
    // Reference each registered class so the imports cannot be elided.
    const anchors: unknown[] = [DealEntityServer, SaveDealOperation];
    if (anchors.length === 0) {
        throw new Error('LoadSalesCoreEntitiesServer: registration anchors were tree-shaken away.');
    }
}
