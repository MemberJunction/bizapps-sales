# @mj-biz-apps/sales-ng

## 6.3.1

### Patch Changes

- d40fd69: License declarations now agree on BUSL-1.1 everywhere.

  The Open App manifest (`mj-app.json`) declared `"license": "ISC"` and the README badge
  advertised ISC, while `LICENSE` and every `package.json` declared BUSL-1.1. The manifest is
  what an MJ deployment reads on install and the badge is the first thing a reader sees, so
  between them they were the repo's loudest license statement — and the wrong one. The badge
  now links to `LICENSE`.

- Updated dependencies [d40fd69]
  - @mj-biz-apps/sales-entities@6.3.1

## 6.3.0

### Minor Changes

- 11b3613: A term start on subscription lines, defaulting to the order date (#32).

  A subscription line on a deal now carries its own **Term start**. It displays the embedded order's
  `OrderDate` as a default, writes `OrderLine.ServicePeriodStart` when the rep sets one, and stops
  following the order date once set. A reset action returns it to the default. Non-subscription lines do
  not show the field.

  **`sales-entities`** gains `term-start.ts` — `IsSubscriptionProduct`, `ShouldOfferTermStart`,
  `EffectiveTermStart`, `HasExplicitTermStart` — as pure rules with no Angular dependency, so the
  integration suite can check them without standing up a component. `ProductLookup` gains
  `SubscriptionTypeID`, and `PRODUCT_LOOKUP_FIELDS` is exported so the picker's query and the check that
  guards it read one list rather than two copies. That constant now carries an `as const satisfies`
  completeness check against `keyof ProductLookup`, because rebasing this branch onto #29 showed how the
  list fails: it produced no merge conflict at all — `next` had never carried the constant — so git took
  this branch's version whole and silently dropped the two fields #29 had added. Nothing would have
  failed until a line booked to the wrong company.

  **A note on the bump level.** `SubscriptionTypeID` is a REQUIRED member of the exported `ProductLookup`
  interface, so strictly any external code constructing one stops compiling. It is declared `minor` here
  anyway, and the reason is that the level makes no difference to what ships: #29's changeset is still
  pending in this same release, it declares `major`, and `.changeset/config.json` groups all six packages
  as `fixed` — so everything moves to **6.0.0 together** and this interface change goes out under a major
  either way.

  Were it deciding the number on its own, `minor` would still be the call: no consumer of this type exists
  outside this repository — verified across `bizapps-orders`, `bizapps-accounting`, `bizapps-contracts`,
  `bizapps-common`, `bizapps-tasks` and MJ — and Robert Kihm confirmed on 2026-08-29 that there is leeway
  on major/minor before LTS. Recorded rather than assumed, because the next required member added to this
  interface may not have a major already travelling with it.

  **This field has no effect until bizapps-orders#121 lands, and that is worse than it sounds.** Orders
  today overwrites `ServicePeriodStart` at confirm from `SubscriptionBehavior.ComputeStartDate`, whose
  context carries no field for a requested start at all — so the rep's date is discarded AND orders writes
  its own computed date back into the column. Reopening the deal then shows that computed date as though
  someone had deliberately chosen it, complete with the reset button and no "order date" hint. Sales and
  orders need testing together, which is what Andrew's note on both issues asks for.

### Patch Changes

- Updated dependencies [11b3613]
  - @mj-biz-apps/sales-entities@6.3.0

## 6.2.0

### Patch Changes

- Updated dependencies [4fc8b40]
  - @mj-biz-apps/sales-entities@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [0e6b1a3]
- Updated dependencies [f76f9c9]
  - @mj-biz-apps/sales-entities@6.1.0

## 6.0.0

### Minor Changes

- c2d8e5a: A deal may carry any company's product, and the line takes its company from the product (#29).

  **All six `@mj-biz-apps/*` packages move to 6.0.0 together.** `.changeset/config.json` declares them
  `fixed`, so a major anywhere moves the group — the `minor` below is what `sales-ng` would warrant on its
  own, not what it will ship. `sales-actions`, `sales-core-entities-server` and `sales-server` are
  unchanged by this PR and go along for the ride. Approved by Robert Kihm on 2026-08-29: moving Sales to v6
  brings it in line with the MJ major version, and there is leeway before LTS.

  **Breaking, `sales-entities`.** `ProductFilterFor(companyID, asOf)` is now `ProductFilterFor(asOf)`.
  The `CompanyID = <the deal's company>` clause is gone; `Status = 'Active'` and the availability
  window stay. Callers drop the first argument. There is no behavioural shim: a filter that silently ignored a company
  you passed it would be worse than one that fails.

  Note the failure is not always a compile error. Three `.mjs` harnesses in this repo called the two-argument
  form, and nothing type-checks `.mjs` — the GUID bound to `asOf` and they died at runtime on
  `asOf.getUTCFullYear is not a function`. All three are updated in this PR, and each now spells out its own
  company clause, since wanting products for ONE company is a real need the shared rule no longer expresses.

  `ProductLookup` additionally carries `CompanyID` and `Company` (the owning company's NAME, so the
  picker can distinguish two same-named products from different companies) — both additive — a line's company can no longer be
  inferred from the deal, so it has to come from the product the rep actually chose.

  **Why.** With both pipelines owned by Blue Cypress, that clause made every Betty and Sidecar product
  unsellable — an Account Director could not put one on a deal at all. Company ownership lives at the
  PRODUCT, not at the deal (Johanna Snider, Sales channel, 2026-08-26). `docs/DECISIONS.md` D5 has always
  said a deal lives in one company's pipeline while its lines carry their own company from the product,
  so the clause contradicted D5 and the picker now agrees with it. No tenancy boundary is being relaxed,
  because there was never one here.

  **`sales-ng`.** `OnProductChange` stamps the line's `CompanyID` from the chosen product rather than
  from the pipeline. Orders' `OrderLineEntityServer` derives the same value at save, so the stored value
  was already correct either way; the stamp exists for the browser, where `CanSave` runs
  `deal.Validate()` without that server subclass and `OrderLine.CompanyID` is NOT NULL. Left unset, the
  rep gets a disabled Save reading "Company ID cannot be null" against a form that looks complete. The
  deal header still derives its company from the pipeline, unchanged.

  Also adds a unit-test tier to this repo — `vitest` plus a root config shaped after bizapps-orders, and
  `test:unit` wired into `verify`. `test:unit` had been a dead script with no dependency and no config,
  which is why two of this issue's acceptance criteria had no coverage in any tier.

### Patch Changes

- Updated dependencies [c2d8e5a]
  - @mj-biz-apps/sales-entities@6.0.0

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

## 5.1.0

### Minor Changes

- c31077b: Deal lines can name a product from orders' catalogue.

  `DealLine.ProductID` has been carried on the entity since the previous release, but nothing populated it —
  a rep could record _that_ a line existed without saying _what_ it was for. This adds the picker, and the
  rule deciding what may appear in it.

  `ProductFilterFor(companyID, asOf)` lives in `sales-entities` rather than in the component, so the UI,
  the integration suite and (later) the close-won handoff all apply one rule instead of three re-typed
  copies of it. It filters on three conditions, each of which fails silently when wrong: the selling
  company, a sellable status, and the availability window evaluated **as of a date** rather than "now" —
  so a deal quoted last year and one quoted next year do not see the same catalogue.

  Orders may be absent entirely, and that stays supported: `DealLine.ProductID` is a soft reference with no
  foreign key crossing into orders' schema. `LoadProducts` checks the entity is registered before querying,
  because `RunView` against an unregistered entity logs a console error rather than returning a failure —
  which took the whole workspace screen down on a host without orders.

  Integration checks PP1–PP4 cover the filter against a live database. They are **not** in the default gate
  yet: they need orders' entity metadata, which cannot be registered on a Sales-only host. The reason, and
  what it would take, is recorded in `docs/KNOWN-ISSUES.md` KI-10.

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

- b054bb3: Per-entity Explorer forms (#89 P3) — metadata for layout, three subclasses for behaviour.

  Nineteen of the twenty-two Sales entities get their form chrome from metadata
  (`metadata/entities/.form-chrome.json` plus the relationship file). Layout is data; it does not belong in
  a component. Those files are **committed but not yet applied**: `Entity.Configuration` does not exist on
  the MJ version this repo pins, so they land when MJ is upgraded. `metadata/entities/README.md` names the
  two upstream migrations that add it.

  Three entities have a hand-authored form, registered at **explicit priority 2** rather than relying on
  bundler import order, and only because behaviour — not layout — required it:

  - **Deals** refuses a locked edit before the round trip and says which fields are frozen, and warns when
    `Deal.Amount` predates the lines it claims to describe. The lock's field list now lives in ONE place,
    `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`, read by both the form and `DealEntityServer.Save()`. New check
    **CD14** pins it in both directions, so the constant cannot drift from the wall it protects users from.
  - **Deal Lines** refuses edits to the pricing provenance, using the same list the entity server refuses.
  - **Deal Stage Events** refuses edit mode outright — the record is append-only.

  Honest limitation, recorded rather than papered over: `BaseFormComponent` has no per-field read-only hook
  and MJ metadata has no field-level UI config, so these forms cannot grey individual fields out. They move
  the refusal to the moment of saving and name the field, instead of forking a generated template that would
  drift on the next CodeGen run.

- 952d9fa: Inline account and contact creation happens in a slide-in and selects the result back into the field.

  S-US1 says a rep can create a customer organization or primary contact "without leaving the deal."
  `CreateRelated()` opened a new Explorer tab and returned nothing to the picker, so the rep had to navigate
  back and re-find the record they had just made. It now opens a slide-in via `MJFormPresenterService` —
  omitting `RecordId` is the presenter's own contract for a new record — reads the created entity from
  `AfterSaved()`, reloads the lookups, and selects it.

  The old comment argued there was no reliable moment to come back at. That was true of a tab, which has no
  lifecycle the component can await, and false of a slide-in, which has exactly that moment. The half of the
  argument worth keeping is kept: an explicit switch over a `DealRelatedTarget` union writes only the field
  the rep launched from. The create button is now also hidden when that field is not editable, so a locked
  deal cannot create a record it would then fail to attach.

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

- 38bc458: Phase 2 — the family's app layout, deal numbering, and a committed integration suite

  **`/app/sales` now reads as an app.** A section shell matching bizapps-contracts and bizapps-orders —
  `mj-page-layout` > `mj-page-header` > `mj-page-body` row > `mj-left-nav` + one `mj-page-body-interior` —
  with three rail pages: a dashboard, a deal roster, and the workspace. Every roster row opens that deal
  in the workspace, which closes the Phase 1 gap where a deal could be created but never re-opened. The
  information architecture is declared as data in `nav/sales-nav.model.ts`, so adding a section later is a
  nav item plus a resource rather than a change to a component.

  Nothing new needed vendoring: every shell primitive ships in `@memberjunction/ng-ui-components`, already
  a peer dependency. `mj-workspace-card` remains the only vendored component.

  **Deals are numbered `DEAL-{seq}` on insert.** A singleton `DealSequence` counter plus an atomic
  `spAssignNextDealNumber`, matching contracts' and orders' singletons rather than accounting's
  per-company-per-fiscal-year scope — a ledger number must name its legal entity and year, an internal
  deal handle should be short and globally unique. The number is taken inside the caller's transaction, so
  a rolled-back save releases it and the series stays gap-free, and it is never regenerated: a deal number
  travels to contracts, orders and people's email.

  **`Sales.SaveDeal` now has a committed integration suite** — `save-deal`, SD1–SD12, against a live
  database with nothing mocked. It covers the three-table transaction, the pipeline-derived company, the
  owner stamp derived from `DealTeamMember`, the `Resolved*` columns staying NULL, the signed `Total`
  stored verbatim, complete-set line semantics, numbering and gap-freedom, and the structured refusal
  shape. Each check rolls back, so the suite is re-runnable and leaves no rows.

  `RUN_MUTATION_TESTS=1` is mandatory and the guard is inside the runner: selecting zero checks exits
  non-zero with an explanation instead of reporting a pass for having done nothing.

- 03a5fcc: Pipeline board, and stage-transition provenance behind it.

  A **Board** page joins Dashboard / All deals / Workspace in the Deals rail. Columns are the selected
  pipeline's `PipelineStage` rows in `DisplayOrder`, with a pipeline switcher; cards are the deals in each
  stage and open in the workspace exactly as a roster row does. Column headers show a count and a
  `SUM(Deal.Amount)` of stored amounts — summed over deals, never over `DealTeamMember`, and nothing is
  priced.

  Dragging a card moves the deal and applies the target stage's probability and forecast defaults, which
  stay editable. **`Sales.SaveDeal` now appends an append-only `DealStageEvent`** whenever it sees the stage
  change, stamping the amount and probability the deal held _on the way out_ — the save and the append share
  one transaction, so a move cannot land without its provenance.

  A drag **never** closes a deal: a stage whose `DealStatusType.LocksDeal` is set refuses drops and says
  why, and closing remains the explicit `Sales.CloseDeal`. No orders or contracts seam is invoked.

  Uses `@angular/cdk/drag-drop`, already this package's drag primitive for workspace tab reordering — MJ has
  no generic kanban component at v5.51.0 despite the docs listing one. No schema change; every column
  already existed.

- 7f92b70: **BREAKING — `DealLine` and `DealLineType` are retired.** A deal no longer holds lines. It holds an
  `OrderHeader`, embedded and provisioned on the deal's first save, and the lines live on that order
  (S-US4). The baseline migration drops both tables; `docs/DECISIONS.md` D-DL1 records the invariant
  reconciliation that went with each deletion.

  What moved, and what that means for a caller:

  - **`deal.Lines` is gone.** Read `deal.OrderID_Object.Lines`, and remember it is declared
    `Load: 'explicit'` on the ORDER — `deal.LoadRelatedRecords(...)` does not reach it. Missing that second
    hop is a deal that renders with no lines rather than an error, which is why `save-deal.SD20` exists.
  - **A rep supplies product and quantity, nothing else.** `UnitPrice`, `CompanyID` and `LineNumber` come
    back from orders. The `DealLine.Resolved*` provenance block is gone with the table; Rule 1 is now
    asserted positively by `save-deal.SD19`.
  - **A discount is a PERCENT, never an amount** (D-DL2, and `npm run test:discount-gate` enforces the
    conversion in both directions).
  - **Close-won no longer creates an order.** The deal already has one, and a won close leaves it alone —
    unchanged in status, still editable, so finance can correct it before the Confirm that books it
    (S-US5/S-US6). `close-won-order` CO1–CO5 assert that inverse; the two bundles that asserted the
    opposite are deleted.
  - **Orders is now a HARD dependency, including for the check suite.** A deal cannot be saved without it,
    so every bundle is marked `requires: "orders"` and the coverage gate fails on an empty expectation.

  Three live risks this surfaces are recorded rather than papered over: **KI-20** (removing an order line
  is silently dropped, so the workspace's delete-line affordance does not work), **KI-21** (a host must
  register orders' server package or no deal with an order can be opened) and **KI-22** (orders' generated
  resolvers are behind the database). None is fixable from this repo; `DECISIONS-NEEDED.md` carries the
  open calls.

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

- 0ffb950: `Deal.StandardAgreementModified` — one column that closes a criterion in two stories.

  S-US1 lists a "standard agreement modified" flag among the fields a rep supplies, and no such column
  existed. S-US2 says the contract's `HasModifications` is copied from it, which is why the contracts seam
  hardcoded `false` — there was nothing to copy. Both are now real: `BIT NOT NULL DEFAULT 0` on `Deal`,
  on the variances pane of the deal workspace, carried through `buildContractInput` into
  `LiveContractsSeam`.

  **It is deliberately not derived from `ContractVariances`.** An empty variances box means nobody wrote
  anything down, which is a different claim from nothing having been negotiated — and contracts' review
  task branches on the difference: a true flag means capture each deviation as a
  `ContractTemplateModification`, a false one still means read the document, because the rep may have
  forgotten to raise it. Inferring the flag from whether somebody typed a paragraph would hand finance a
  guess and call it a fact.

  Two checks, because the wiring has two hops. `CT5` proves the seam writes both values and reads an
  absent flag as false. `CT6` drives the whole close and reads the contract the close created — and it
  exists because mutating the first hop alone (`M-CT3`) left all fifty other checks green.

  **CT6 also caught the `'Standard'` contract type a second time**, in the seeded `CloseWonPolicy` the
  integration fixture resolves. Same defect as the one CT1 found in the metadata file, in a different
  place, and it would have made every B2B close-won plan a contract that could not be created.

  51 checks, 0 failed, 0 skipped. Thirty-three mutants, twenty-two isolating exactly one check.

### Patch Changes

- 07dc10e: Four UAT-facing defects, each with the check that would have caught it.

  **The close raised no order-review task for any deal that did not already have an order.** Provisioning
  moved into `DealEntityServer.Save()`; the task call sat twenty lines earlier and read `deal.OrderID`. So
  every seeded, legacy and imported deal closed with a warning saying it had no order — while `Save()`
  created one a moment later. Finance got nothing and the warning said the opposite of what happened. The
  task block now runs after the save, still inside the transaction.

  **No contract-processing task ever linked its contract.** `ContractID` was never passed, so the service's
  `if (input.ContractID)` branch was unreachable from production and its fallback message was dead code.

  **A refused discount did not block Save.** The refusal lived in a map only the template read. A rep typed
  `0.5`, saw the refusal, and saved a line still holding `0.10`.

  **Every order-line error landed on the wrong pane.** `EmbeddedRecord.prefixError` emits
  `OrderID_Object.Lines[3].Quantity` and the parser anchored on `[A-Za-z]+`, so errors fell through to
  Party info with no row marked.

  New: `close-won-tasks.WT13`/`WT14`, mutants `M-TK1`/`M-TK2`, and `scripts/assert-workspace-validation.mjs`
  — wired into `verify` and into CI, which also now runs the discount gate for the first time.

- b85293a: A provisioned order now takes the status its stage declares, instead of always Draft.

  The order-status writer keyed on `PipelineStageID` **changing**, which is right for a move and wrong for a
  birth. A deal already at or above the agreement threshold when its order was provisioned never triggered
  it, so the order stayed `Draft` while its stage plainly declared `Quoted` — and the board displays that
  mismatch without complaint. Found by the story audit reading the database rather than the code:
  `DEAL-9003` at Proposal with a Draft order. It would have hit every open deal the HubSpot import lands
  past Proposal in S6.

  `_orderJustProvisioned` lets a birth ask the question a move asks. Pinned by `save-deal.SD25`, which
  gives a stage an opinion, strands a saved deal without an order, and then saves it **without moving the
  stage** — so a pass cannot come from a move. Mutant `M-PV2` reverts the gate and fails SD25 alone.

  Also: the dashboard's `ClosingSoon` now sorts on `ExpectedCloseDate` rather than trusting the roster
  query's `ORDER BY` to stay what it is today. Same output, but the comment claiming "soonest first" is
  enforced by the code beneath it instead of by a clause in another file.

  52 checks, 0 failed, 0 skipped. Thirty-four mutants, twenty-three isolating exactly one check.

- Updated dependencies [0691454]
- Updated dependencies [1da61e1]
- Updated dependencies [c31077b]
- Updated dependencies [b309a07]
- Updated dependencies [a2abcfd]
- Updated dependencies [da0f69f]
- Updated dependencies [b054bb3]
- Updated dependencies [9f9fa15]
- Updated dependencies [9cbd3e1]
- Updated dependencies [7f92b70]
- Updated dependencies [55088ad]
- Updated dependencies [838188f]
- Updated dependencies [7744ea8]
- Updated dependencies [f5c95d9]
- Updated dependencies [0ffb950]
  - @mj-biz-apps/sales-entities@5.1.0
