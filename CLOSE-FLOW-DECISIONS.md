# Close-flow decisions — unattended run

Non-blocking calls made during the night run. Each states the options, the choice, and **why it is the
least-reversible-cost option** — i.e. the one that costs least to undo if Josue rules the other way.

---

## D-CF1 — A close COMMITS even when the downstream is stubbed

**Options:** (a) close commits, routing recorded as intent; (b) close fails unless the real
contract/order call succeeds.

**Chosen: (a).** Both downstreams are stubs tonight (contracts' seam does not exist; orders cannot be
linked — D-CF3), so (b) makes nothing closeable, no test runnable, and produces zero reviewable code by
morning. (a) is also cheap to reverse: the guard becomes one `if` in `CloseDealOperation` once the
seams are live.

**How the intent is preserved:** the routing outcome is written verbatim into `DealStageEvent.Notes`,
so a stubbed close still leaves an auditable record of what *should* have been created. Provenance is
append-only, so this survives even if the deal is later reopened.

---

## D-CF2 — No baseline/schema change for S4

**Checked against §7:** every column the close flow stamps already exists —
`ActualCloseDate`, `ClosedAt`, `ClosedByUserID`, `ContractID`, `RenewsContractID`, plus
`DealStatusType.IsWon/IsLost/IsClosed/LocksDeal` and `LossReason.RequiresNotes`.
`DealStageEvent` already carries `FromDealStatusTypeID` / `ToDealStatusTypeID` / `ChangedByUserID` /
`ChangedAt` / `AmountAtTransition` / `ProbabilityAtTransition` / `Notes`.

**The one thing absent is a Deal → Order link.** §7 stamps `Deal.ContractID` but never asks for an
order stamp, so adding a column would be inventing scope. Deferred; the order reference goes in
`DealStageEvent.Notes` for now.

**Chosen: touch nothing.** A baseline edit forces a full rebuild + re-seed and re-mints every CodeGen
UUID — expensive and, per §7, unnecessary. Adding a column later is additive and cheap; un-adding one
after a rebuild is not.

---

## D-CF3 — Orders wiring is STUBBED against the real typed seam

The brief says attempt real wiring only if orders links and builds cleanly. It does not, for three
independent reasons — any one sufficient:

1. **`bizapps-orders` is not built** (no `packages/Entities/dist`), so a peer link cannot resolve.
2. **The C0 seam is still missing** — `Subscription.BillingMode` does not exist in orders' schema
   (re-confirmed tonight), which §7's `SubscriptionLinesTo: "Contract"` path depends on.
3. **`OrderLineInput.ProductID` is REQUIRED**, and sales' `DealLine.ProductID` is a nullable soft ref
   that is NULL in every row we have — sales transcribes `ProductName` instead precisely because the
   orders catalog is not installed. **A deal today cannot produce a valid order line at all.**

**Chosen: implement against the real contract, stub the call.** The seam is typed from orders' actual
`orders-create-order-in-state.input.ts` on `origin/mjdev/orders-flow`, so connecting it later is
deleting the stub, not redesigning. Reason 3 is the one to fix first and it is a *data* problem, not a
build problem — see the run report.

---

## D-CF4 — Contracts seam is a typed stub (no choice available)

`Contracts.CreateFromDeal` and `Contracts.RenewTerm` do not exist — contracts ships neither operation
today. Defined the interface sales expects from contracts' plans and §7: a contract created in
**Pending**, nothing firing until Pending → Approved, carrying the deal's `ContractVariances` and
term/renewal fields, and `RenewTerm` used instead when `DealType.RequiresRenewalSource` is set.

**Chosen: stub behind the typed interface**, same shape as D-CF3, so Marcelo's seam drops in.

---

## D-CF5 — §7 says "write an Activity" — skipped, and why

Step 6 of §7 writes an `Activity` alongside the stage event. **The Activity spine does not exist** in
`bizapps-common` or MJ core (verified again tonight), so this step cannot be implemented.

**Chosen: skip it and record the gap** rather than invent a local activity table. Writing a
`SalesActivity` now would prejudge the open spine decision, and activities are historical data — the
worst kind to have to migrate later. `DealStageEvent` already captures the close for provenance, so
nothing auditable is lost in the meantime.

---

## D-CF6 — Policy overrides come from the operation, not a new Deal column

§7 says "a deal may override" the pipeline policy, and its signature is
`Sales.CloseDeal(DealID, DealStatusTypeID, overrides?)`. There is no `Deal.CloseWonPolicyOverride`
column.

**Chosen: honour overrides via the operation's `PolicyOverrides` input**, merged over the pipeline
default at close time. Avoids a schema change (D-CF2) and matches the signature the plan already
specifies. If a persisted per-deal override is wanted later, it is an additive column.

---

## D-CF7 — The lock's editable exceptions are enforced field-by-field

§7.3 freezes the header "except `Description` and `NextStep`". Implemented by comparing old vs new
values on save and refusing when any *other* field changed, rather than by blanket-refusing every save.

**Chosen: field-level comparison.** A blanket refusal would also block the two fields §7 explicitly
allows, and would make `Sales.ReopenDeal` unable to write its own unlock. Slightly more code, but it
is the behaviour the spec describes.

---

## D-CF8 — Reopen clears the close stamps

§7.3 says reopening writes a `DealStageEvent` and records a reason, but does not say what happens to
`ClosedAt` / `ClosedByUserID` / `ActualCloseDate`.

**Chosen: clear them**, because they describe a close that is no longer in effect and would otherwise
make a reopened deal read as closed in every rollup that tests `ClosedAt IS NOT NULL`. The
`DealStageEvent` history still records that the close happened, so nothing is lost — provenance lives
in the append-only log, not in the mutable stamp. Flagged for confirmation.

---

## D-CF9 — The #31 automation-rule tables are in the DB but off this branch, and stay off it

CodeGen reads the LIVE database, and the live database still carries the four `AutomationRule*` tables
the #31 prototype created in an earlier session. So `mj:codegen:files` faithfully generated entity
subclasses, GraphQL resolvers and four Angular form directories for them — on a branch that has no
migration creating those tables.

**Chosen: exclude every automation-rule artifact from commits on this branch**, by staging selectively
rather than by discarding them from the working tree. Committing them would put code on
`feature/close-flow` for tables a from-zero `scripts/rebuild-db.sh` would never create, which breaks the
one property the baseline-in-place loop exists to protect: that a fresh rebuild produces a working
database. Leaving them unstaged costs nothing — they are regenerated on demand — and is reversible,
whereas `git checkout --` would have thrown away #31 work that only exists in this working tree.

The same pass produced line-ending-only churn in eleven `metadata/*.json` files and several generated
Angular forms. Also unstaged, for the ordinary reason that a diff of nothing is noise.

**For Josue:** the #31 tables in `MJ_BizAppsSales` are why a CodeGen run on any branch will keep
offering these files. That is a DB-state artifact, not a repo problem, and it clears itself the next
time the database is rebuilt from the baseline.

---

## D-CF10 — The seeded D2C policy asks for an order state `Orders.CreateOrderInState` rejects

Found while checking whether the orders seam could be wired for real. Two facts that only matter
together:

- The seeded D2C pipeline's `CloseWonPolicy` is `{"CreateContract":false,"OneTimeLinesTo":"Order",
  "OrderState":"Draft"}`.
- `OrdersCreateOrderInStateInput.TargetStatus` documents that **`'Draft'` and `'Quoted'` are not
  accepted** — that path is `Orders.SaveOrder`, and routing a draft through the create-in-state
  operation would run booking on an order not meant to be locked yet.

So the D2C route as seeded would be refused by orders the moment the stub is replaced with the real
call. Nothing fails today because the seam is stubbed, and CD2 passes because it asserts the ROUTE is
planned, not the state it lands in.

**Chosen: change nothing now, and record it.** Two defensible fixes exist — reseed the D2C policy to
`"Confirmed"`, or have the close pick `Orders.SaveOrder` versus `Orders.CreateOrderInState` from the
requested `OrderState` — and picking between them is an S2 decision that wants the pricing bridge in
view. Changing the seed tonight would also silently alter what the demo pipeline does.

**This is the single most likely thing to bite at S2.** It is invisible until the seam goes live, at
which point it presents as orders rejecting a perfectly well-formed close.
