---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-actions": minor
"@mj-biz-apps/sales-server": minor
"@mj-biz-apps/sales-ng": minor
---

S0 bootstrap + S1 baseline schema — 19 tables, CRUD-verified end to end

First code in this repo: it goes from a README-only spec to a working CRUD-level Sales app on MJ
Explorer. Schema and CodeGen only — no business logic.

**S0.** `mj-app.json` (schema `__mj_BizAppsSales`, entity prefix `MJ_BizApps_Sales:`, ports 4141/4341),
`mj.config.cjs`, `codegen-schema-info.json`, and the house 6-package layout plus `apps/MJAPI` +
`apps/MJExplorer`. `.mj-links.json` is deliberately empty — `bizapps-common` is published, and the
unpublished siblings are not needed until the S2 pricing bridge.

**S1.** 19 tables, type tables first: nine vocabulary type tables carrying the behaviour flags the engine
branches on; `SalesAccount`/`SalesContact` as IsA extensions of common's `Organization`/`Person` (shared
UUID, the primary key *is* the foreign key); `Pipeline`/`PipelineStage`; `Deal`/`DealLine`/
`DealStageEvent`/`DealContactRole`; `DealTeamMember`; `ForecastSnapshot`. 47 foreign keys and 19 CHECK
constraints — structural invariants only, never domain vocabulary. 51 seeded vocabulary rows ship as
metadata with hardcoded UUIDs rather than SQL `INSERT`s.

`Deal.Amount` carries its three provenance columns (`AmountIsComputed`, `AmountComputedAt`,
`AmountSourceHash`) and `DealLine`'s four `Resolved*` columns are write-only from an
`Orders.PreviewOrder` response, so the "sales never computes money" guarantee is structural from the
first migration rather than retrofitted.

Cross-app references are soft wherever the target app may be absent (DG-6), which is what lets this
baseline stand up with only `bizapps-common` present.

**Enforcement.** `scripts/assert-no-vocabulary-comparisons.mjs` is the CI grep master plan §3 asks for,
added before any server logic exists so it starts green and stays green: no server file may compare a
status or stage *name*.

Verified at three layers — generated stored procedures (including both `DealTeamMember` D-6 arms and
CHECK constraints refusing bad rows), GraphQL create/read/update/delete, and the real Explorer UI via a
Playwright harness that creates a Pipeline and a Deal through generated forms, reads them back with
foreign keys resolved to display names, updates, and deletes both.
