---
'@mj-biz-apps/sales-entities': minor
---

Sales Contacts inherits `SeniorityLevelID` from Common's People (bizapps-common v5.45.x, #148). A new migration adds the column to the Sales Contacts base view, refreshes the `vwSalesContacts` wrapper so its `g.*` column list stays aligned, and ships the inherited EntityField. Without the refresh, the wrapper returned `SeniorityLevelID` values under `OwnerEmployee` once CodeGen rebuilt the inner view. The migration also carries CodeGen's output for Deals and Deal Contact Roles, which no earlier migration shipped. The bizapps-common floor in `mj-app.json` rises to 5.45.0, since the view reads `Person.SeniorityLevelID`.
