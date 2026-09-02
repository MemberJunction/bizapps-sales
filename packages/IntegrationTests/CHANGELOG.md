# @mj-biz-apps/sales-integration-tests

## 6.2.0

### Patch Changes

- Updated dependencies [4fc8b40]
  - @mj-biz-apps/sales-entities@6.2.0
  - @mj-biz-apps/sales-core-entities-server@6.2.0
  - @mj-biz-apps/sales-server@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [0e6b1a3]
- Updated dependencies [f76f9c9]
  - @mj-biz-apps/sales-entities@6.1.0
  - @mj-biz-apps/sales-core-entities-server@6.1.0
  - @mj-biz-apps/sales-server@6.1.0

## 6.0.0

### Patch Changes

- 6d46c4a: Lined deals cache `OrderHeader.TotalGross` onto `Deal.Amount` (sales copies, never sums). A typed figure survives only on a header-only deal.
- Updated dependencies [2b6c4ca]
- Updated dependencies [6d46c4a]
- Updated dependencies [c2d8e5a]
  - @mj-biz-apps/sales-core-entities-server@6.0.0
  - @mj-biz-apps/sales-entities@6.0.0
  - @mj-biz-apps/sales-server@6.0.0

## 5.2.0

### Patch Changes

- Updated dependencies [1fa15da]
  - @mj-biz-apps/sales-entities@5.2.0
  - @mj-biz-apps/sales-server@5.2.0
  - @mj-biz-apps/sales-core-entities-server@5.2.0

## 5.1.0

### Minor Changes

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

- 57d29f0: Add `CloseWonTaskService` — the finance tasks a won deal raises (S-US2 #34, S-US3 #35).

  Both pipelines get an order-review task linked to the deal's order; a pipeline whose
  `CloseWonPolicy.CreateContract` flag is set also gets a contract-processing task.
  Pinned by WT1–WT6.

  NOT wired into `Sales.CloseDeal` — that file is mid-rework for the embedded-order
  redesign, and the wiring lands after it.

  Sales now depends on `@mj-biz-apps/tasks-core` and `@mj-biz-apps/tasks-entities`.

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

- be23e16: The demo now shows a priced deal and a stated one, and provisioning reaches deals that already exist.

  `Deal.Amount` became a cache of `OrderHeader.TotalGross`, and the provenance rule holds: a hand-typed
  figure is never overwritten. But every seeded deal WAS hand-typed, so the cache was invisible and so was
  the argument it makes. `scripts/seed-demo-lines.mjs` now drives the entity layer for five of the seven
  seeded deals — lines by product and quantity only, priced by orders — and leaves two stated on purpose.
  Run from `seed-demo-data.sh`, separately re-runnable, and allowed to fail without failing the seed.

  **It found a real defect.** `provisionEmbeddedOrder()` returned early on `this.IsSaved`, so an order could
  only ever be provisioned on a deal's FIRST save — every deal that already existed without one was
  permanently unable to acquire one, and reaching for the embedded order built an unstamped record that died
  two apps away on `CompanyID cannot be null`. It now asks whether the ORDER is saved, which covers both the
  new deal and the old one. Pinned by `save-deal.SD24`, mutant `M-PV1`.

  **And the seeded close-won policy named a contract type that has never existed.** It said `Standard`;
  contracts ships 'Order Form', 'Statement of Work', 'Payment Link' and 'Change Order'. Every B2B close-won
  would have planned a contract the seam could not create. Found because contracts became readable and
  `close-won-contract.CT1` resolved against the live table for the first time.

  CT0, the tripwire that replaced the earlier CT1–CT4, has done its job and is retired. **CT1 and CT4 are
  now real**: contracts mints the `ContractNumber` sales never sends, and an unresolvable type is refused
  loudly with nothing written. `M-CT1` proves the second one — flipping one boolean makes the seam report a
  successful create for a contract that does not exist, and only CT4 notices.

  49 checks, 0 failed, 0 skipped. Thirty-one mutants, twenty isolating exactly one check.

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

- 7f84812: Drop the graph-node guard from `DealEntityServer.Save()`, which no longer compiles
  against MJ `next`.

  MJ removed `EntitySaveOptions.IsGraphNodeSave` in `47ff71d68b` so application code
  cannot skip companions through a public flag, and moved the node path to a private
  `BaseEntity.saveAsGraphNode`. The graph now executes every node — root included —
  without re-entering the public `Save()`, so the double-call the guard existed for
  cannot happen and `Save()` runs exactly once per save.

  Adds SD17, which pins that on the composite path: a deal saved together with its
  lines must consume exactly ONE deal number. SD11 only ever covered childless deals,
  which never build a save plan at all, so nothing was watching the graph path.

- ee89d95: A lost close is now asserted to raise no tasks, and the story audit is re-reported on the integrated tree.

  `close-won-tasks.WT11` asserts S-US7's third criterion directly. WT1–WT10 all prove what a WON close
  creates; nothing proved what a LOST close does not, and "no tasks are created" was resting on reading
  `if (target.IsWon)`. That line is correct — but an unasserted negative is what a later refactor moves a
  brace through, and the failure is silent: finance works an order review for a deal nobody won. Mutant
  `M-WT1` ungates the task step and fails WT11 alone.

  The audit itself is now reported against the integrated branch, which is the first version worth
  reporting. Four of the nine stories are met outright; every remaining gap but one is upstream of this
  repo.

- 36ef1a4: `Deal.OwnerEmployeeID` now refuses a direct edit instead of silently keeping it.

  S-US1 says the owner column "cannot be edited directly", and it could. `stampOwnerFromTeam()` only
  re-derives the stamp when the roster took part in the save — which is correct, because otherwise an
  ordinary header edit would read an unloaded collection as "no owner" and clear it. The consequence was
  two paths and a refusal on neither: a save carrying the roster silently discarded a hand-set stamp, and a
  header-only save silently **kept** one. So the app could hold a deal whose owner column and owner-role
  team row named different people, reached by a plain `BaseEntity.Save()` with no error. The stamp exists so
  per-rep rollups need no join, which means a rollup could disagree with the roster it was meant to
  shortcut.

  `ownerStampEditRefusal()` refuses the save, with a message naming `SetOwner` — the operation the caller
  actually wanted. Refusing beats silently re-deriving: quietly correcting someone who believed they were
  setting the owner produces the same wrong outcome with nothing to notice.

  `SetOwner()` is unaffected, and not by luck: it loads the roster before assigning the stamp, so the roster
  is part of that save. The guard's conditions mirror `stampOwnerFromTeam`'s exactly.

  `save-deal.SD26` asserts the refusal, that nothing was written, and that the refusal is **narrow** — the
  same header-only save with an ordinary field must still succeed. Mutant `M-OW1` removes the guard and
  fails SD26 alone.

  53 checks, 0 failed, 0 skipped. Thirty-five mutants, twenty-four isolating exactly one check.

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

- 070bfb8: A stage's probability and forecast category are now applied on the write path, not only in the workspace.

  `ApplyStageDefaults` lived in `DealWorkspaceComponent` and ran from the stage picker, so a stage set by an
  agent, an Action, the S6 HubSpot importer or any API caller got neither value: the pipeline designer's
  answer sat unused in the stage row while the deal landed with whatever the caller supplied, or null. The
  same shape as the order provisioning that used to live in the workspace — a rule the UI enforces is a rule
  only the UI obeys.

  It now runs in `DealEntityServer.saveWithinScope`, on the same `PipelineStageID` trigger and in the same
  transaction as the order-status writer, the stage event and the amount cache.

  **It fills; it does not overwrite** — the amount cache's rule. A value the caller stated in this save is
  theirs; one they did not state is the stage's to supply. The two cases are asked differently because
  `Dirty` does not mean the same thing on a new record as on an update, and `board-move.BD2` caught the
  version that ignored that.

  `BD5` proves the defaults arrive through the entity layer with no UI involved; `BD6` proves a stated
  probability survives while the field the caller left alone still fills. Mutants `M-BD1`, `M-BD2`, `M-BD3`.

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

- 8794124: A turnkey workspace-setup guide, an end-to-end smoke, and a company-agnostic catalogue seed.

  `docs/WORKSPACE-SETUP.md` is the guide a tester can follow to stand up the full sales → orders →
  accounting stack without re-deriving it: clone order, the CLI bootstrap chicken-and-egg, migration order,
  the seeds, and the rough edges worth recognising. Every step was executed end to end against a fresh clone
  set and an empty database, reaching 38/38 integration checks and an 11/11 smoke.

  `test-harnesses/smoke-close-won.mjs` walks a deal from creation through the picker to a booked order and
  reports pass/fail per step. Unlike the `close-won-handoff` bundle it COMMITS, leaving a `SMOKE-`prefixed
  deal and a real order to open.

  `scripts/dev/seed-orders-catalog.sql` replaces a version that hardcoded one host's company UUIDs. It now
  discovers the selling company the same way `ResolveSalesFixture` does — via the first active pipeline —
  which is what makes PP2, the cross-tenant leak check, meaningful rather than accidentally true.

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
  - @mj-biz-apps/sales-server@5.1.0
