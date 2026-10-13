---
'@mj-biz-apps/sales-ng': patch
---

The Sales section's first load no longer grows with closed-deal history. The roster now holds open deals plus deals closed in the current fiscal quarter. The board shows exactly that and says so in its header. The forecast stack's Closed segment comes from `Sales: Dashboard Summary`'s new `WonAmount`, and the Won inspect list is filtered on the server with the Won tile's own predicate. `Sales: Deal Roster` gains an optional `ClosedSince` parameter. `DealWorkspaceService.LoadRoster` now takes it and throws when the query fails, instead of returning an empty roster.
