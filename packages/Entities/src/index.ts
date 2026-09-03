export * from './generated/entity_subclasses';

/**
 * The typed, CLIENT-SAFE contract for every `Sales.*` remote operation, plus the input/output shapes.
 * Exported from here deliberately: the browser must be able to import an operation and call it without
 * pulling the server engine in behind it.
 */
export * from './generated/remote_operations';

/**
 * The shared `Deal` / `DealLine` / `DealPaymentSchedule` subclasses — the rules a form can check
 * without a database, on the entity itself so they run in the browser AND on the server.
 *
 * These replaced `DealDraft` and `Sales.SaveDeal`. A deal now carries `Lines`, `PaymentSchedule` and
 * `Team` as Related Record Collections, so the object graph is the same on both tiers and persists
 * atomically over `MJ.SaveEntityGraph` — which is precisely what the draft and the operation existed
 * to work around. Read `deal-entity.ts`'s header, and
 * `metadata/entity-relationships/README.md` for the collection shapes.
 */
export * from './deal-entity';

/**
 * The typed seams the close flow calls downstream, plus the stub that stands in while neither sibling
 * is reachable. Read the file header before wiring anything: the blockers are recorded there, and the
 * `IsLive` flag is what tells a caller whether a routing result means "created" or only "planned".
 */
export * from './downstream-seams';

/**
 * The rule deciding which of orders' products a deal line may reference — company, sellable status and
 * availability window. Framework-free so the UI, the integration suite and (later) the close-won handoff
 * all apply the same one.
 */
export * from './product-filter';
export * from './term-start';

/**
 * The close lock's field rule, shared by `DealEntityServer.Save()` and the Explorer Deal form so the
 * form cannot offer a field the server will refuse. Pinned by integration check CD14.
 */
export * from './close-lock';

/**
 * Forces the generated entity subclasses to be loaded. Without an explicit
 * import + call, tree-shaking drops the generated entities because they are not
 * directly referenced. Import and call this from the app bootstrap so the
 * @RegisterClass decorators fire and MJ's class factory can resolve them.
 */
export function LoadGeneratedEntities(): void {
}
export * from './discount-conversion.js';

/** Activity vocabulary — shared, because the deal-activity pane needs the codes too. */
export * from './activities/activity-vocabulary.js';
