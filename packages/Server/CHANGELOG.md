# @mj-biz-apps/sales-server

## 6.7.0

### Patch Changes

- Updated dependencies [77278d7]
  - @mj-biz-apps/sales-entities@6.7.0
  - @mj-biz-apps/sales-core-entities-server@6.7.0
  - @mj-biz-apps/sales-actions@6.7.0

## 6.6.0

### Minor Changes

- ad9191c: Regenerated code: `vwDeals` and `vwDealContactRoles` now carry the contact name columns.

  Giving `Sales Contacts` a name field (`DisplayNameAndEmail`) means every view with a foreign key to it gains a name column — `PrimaryContact` and `BillingContact` on Deals, `SalesContact` on Deal Contact Roles. This is the CodeGen output that registers them, so metadata and the views agree.

  **CodeGen lags by exactly one pass when a new FK-name column appears, and the second pass repairs it.** Measured:

  |        | Deals                      | Deal Contact Roles | Result                        |
  | ------ | -------------------------- | ------------------ | ----------------------------- |
  | Pass 1 | 59 fields / **61** columns | 10 / **11**        | `success: false`              |
  | Pass 2 | **61 / 61**                | **11 / 11**        | `success: true`, 0 mismatches |

  `createNewEntityFieldsFromSchema` builds `EntityField` rows by reading the base view's columns, so on the pass that CREATES those columns they are not yet visible to it. The next pass sees them, registers them and fixes the sequences.

  **This contradicts the warning in `CLAUDE.md`**, which says a full second pass corrupts the database. In this case the second pass is what repaired it; the first pass left the corruption. The documented incident is the same lag seen from the other side — whichever pass introduces a new virtual column leaves metadata one behind. The safe rule is _run until it reports success and field/column parity is clean_, verified per entity, not _never run twice_.

  **Why the intermediate state is dangerous, stated precisely.** The `Deal` TABLE never changes. `spCreateDeal` ends in `SELECT * FROM vwDeals`, and the client-side provider declares a `@ResultTable` with one column per `EntityField`, filled by a POSITIONAL `INSERT ... EXEC`. A 61-column result into a 59-column table fails with _"Column name or number of supplied values does not match table definition"_ — so it is the save-capture width that breaks, not anything about the table.

  CodeGen also moved the generated entities to a per-schema layout: `entity_subclasses.ts` is now a barrel re-exporting `entities/__mj_BizAppsSales.ts`, with the GraphQL schema split the same way.

  Also converts the one dynamic `await import()` in the test suite to a static import. That test failed twice in full runs and could not be reproduced in twelve attempts afterwards; the cause was never identified, so this is not a fix presented as one — it removes the single construct that made the test different from its neighbours.

### Patch Changes

- b15ec15: Sales answers Orders' question about order lines, so a closed deal's lines are actually frozen.

  `orders-entities` asks whether an order line may be edited — `RegisterOrderLineEditVeto` — and refuses
  nothing until something registers. Nothing ever has. The seam shipped inert on purpose, because Sales
  resolves `orders-entities` from npm and could not call a function that had not been published yet.
  This is the app with the stake answering, and it is what closes golive#206 item 1.

  **By flag, never by name.** The lock is `DealStatusType.LocksDeal`, the same flag the board, the deal
  form and `DealEntityServer` already read. Won, Lost and Abandoned all lock, a deployment may add
  another, and a rule matching status names would quietly stop covering it. `vwDeals` exposes
  `DealStatusType` as a string and it is deliberately unused.

  **The refusal names the gesture**, because the seam passes create/update/delete: _"before adding a
  product"_, _"before removing a product"_, _"before changing what was sold"_. Each opens with the
  sentence golive#207 settled and the deal form and workspace already use, so a rep meets one voice
  across three screens rather than three descriptions of one rule.

  **A lookup that cannot answer is not an approval.** A failed read throws, and
  `ResolveOrderLineEditRefusal` turns that into a refusal naming the fault. Returning null would let a
  frozen line change because the thing guarding it was briefly unreachable — the same trade
  `DealEntityServer.readStatusLockFlags` already makes for the close lock.

  **Nothing is cached, and the cost is two reads per line.** Orders asks once per line, so a fifty-line
  order graph save costs a hundred round trips. A memo of the verdict would be wrong: the registry holds
  one instance for the life of the process, so it outlives the truth — a deal reopened a moment ago
  would keep refusing, and a deal just closed would keep allowing. An earlier draft memoed only the
  order-to-deal mapping, which cannot go stale that way; it also saved nothing, because the deal row
  still has to be re-read for its current status. **The test asserting the cost is what caught that.**
  If the cost ever bites, the fix belongs in the seam — asking once per save — not in a cache here that
  has to be right about when a deal changed.

  **Where the registration lives matters.** It is called from `sales-core-entities-server`, which
  DECLARES `@mj-biz-apps/orders-entities`. `sales-server` does not, and resolves that name transitively
  to whatever is published — measured locally, it resolves to the npm build while the declaring package
  resolves to the workspace. Putting the import in the package that owns the dependency is what lets
  the version requirement be stated at all.

  **And it is now stated exactly.** orders#206 merged and published `orders-entities@5.13.0`, which
  carries the seam; every `@mj-biz-apps/orders-entities` declaration in this repo -- the four packages
  and the root -- is pinned at **`5.13.0`**, and the lockfile resolves a single copy.

  **Exact, not a caret, and that is the load-bearing part.** The registry is a module-scoped
  `let hostVeto` in `orders-entities`, so it is per-COPY rather than per-process: if Sales ever
  resolved a different version than the `orders-core-entities-server` that reads it, the registration
  would land in one copy and the lookup in the other, and the veto would refuse nothing while every
  test here still passed. Every orders package pins `5.13.0` exactly; matching that is what keeps it
  to one copy. A caret would compile and then silently do nothing, which is strictly worse than the
  honest build failure this replaced. It was two copies for a moment during this change -- the four
  package declarations moved first and the ROOT one was still `^5.2.1`, which the lockfile duly
  resolved alongside 5.13.0 -- so this is measured rather than theoretical.

  13 tests, 7 mutations all killed: the flag never locking (the defect), every status locking, an
  order with no deal falling through, each of the two failed reads allowing instead of refusing, a
  hostile id reaching the filter, and the create gesture getting the wrong words.

  Driven end to end against a real database as well: a real deal and the order it owns, open then
  closed, with the registered vetoer — the grid path refused, the order-graph path refused, a delete
  refused, Orders' own writes still allowed, and a `ContextUser` on every call.

- Updated dependencies [40d8f7d]
- Updated dependencies [f1ecd20]
- Updated dependencies [ad9191c]
- Updated dependencies [91ba029]
- Updated dependencies [926ac7a]
- Updated dependencies [2f1a3ea]
- Updated dependencies [c3b23cc]
- Updated dependencies [b15ec15]
  - @mj-biz-apps/sales-entities@6.6.0
  - @mj-biz-apps/sales-core-entities-server@6.6.0
  - @mj-biz-apps/sales-actions@6.6.0

## 6.5.0

### Patch Changes

- Updated dependencies [079111d]
- Updated dependencies [9404cfc]
- Updated dependencies [dd4a8d4]
- Updated dependencies [aaf9189]
- Updated dependencies [83ca517]
- Updated dependencies [8f82990]
- Updated dependencies [fe8d94a]
  - @mj-biz-apps/sales-core-entities-server@6.5.0
  - @mj-biz-apps/sales-entities@6.5.0
  - @mj-biz-apps/sales-actions@6.5.0

## 6.4.0

### Patch Changes

- Updated dependencies [8e041da]
  - @mj-biz-apps/sales-core-entities-server@6.4.0
  - @mj-biz-apps/sales-actions@6.4.0
  - @mj-biz-apps/sales-entities@6.4.0

## 6.3.3

### Patch Changes

- @mj-biz-apps/sales-actions@6.3.3
- @mj-biz-apps/sales-core-entities-server@6.3.3
- @mj-biz-apps/sales-entities@6.3.3

## 6.3.2

### Patch Changes

- @mj-biz-apps/sales-actions@6.3.2
- @mj-biz-apps/sales-core-entities-server@6.3.2
- @mj-biz-apps/sales-entities@6.3.2

## 6.3.1

### Patch Changes

- d40fd69: License declarations now agree on BUSL-1.1 everywhere.

  The Open App manifest (`mj-app.json`) declared `"license": "ISC"` and the README badge
  advertised ISC, while `LICENSE` and every `package.json` declared BUSL-1.1. The manifest is
  what an MJ deployment reads on install and the badge is the first thing a reader sees, so
  between them they were the repo's loudest license statement — and the wrong one. The badge
  now links to `LICENSE`.

- Updated dependencies [d40fd69]
  - @mj-biz-apps/sales-actions@6.3.1
  - @mj-biz-apps/sales-core-entities-server@6.3.1
  - @mj-biz-apps/sales-entities@6.3.1

## 6.3.0

### Patch Changes

- Updated dependencies [11b3613]
  - @mj-biz-apps/sales-entities@6.3.0
  - @mj-biz-apps/sales-core-entities-server@6.3.0
  - @mj-biz-apps/sales-actions@6.3.0

## 6.2.0

### Patch Changes

- Updated dependencies [4fc8b40]
  - @mj-biz-apps/sales-entities@6.2.0
  - @mj-biz-apps/sales-core-entities-server@6.2.0
  - @mj-biz-apps/sales-actions@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [0e6b1a3]
- Updated dependencies [f76f9c9]
  - @mj-biz-apps/sales-entities@6.1.0
  - @mj-biz-apps/sales-core-entities-server@6.1.0
  - @mj-biz-apps/sales-actions@6.1.0

## 6.0.0

### Patch Changes

- Updated dependencies [2b6c4ca]
- Updated dependencies [6d46c4a]
- Updated dependencies [c2d8e5a]
  - @mj-biz-apps/sales-core-entities-server@6.0.0
  - @mj-biz-apps/sales-entities@6.0.0
  - @mj-biz-apps/sales-actions@6.0.0

## 5.2.0

### Minor Changes

- 1fa15da: Ship BizApps Sales as an installable Open App.

  The npm packages have been published since 5.1.0, but the app itself could not be installed: there
  was no release workflow, no `vX.Y.Z` tag for the Open App resolver to find, two dependency ranges
  that no published version could satisfy, and — the substantive one — no metadata seed.

  - **`migrations/V202608251930__v5.2.x__Metadata_Sync.sql`.** MJ never reads `mj-app.json`'s
    `metadata.directory` at install; seeding happens exclusively through `migrations/`. Until this
    file, all 22 directories under `metadata/` shipped nowhere, so a clean `mj app install` produced
    every table, view and CRUD proc and no deal status types, no pipelines, no stages, no queries, no
    actions, no remote operations and no application. Every install step reported success. 424
    creates, all with hardcoded UUIDs; 50 updates, every one keyed to an ID the baseline pins.
  - **`migrations-teardown/V001__Retire_Sales_Core_Rows.sql`** retires that payload from the shared
    core schema on `mj app remove`, so a reinstall does not collide on the same fixed UUIDs. The
    seeded placeholder `Company` is deliberately excluded — 30 NOT NULL keys point at `Company`
    across core, accounting and orders — and the seed's one `spCreateCompany` is guarded instead.
  - **`scripts/check-distribution-seed.mjs`** (+ self-test, + `Distribution Gate` workflow) fails the
    build when metadata changes without the seed being regenerated, and when shipped SQL carries a
    placeholder `mj app install` cannot resolve.
  - **Dependency ranges corrected.** `mj-bizapps-common` asked for `>=1.0.0 <2.0.0` and
    `mj-bizapps-orders` for `>=0.1.0 <1.0.0`; the only published versions are `5.x` in both cases, so
    install would have failed at resolution. `mj-bizapps-tasks` is raised to `>=1.2.0` because the
    seed writes `TaskType.Code`, which arrives in 1.2.x.
  - **`fixed` versioning + `publish.yml`**, so a release cuts one `vX.Y.Z` tag — the form the Open App
    version resolver reads — instead of five per-package tags.

### Patch Changes

- Updated dependencies [1fa15da]
  - @mj-biz-apps/sales-entities@5.2.0
  - @mj-biz-apps/sales-actions@5.2.0
  - @mj-biz-apps/sales-core-entities-server@5.2.0

## 5.1.0

### Minor Changes

- b309a07: A deal and its children are Related Record Collections. `DealDraft` and `Sales.SaveDeal` are retired.

  `Deal` now declares **`Lines`**, **`PaymentSchedule`** and **`Team`** in `EntityRelationship` metadata, so
  CodeGen puts typed, writable collections on the generated entity. The same object graph therefore exists in
  the browser and on the server, travels over `MJ.SaveEntityGraph`, and persists through `EntitySavePlan`
  inside one transaction — header first, then removals, then children.

  **Two things existed only to work around the absence of that, and are gone.** `DealDraft` was a UI-side
  model with its own line and instalment arrays; `Sales.SaveDeal` was a remote operation whose whole job was
  to rehydrate the draft's payload into a server-side entity tree, because the entity a browser held had no
  child collections to save. `DealEntityServer` no longer hand-rolls collections, a deletion queue, a
  re-sequencer or an explicit transaction either.

  **BREAKING for anyone importing `DealDraft` or `SalesSaveDealOperation`** from
  `@mj-biz-apps/sales-entities`, and for any caller of `Sales.SaveDeal`: build a `DealEntity`, add children
  through `deal.Lines` / `deal.PaymentSchedule` / `deal.Team`, and call `deal.Save()`.

  **Removal is now EXPLICIT, and this is the one behaviour change rather than a refactor.** `Sales.SaveDeal`
  treated a submitted `Lines` array as the complete desired set and deleted anything missing from it. A
  collection deletes only what was explicitly `Remove()`d — so a header-only save (an Action renaming a deal,
  an agent nudging `NextStep`) can no longer destroy children by not mentioning them, which under the old
  contract was silent data loss. Integration checks SD6 and SD13 pin both halves.

  `DisplayOrder` sequences **contiguously from 1** rather than 10/20/30: the collection's sequencer has no
  increment option, and the old step was cosmetic because every add and remove re-sequenced the whole
  collection anyway.

  **The validation rules moved onto the entities** — `DealEntity`, `DealLineEntity`,
  `DealPaymentScheduleEntity` — so they run in the browser _and_ on the server, on the one path every write
  takes, instead of in a model an Action or an agent bypassed. `DealEntity.SetOwner` is shared for the same
  reason. What still needs a database stays server-only: deal numbering, and the `CompanyID` and
  `OwnerEmployeeID` stamps — two rules that turned out to be enforced _only_ by the retired operation.

- The §9 read models, the ForecastSnapshot daily job, and a cancelled meeting that was being stored as
  Completed.

  Two branch heads had moved past what the previous integration captured, and between them they carried
  both halves of #40. The 13 MJ Queries now ship as metadata under `metadata/queries/` with their SQL, and
  the ForecastSnapshot daily job runs behind a query seam with FS1–FS10 covering it.

  **The D-25 fix is a live bug, not a refinement.** A cancelled Outlook meeting was being ingested with
  `Status: 'Completed'` — so a meeting that did not happen appeared in the activity history as one that did,
  and any measure counting completed meetings counted it. `CK_Activity_Status` already allowed `'Cancelled'`,
  so the fix needed no new vocabulary. `activities.AC18` asserts it.

  92 checks across 9 bundles, 0 failed, 0 skipped.

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

- 9cbd3e1: Phase 1 — the fields a deal needs to become a contract, and the first hand-authored surface

  An account director can now compose a complete deal — party info, product lines, a negotiated payment
  schedule and contract terms — through a custom form, and it persists as one transaction.

  **Schema.** `Deal` gains nine columns (`BillingContactID`, `ExecutionDate`, `StartDate`,
  `EstimatedProjectWeeks`, `AutoRenew`, `AnnualIncreasePctOverride`, `CancellationNoticeDaysOverride`,
  `PaymentMethod`, `ContractVariances`). `DealLine` gains `ProductName`, `DealLineTypeID`,
  `AnnualGrossFees`, `DiscountAmount` and `Total`, and loses the free-text `LineType`. Two new tables:
  `DealLineType` (a type table whose `IsRecurring` flag is what code branches on) and
  `DealPaymentSchedule` (the exception schedule — no rows means standard terms).

  The three signed figures are **transcribed inputs, never derived**. Nothing in the app computes `Total`
  from `AnnualGrossFees - DiscountAmount`, or checks that they agree, or sums the payment schedule: the
  arithmetic on a signed order form belongs to the customer, not to this app.

  **Vocabulary re-seeded to master plan §4.2** — `DealType` is now `New` / `Upsell` / `Renewal` and the
  pipelines are `B2B` / `D2C`. Pure metadata edits with no code impact, which is the vocabulary rule
  paying for itself.

  **`Sales.SaveDeal`.** A browser holds the generated `DealEntity`, not the server subclass, so a deal
  and its children cannot cross the entity-save boundary together. `DealDraft` (framework-free, in the
  entities package) plus this remote operation is how they do: one transactional call, all-or-none, with
  structured `Section`/`Field`/`Severity` issues so a tab can badge itself and a field can mark itself.
  `DealEntityServer` composes header, lines and schedule inside one transaction and derives
  `Deal.OwnerEmployeeID` from the `DealTeamMember` row rather than accepting it as a field.

  **The deal workspace** (`@mj-biz-apps/sales-ng`) is one surface for viewing, editing and creating —
  a deal being created is just a draft whose ID is null. Reached from a new hand-authored **Sales**
  application; the generated entity browser is untouched. Deliberately basic.

  **Three latent schema bugs fixed.** `UNIQUE` over a nullable column allows exactly one NULL on SQL
  Server and unlimited on PostgreSQL, so the schema was enforcing a stricter rule in dev than in
  production. In practice: only one unnumbered deal could exist at a time, a second Sales Engineer could
  not be added to a deal despite `AllowsMultiplePerDeal`, and the D-6 partner-rep path was blocked. All
  four such constraints are now filtered unique indexes, which state the real invariant and make both
  databases agree.

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
- Updated dependencies [c31077b]
- Updated dependencies [b309a07]
- Updated dependencies [a2abcfd]
- Updated dependencies [be23e16]
- Updated dependencies [da0f69f]
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
  - @mj-biz-apps/sales-entities@5.1.0
  - @mj-biz-apps/sales-actions@5.1.0
