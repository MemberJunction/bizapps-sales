/**
 * BizApps Sales action subclasses.
 *
 * Currently the CodeGen-maintained generated set only. The hand-authored actions
 * this app will grow live alongside it in src/custom/ — the deal-desk hygiene
 * sweep, the stalled-deal nudge, the forecast-review roll-up (master plan §11,
 * phase 3).
 */
export * from './generated/action_subclasses';

/**
 * Forces the generated action subclasses to be loaded. Same tree-shaking hazard
 * as the entities: an action row exists in metadata and `ActionEngine` finds
 * nothing registered under its DriverClass unless the decorator has actually run.
 */
export function LoadGeneratedActions(): void {
}
