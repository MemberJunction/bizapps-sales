/**
 * BizApps Sales — server-only entity subclasses.
 *
 * DELIBERATELY EMPTY AT S1. This package is where the app's non-negotiable rules get enforced, and
 * every one of them is a `Save()` override rather than a UI concern, so that an Action, an agent or
 * a raw `BaseEntity.Save()` all hit the same wall:
 *
 *   - `DealEntityServer` — the CLOSE LOCK (L-17, master plan §7.3). Once a deal enters a status
 *     where `DealStatusType.LocksDeal = 1`, the header (except Description / NextStep), its lines
 *     and its team members become immutable. The schema is already shaped for this — see the
 *     `LocksDeal` flag on DealStatusType and the append-only DealStageEvent table — but the
 *     enforcement lands with S4.
 *   - `DealEntityServer` also maintains `Deal.OwnerEmployeeID`, the denormalized stamp of whichever
 *     DealTeamMember holds a role with `IsOwnerRole = 1` (§5.1). Never hand-set; the extended
 *     property on the column says so, because someone eventually will.
 *   - `DealLineEntityServer` — refuses local arithmetic. The four `Resolved*` columns are write-only
 *     from a `Orders.PreviewOrder` response (§6); nothing in this app may multiply quantity by price.
 *
 * The package exists now, empty, because the dependency edge is what matters: sales-actions and
 * sales-server both depend on it, and wiring that up front means S4 adds behaviour without moving
 * packages around.
 */

/**
 * Anchor for the server-side entity subclasses, called from the sales-server bootstrap. Empty until
 * S4, but exported now so the bootstrap's shape does not change when the overrides land.
 */
export function LoadSalesCoreEntitiesServer(): void {
}
