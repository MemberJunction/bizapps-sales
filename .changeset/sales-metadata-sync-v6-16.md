---
'@mj-biz-apps/sales-entities': minor
---

The 6.16 Metadata_Sync ships what metadata/ changed since 6.15: the Relink Won Deal Orders To Contracts action and its daily job (Active), the Copy Default Pipeline To Companies action, the Lost stage on the default pipeline, default list columns on Deal Payment Schedules, Deal Stage Events and Deal Team Members, the Deal close-stamp descriptions, and the Close Deal and Reopen Deal output contracts. `mj app remove` retires the two actions and the job. The SalesAccount default-contacts migration and this seed have Postgres counterparts.
