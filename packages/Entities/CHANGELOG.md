# @mj-biz-apps/sales-entities

## 5.1.0

### Minor Changes

- 0691454: Close-won now creates a real contract — the D-CF4 stub retires completely.

  `LiveContractsSeam` calls `Contracts.SaveContract` and `Contracts.RenewTerm` by ClassFactory key, so both
  close-won paths are live. Import-free: no `@mj-biz-apps/contracts-*` import or dependency, and Sales
  builds, passes CI and behaves identically when contracts is absent.

  The two downstreams now resolve INDEPENDENTLY. All four deployments are real — neither sibling, orders
  only, contracts only, both — and a single seam that assumed they arrive together would have disabled the
  contract path on any host without orders.

  Money boundary holds: Sales sends product, quantity and term structure and sets no price.
  `CommittedAmount` is a negotiated commitment stated as zero, never `Deal.Amount` — that is orders' cached
  figure for the whole deal and would both overstate the contract and launder an orders number into a
  contracts field.

  Verified end to end against a seven-app isolated stack: **42/42** integration checks, including new
  CT1–CT4. See `docs/KNOWN-ISSUES.md` KI-13 for the contracts-side defects found along the way.

- 1da61e1: Closing a won deal now creates a real, booked order.

  The D-CF3 seam was written against `Orders.CreateOrderInState`, transcribed from `origin/mjdev/orders-flow`.
  That branch never merged: orders' `next` ships eleven operations and **no create-order operation of any
  name**. Orders' own canonical creation path is the entity graph — `OrderEntityServer.Save()`, which is what
  `order-builder.ts` drives — so sales now creates the order exactly the way orders does, and orders' server
  code mints the number, prices the lines and posts them to the ledger.

  `PreviewOrderMoney` delegates money to `Orders.PriceOrder`, which accepts a draft with no `OrderHeaderID`
  and so prices something that was never persisted. Sales sends `ProductID`, `Quantity` and a requested
  discount; it sends no price, and there is no arithmetic in the handoff.

  The seam selects itself from the DEPLOYMENT: live when orders' entities are registered, stub when they are
  not. Sales still installs standalone — `DealLine.ProductID` remains a soft reference and no sales package
  imports orders' TypeScript. `Orders.PriceOrder` is invoked by ClassFactory key, a string.

  The deal→contract path (D-CF4) stays stubbed and clearly marked. Contracts is not in the workspace, so it
  cannot be proved end-to-end, and half-wiring it would be worse than leaving it honest.

  New `close-won-handoff` bundle (CW1–CW4), verified 4/4 against a live six-app host: the order is created and
  its number minted by orders, its lines carry the picker-set `ProductID`s, every line is priced by orders'
  engine and posted to a journal entry, and the booked total equals an independent `Orders.PriceOrder` preview
  of the same draft. Held out of the default gate, like `product-picker`, because it requires orders.

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

- da0f69f: Foundation for the Deal→Order redesign: `Deal.OrderID` with a real FK to orders'
  `OrderHeader`, and the embedded-record declaration on `DealEntity`.

  Sales now depends on `@mj-biz-apps/orders-entities`. That is sanctioned — Amith
  ruled sales has a hard dependency on orders — but orders' packages are
  unpublished, so **sales is workspace-only until they are published**.

  DealLine is untouched by this changeset; retiring it is the next step.

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

- 838188f: S4 close flow: `Sales.CloseDeal`, `Sales.ReopenDeal` and the close lock.

  Closing a deal is now one atomic transaction that validates what the close requires, resolves the
  effective `CloseWonPolicy`, routes lines downstream, and stamps the close with an append-only
  `DealStageEvent`. The path is resolved from `DealStatusType` flags — `IsWon`, `IsLost`, `LocksDeal` —
  and routing from the pipeline's policy; no name is compared anywhere, so a deployment can rename its
  statuses and pipelines without changing what a close does.

  The close lock is enforced in `DealEntityServer.Save()` rather than the UI, so an Action, an agent and a
  raw `BaseEntity.Save()` all hit the same refusal. `Description` and `NextStep` stay editable per §7.3,
  and `Sales.ReopenDeal` is the only exit — it requires a reason and preserves the close in the event log.

  **The lock covers the CHILD COLLECTIONS as well as the header**, which matters because a deal's lines are
  exactly what the contract and the order were derived from. `Lines`, `PaymentSchedule` and `Team` are
  companions rather than fields, so they never appear in the entity's field list — a lock built only on
  dirty fields would refuse a renamed deal and accept a deleted line, the more damaging of the two. Any
  dirty companion now refuses the save, enumerated generically so a collection added later is protected
  without anyone remembering to add it.

  The check is keyed on the **persisted** status, so the closing transition itself may still carry final
  collection state: a close that writes its last line is legal, and editing that line tomorrow is not.

  The downstream seams to orders and contracts are typed and STUBBED: neither sibling is reachable yet.
  `StubDownstreamSeam` reports the real blocker instead of a fabricated record ID, and the routing intent
  is preserved in the stage event's notes. `SetDownstreamSeam()` is the swap point.

  No schema change — every column §7 stamps already existed.

- 7744ea8: DealStageEvent gains AmountAtTransitionIsComputed, close-won tasks get a due date, and a close derives its
  closing stage. Adds two migrations (the column plus the view rebind it needs), so this is a minor bump
  under the repo's migration rule.
- f5c95d9: **BREAKING — `CloseWonPolicy.OrderState` is removed from the published input contract.** A deployment
  setting it is configuring nothing; what it used to say is now said by the STAGE.

  `PipelineStage.OrderStatusOnEntry` (nullable, `Draft | Quoted | Confirmed | Voided`) is the new home for
  "what does this mean for the deal's order" — S-US5, ruled by Andrew in `docs/DECISIONS.md` D-OS1. It
  mirrors `DealStatusTypeID`, which already answers the same question for the deal's own status from the
  same table, and unlike a close-time policy key it speaks on every stage change rather than only at the
  moment of a won close.

  - **The writer is on the WRITE PATH** — `DealEntityServer.Save()`, keyed on `PipelineStageID` changing,
    beside `provisionEmbeddedOrder()` and inside a transaction that commits with the deal. Not the UI: a
    stage change arrives from the board's drag, an importer or an agent (D-OS3).
  - **A refused order update never blocks the stage change** (D-OS2). `CanTransition` — orders' own table
    of legal moves, imported rather than restated — is asked first, so the guaranteed refusal
    (`Voided → Quoted` on a reopened lost deal) costs no write and the warning carries orders' wording.
    Warnings surface as `Issues` with `Severity: 'warning'` from `Sales.CloseDeal` and `Sales.ReopenDeal`.
  - **`Posted` and `Fulfilled` are not available to a stage.** They are finance and fulfilment outcomes;
    a stage that could name them would let the board post to the ledger.
  - **Seeded:** `Quoted` from Proposal onward including the winning stage, `Voided` on Lost, nothing on the
    early stages. `Confirmed` is seeded nowhere on purpose — see `DECISIONS-NEEDED.md` DN-10, which is one
    field on one row.

  This completes S-US7 (a lost deal voids its order) and S-US8 (a reopened deal warns instead of
  un-voiding — the intended behaviour, not a gap).

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

- a2abcfd: The by-rep reports have something to return, and a slippage report that could never have run is fixed.

  Every `DealTeamMember` row sat on an OPEN deal, while both by-rep reports key on `ActualCloseDate` joined
  through that table. So `Sales: Bookings by Owner` and `Sales: Deal Involvement by Rep` returned **zero
  rows** on seeded data — the two reports §9.4 exists to distinguish, both silent, and a query that runs
  clean and returns nothing is indistinguishable from one that is broken.

  The two closed deals now carry real teams. Measured on the database: bookings-by-owner credits the won
  deal's 27,480 to the AE **once**, while the weighted report splits the same deal 16,488 / 6,870 / 4,122 —
  adding back to 27,480 exactly. The same three rows each carry `WonAmountOfDealsTouched = 27,480`, so summing
  that column gives 82,440 for a 27,480 deal: §9.4's triple-count, visible on screen.

  **`Sales: Slipped Deals` could never have returned a row.** It joined `d.ID = s.RecordID`, and
  `RecordChange.RecordID` is a composite-key string (`ID|<guid>`) — SQL Server converts toward
  `uniqueidentifier` and the statement dies. It looked healthy only because nothing qualified. Seeding a real
  date move exposed it on the first try.
