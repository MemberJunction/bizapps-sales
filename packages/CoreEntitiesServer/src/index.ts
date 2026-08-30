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
 * WHAT WAS "STILL TO COME" HERE AND IS NOT ANY MORE. All three items this list carried have been
 * settled, two by shipping and one by deletion, and the list had gone on describing them as pending:
 *   - The CLOSE LOCK (L-17, master plan §7.3) is IN `DealEntityServer` — `checkCloseLock()`, and it
 *     covers the child COLLECTIONS as well as the header (`docs/DECISIONS.md` D-CF6), which the original
 *     lock could not have done because the collections did not exist when it was written. `close-deal`'s
 *     CD-series pins it, and `Sales.ReopenDeal` is the only sanctioned exit — now with five refusals,
 *     the fifth being a booked order (DN-20, CD24).
 *   - `DealStageEvent` APPENDS on transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition`, through the single writer `appendStageEvent`. It does land inside the
 *     graph's transaction, which is what the note on `Save()` is about.
 *   - `DealLineEntityServer` WILL NEVER EXIST. `DealLine` was retired with its table — see
 *     `deal-entity.ts:405` — so there are no `Resolved*` columns on a deal line to accept from a
 *     `PreviewOrder` response, and nothing is missing at the entity level. Sales still never computes
 *     money; the rule simply lives on the order rather than on a deal line.
 *
 * Kept as a record rather than deleted, because a "still to come" list that quietly loses an entry reads
 * the same as one that never had it, and two of these were load-bearing rules. The drift gate does not
 * scan this file, which is how the list stayed wrong through the work that settled it.
 */
export * from './DealEntityServer.js';
export * from './CloseDealOperation.js';

/**
 * The REAL orders handoff. Selected automatically when orders' entities are registered; see
 * `resolveSeam` in CloseDealOperation. Exported so a test can install it deliberately.
 */
export * from './orders-availability.js';

/** The REAL contracts handoff — selected automatically when contracts' entities are registered. */
export * from './LiveContractsSeam.js';

/**
 * The finance tasks a won deal raises (S-US2 #34, S-US3 #35).
 *
 * WIRED INTO THE CLOSE as of the closewon-tasks merge -- the comment here said "not called from the
 * close yet, exported so the wiring, when it lands, is an import rather than a move". It landed.
 * `CloseDealOperation` calls this, and its non-fatal warnings share the close's `Issues` array with the
 * order-status writer, tasks first (see the ordering note there).
 */
export * from './CloseWonTaskService.js';

/**
 * ACTIVITIES AND THE OUTLOOK INGEST (S-US9 #119, S-US10 #120).
 *
 * Exported as a block because they are one feature: the writer is what the workspace pane and the
 * ingest both call, and `IActivitySource` is the seam that makes the ingest testable without a mailbox.
 * The Graph source is exported too, deliberately -- it is complete, and hiding it would make it look
 * unwritten rather than ungated.
 */
/**
 * THE VOCABULARY MOVED TO `sales-entities`, and is re-exported here so no consumer changed.
 *
 * It had to move for the deal-activity pane to reach it: an Angular package must not import a SERVER
 * package, and the pane needs the `ActivityTypeCode` values for its own type list. The module is pure
 * union types and string constants -- no provider, no entity, nothing server-only -- so `Entities` is
 * where it always belonged.
 *
 * Re-exported rather than repointed at every call site because `sales-core-entities-server` is the
 * public surface the checks and the operations import from, and moving a file should not be a breaking
 * change for them.
 */
export * from '@mj-biz-apps/sales-entities';
export * from './activities/ActivityWriterService.js';
export * from './activities/ActivityReader.js';
export * from './activities/ActivitySource.js';
export * from './activities/FixtureActivitySource.js';
export * from './activities/GraphMessageMapper.js';
export * from './activities/ImportedGraphActivitySource.js';
export * from './activities/MSGraphActivitySource.js';
export * from './activities/MSGraphCalendarSource.js';
export * from './activities/RelevanceFilter.js';
export * from './activities/DealMatcher.js';
export * from './activities/DealLinkerExtension.js';
export * from './activities/ActivityIngestService.js';
export * from './activities/ActivitySyncJob.js';

/**
 * FORECAST SNAPSHOTS (#40). The same three parts as the activity sync -- a seam, a factory whose default
 * reads nothing, and an entry point a scheduled Action calls -- because sales has no other precedent for
 * a scheduled job and a second one matching the first is worth more than any variation.
 */
export * from './forecast/ForecastSource.js';
export * from './forecast/FixtureForecastSource.js';
export * from './forecast/QueryForecastSource.js';
export * from './forecast/ForecastSnapshotJob.js';

import { DealEntityServer } from './DealEntityServer.js';
import { CloseDealOperation, ReopenDealOperation } from './CloseDealOperation.js';
import { DealLinkerExtension } from './activities/DealLinkerExtension.js';

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
    const anchors: unknown[] = [DealEntityServer, CloseDealOperation, ReopenDealOperation, DealLinkerExtension];
    if (anchors.length === 0) {
        throw new Error('LoadSalesCoreEntitiesServer: registration anchors were tree-shaken away.');
    }
}
