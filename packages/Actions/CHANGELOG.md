# @mj-biz-apps/sales-actions

## 5.1.0

### Minor Changes

- 9f9fa15: MemberJunction v6 and pnpm.

  Every `@memberjunction/*` dependency moves to **6.1.0-edge.2** and the repo moves from npm to
  **pnpm 10.33.0** (`packageManager`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`; `package-lock.json` deleted,
  npm's `overrides` moved to `pnpm.overrides`). `@mj-biz-apps/common-*` goes to `^5.33.2` — the 5.x version
  number is misleading, that build's published peers already require MJ `^6.1.0-edge.0`. `mj-app.json`'s
  `mjVersionRange` is now `>=6.0.0 <7.0.0`, and CI runs under pnpm.

  **`apps/` is retired.** Sales no longer ships its own MJAPI and MJExplorer, because an Open App runs
  _inside_ an MJ host — and because those shells were named `mj_api`/`mj_explorer`, colliding with the host's
  own in a linked workspace. Consumers who ran `pnpm run start:api` / `start:explorer` must now start the
  host's servers instead; see `docs/QA-GUIDE.md`.

  **Three v6 behaviour fixes**, all one root cause: v6 hands back `Date` objects where v5 handed back ISO
  strings. `.slice()` on a date threw and took the dashboard down; `toDateInput` returned a `Date` an
  `<input type="date">` renders blank; and the roster's `date` pipe formatted UTC-midnight values in local
  time, showing the wrong day. Date handling now accepts either shape with UTC getters throughout, and the
  row types say `string | Date | null` because that is what actually arrives.

- 55088ad: S0 bootstrap + S1 baseline schema — 19 tables, CRUD-verified end to end

  First code in this repo: it goes from a README-only spec to a working CRUD-level Sales app on MJ
  Explorer. Schema and CodeGen only — no business logic.

  **S0.** `mj-app.json` (schema `__mj_BizAppsSales`, entity prefix `MJ_BizApps_Sales:`, ports 4141/4341),
  `mj.config.cjs`, `codegen-schema-info.json`, and the house 6-package layout plus `apps/MJAPI` +
  `apps/MJExplorer`. `.mj-links.json` is deliberately empty — `bizapps-common` is published, and the
  unpublished siblings are not needed until the S2 pricing bridge.

  **S1.** 19 tables, type tables first: nine vocabulary type tables carrying the behaviour flags the engine
  branches on; `SalesAccount`/`SalesContact` as IsA extensions of common's `Organization`/`Person` (shared
  UUID, the primary key _is_ the foreign key); `Pipeline`/`PipelineStage`; `Deal`/`DealLine`/
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
  status or stage _name_.

  Verified at three layers — generated stored procedures (including both `DealTeamMember` D-6 arms and
  CHECK constraints refusing bad rows), GraphQL create/read/update/delete, and the real Explorer UI via a
  Playwright harness that creates a Pipeline and a Deal through generated forms, reads them back with
  foreign keys resolved to display names, updates, and deletes both.

### Patch Changes

- Updated dependencies [07dc10e]
- Updated dependencies [0691454]
- Updated dependencies [1da61e1]
- Updated dependencies [57d29f0]
- Updated dependencies [b309a07]
- Updated dependencies [be23e16]
- Updated dependencies [b054bb3]
- Updated dependencies
- Updated dependencies [7f84812]
- Updated dependencies [9f9fa15]
- Updated dependencies [36ef1a4]
- Updated dependencies [9cbd3e1]
- Updated dependencies [38bc458]
- Updated dependencies [03a5fcc]
- Updated dependencies [7f92b70]
- Updated dependencies [55088ad]
- Updated dependencies [838188f]
- Updated dependencies [070bfb8]
- Updated dependencies [7744ea8]
- Updated dependencies [f5c95d9]
- Updated dependencies [b85293a]
- Updated dependencies [0ffb950]
  - @mj-biz-apps/sales-core-entities-server@5.1.0
