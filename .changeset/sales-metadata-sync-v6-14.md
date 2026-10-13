---
'@mj-biz-apps/sales-entities': minor
---

The 6.14 Metadata_Sync ships what metadata/ changed since 6.13: the `sales` and `sales:write` API scopes with MJAPI's ceiling for `sales:write`, and the new SQL of Sales: Dashboard Summary (with its WonAmount field), Sales: Deal Roster (with its ClosedSince parameter) and Sales: Forecast History. It has a Postgres counterpart, and `mj app remove` retires the two scopes. The seed is idempotent and safe on a host that already ran `mj sync push`.
