---
"@mj-biz-apps/sales-entities": minor
---

PostgreSQL counterparts for the 16 migrations from v0.1.x to v6.13.x that had none (the schema and baseline tables with `spAssignNextDealNumber` as a PL/pgSQL function, the deal stage-event provenance column, the v5.2/v6.1/v6.9/v6.10/v6.13 metadata syncs, the Sales.SyncActivities retirement, the layered Sales Contacts and Deals views, the predictive win fields, `Pipeline.IncludeInForecast` and `SalesContact` seniority), and a PostgreSQL counterpart of the teardown in `migrations-teardown-pg/`. A PostgreSQL host can now install this app from its migrations.
