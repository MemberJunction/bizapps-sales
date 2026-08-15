# Decisions — bizapps-sales

App-specific rulings, recorded where the code they govern lives. The cross-app strategy and the
`L-1…L-21` decision log stay in Blue Cypress's private `new-products` repository; the app's own design
source of truth is `plans/bizapps-sales-master.md` (currently on the `an-master-plan` branch — see D7).

Each entry records **what was decided, by whom, and why**. The *why* matters more than the *what*: a
decision without its reasoning gets re-litigated by the next person, or silently reversed by someone who
assumes it was an accident.

---

## 2026-08-04 — the seven S1 open questions

Ruled by **Josue** (repo owner, sales) at the close of the S0/S1 bootstrap. These resolve
`plans/bizapps-sales-master.md` §15 plus two questions raised during implementation.

### D1 — `AllowMultipleSubtypes` on common's `Person` / `Organization`: no change here

**Decision:** keep the IsA extensions exactly as built. **Do not edit `bizapps-common` from this repo.**
The fix is a `bizapps-common` change (flip the flag to `true`), which Josue is raising with the team
separately.

**Why:** MJ's IsA defaults to *disjoint* — one child type per parent record. Sales is currently the
**first** app to extend either entity (accounting extends `MJ: Companies`; orders extends its own
`Product` / `OrderLine`), so the disjoint default chains **correctly today**. The moment a second app
(ATS, certification) extends `Person` with the flag still `false`, the second app **silently mis-chains
at runtime** — no error, wrong data.

**Status:** ⚠️ **Open risk, tracked in [`KNOWN-ISSUES.md`](./KNOWN-ISSUES.md).** Not a blocker for sales.

---

### D2 — Quota / attainment (master plan D-3): defer to v2

**Decision:** no `Quota` table, no columns, no change.

**Why:** quota is meaningless without a full period model, and forecast roll-up is genuinely useful
without it. "Get off HubSpot" — the v1 definition of done — does not require comp tracking. A half-built
quota feature is worse than none, because people start reconciling against it.

---

### D3 — Territory: a label, not a routing engine

**Decision:** keep `SalesAccount.Territory` as `NVARCHAR(100)`, as built.

**Why:** territory *routing* is a product in its own right and is on the cross-app plan's explicit
not-doing list. A label satisfies the v1 dashboard requirement (slice accounts by territory) and keeps
the door open — a routing engine can later read the same column rather than replacing it.

---

### D4 — Default attribution: the owner role

**Decision:** when no `AttributionPct` is set, by-rep roll-ups attribute to the **owner role** (the
`DealTeamMember` whose `DealRole.IsOwnerRole = 1`). Encoded in the seeds as `Owner / AE` carrying
`DefaultAttributionPct = 100`. No server logic yet — that lands with S3/S4.

**Why:** it is the **only** default where the sum of by-rep attribution equals total bookings. An equal
split across active members silently shifts historical roll-ups the moment a deal's team changes, and
produces a "bookings by rep" total that does not reconcile to the company number.

> See master plan §5.2 and the extended property on `DealTeamMember`: a deal with an AE, an SE and an
> SDR has three rows, so **summing `Deal.Amount` across that table triple-counts the deal.** Every
> by-rep or by-role report must declare whether it filters to the owner role or weights by
> `AttributionPct`.

---

### D5 — Cross-company pipelines: `Pipeline.CompanyID` stays required

**Decision:** keep `CompanyID` **NOT NULL** on `Pipeline`, as built, mirroring `Order.CompanyID` in
orders (its D6/D7).

**Why:** a required owning company is what makes every roll-up in master plan §9 sliceable by company
**for free**, and it matches how BC actually sells — several operating companies, each with its own
motions. A deal may still span companies commercially: it lives in one company's pipeline while its
`DealLine` rows carry their own `CompanyID`, stamped from each product's owning company. That
materializes into orders with correct per-line ownership, so each line books its own single-company
journal entry with no extra work here.

**Status:** **confirm-only.** Pending business ratification from Amith / Johanna. **No schema change
either way** — if they disagree with the commercial shape, that is a reporting-semantics conversation,
not a migration.

---

### D6 — `ForecastSnapshot` column names: keep the `*Amount` suffix

**Decision:** **keep the rename. Do not revert.** The columns ship as
`CommitAmount` · `BestCaseAmount` · `PipelineAmount` · `ClosedAmount`.

**Why:** `COMMIT` is a reserved word in **T-SQL *and* PostgreSQL**, and production is PostgreSQL. A bare
`Commit` column would need quoting in every generated view, stored procedure and converted statement for
the life of the app. `Pipeline` separately collides with the name of the `Pipeline` **table**, which
reads as a bug to every future reader. The suffix also says what the numbers *are*, which the bare names
did not.

> **📌 PLAN RECONCILIATION.** Master plan **§9.5** names these four columns
> `Commit` / `BestCase` / `Pipeline` / `Closed`. The shipped schema uses
> `CommitAmount` / `BestCaseAmount` / `PipelineAmount` / `ClosedAmount`. **The shipped names are
> authoritative**; the plan text is the drift. Anyone amending §9.5 should fold this in rather than
> "correcting" the schema back.

---

### D7 — `an-master-plan`: leave on its own branch

**Decision:** the master plan stays on `origin/an-master-plan`. `plans/` remains absent from the
`s0-s1-bootstrap-and-baseline-schema` feature branch. Read it with:

```bash
git show origin/an-master-plan:plans/bizapps-sales-master.md
```

**Why:** it is Amith's doc-only branch with its own path to `next`. Folding it through the bootstrap PR
muddies that PR's scope and risks a double-land when both branches merge.

---

## Implementation decisions taken during S1

Not open questions — calls made while building, recorded because each one is the kind of thing that
looks arbitrary later.

| # | Decision | Why |
|---|---|---|
| I1 | MJ core pinned **`v5.51.0`** (`.env` `MJ_CORE_VERSION`), not 5.50.0 | `@memberjunction/*` actually resolved to 5.51.0. A database behind the packages driving it is the "column does not exist on core metadata" skew. Still satisfies `mj-app.json`'s `mjVersionRange >=5.50.0 <6.0.0`. |
| I2 | `Deal.CurrencyID` and `Deal.CampaignID` are **soft** references (no FK) | Neither `__mj.Currency` nor `__mj.Campaign` exists at MJ 5.51, and orders defers FX entirely (its D24). A hard FK would fail the migration. Columns kept because the plan names them; dropping them would silently decide a still-open question. |
| I3 | `DealTeamMember` uses the explicit two-arm exactly-one-of `CHECK` | T-SQL has no boolean *value* type, so `CHECK ((A IS NULL) <> (B IS NULL))` is a syntax error. The two-arm form is the idiom `common.ContactMethod` and `Relationship` already use, and it converts to PostgreSQL unchanged. |
| I4 | Two separate `UNIQUE` constraints on `DealTeamMember`, not one over both columns | NULL does not collide with NULL in a SQL Server `UNIQUE` constraint, so the single combined form would not enforce what it appears to. |
| I5 | `DealType.RequiresContract = 0` for **Partner-Sourced** | A seed *default*, not a rule — a referral resolving to one one-time order needs no agreement envelope. Documented on the row; flipping it is a metadata edit. |
| I6 | `ForecastCategoryType` **Closed** has all three `Include*` flags `= 0` | Closed business belongs to attainment, and `ForecastSnapshot.ClosedAmount` is its own bucket. Counting it inside "commit" is the classic way a forecast double-reports the quarter. |
| I7 | `DealStatusType` **On Hold** is neither `IsOpen` nor `IsClosed` | Which is exactly why those two flags are not each other's inverse: a roll-up asking "still live" and one asking "not yet concluded" want different answers for a paused deal. |
| I8 | `Deal.DealNumber` is **nullable** | So CodeGen's CRUD procedures can insert before the `DEAL-{seq}` generator exists (S4). Still `UNIQUE`. |
| I9 | `scripts/seed-dev-data.sh` is **not** in `metadata/` | `metadata/` is vocabulary that ships to every environment. A Company / Employee / User is *deployment* data — shipping ours as app metadata would push a fake company into somebody's production database. |
| I10 | The **vocabulary CI grep** was added at S1, before any server logic exists | A rule introduced alongside the code it constrains gets argued with. A rule that was already green when the code arrived simply holds. See `scripts/assert-no-vocabulary-comparisons.mjs`. |

### D-6 (non-employee team members) — as built

Master plan §15.5 flagged this **schema-blocking** and left it unbuilt. Ruled 2026-08-04: build it.

`DealTeamMember` carries a nullable **`PersonID`** beside **`EmployeeID`** with
`CK_DealTeamMember_EmployeeXorPerson` enforcing exactly-one-of. `Employee` stays primary.

**Why:** `Partner Manager` is a seeded `DealRole`, and an `__mj.Employee` row cannot express a partner
rep or a contractor — so this bites on the first partner-sourced deal. The cost is one column and one
structural constraint; retrofitting it after attribution data exists would cost far more.

---

## Related Record Collections — decisions taken during the RRC conversion (2026-08-14)

Converting `Deal` to MJ v6 Related Record Collections retired `DealDraft` and the `Sales.SaveDeal`
remote operation. These are the calls made while doing it. Read
`metadata/entity-relationships/README.md` for the collection shapes themselves.

---

### D-RRC1 — Removal is EXPLICIT. Delete-by-omission was not reimplemented on top

**Decision:** adopt the collection's native semantics. `Remove()` / `Clear()` delete; a child merely
absent from the array **survives**. No reconciliation layer was added to restore the old behaviour.

**Why:** `Sales.SaveDeal` treated a submitted `Lines` array as the complete desired set — a stored line
absent from it was deleted. That is a coherent contract for one caller that always holds the whole tree,
and a hazard for every other caller: an Action that renames a deal, an agent that nudges `NextStep`, or a
header-only form all had to load and re-send the full tree, and forgetting to was **silent data loss**.
Explicit removal inverts the failure mode — the worst case becomes a row that should have gone and did
not, which is visible on the next read rather than gone forever.

**Verified before adopting:** nothing else depended on the old contract. The only consumers were the
operation's own `applyLines` / `applySchedule` and integration check SD6. The seed scripts do not touch
deal children and there are no import fixtures yet.

**Pinned by two checks, deliberately as a pair:** **SD6** proves `Remove()` deletes; **SD13** proves a
header-only save leaves children alone. SD13 is the one guarding the behaviour that actually changed.

---

### D-RRC2 — `DisplayOrder` is now `1, 2, 3`, not `10, 20, 30`

**Decision:** accept the framework's sequencing and update the assertions.

**Why:** `RelatedRecordCollection` sequences as `from + index`; the step is fixed at 1, with no increment
option. The old 10-step was cosmetic — it *looks* like room to insert a row between two others, but the
hand-rolled code re-sequenced the whole collection on every add and remove, so a gap never survived the
next mutation. Ordering comes from `OrderBy` either way, and rows written before this change keep their
old values until the deal is next saved.

---

### D-RRC3 — The form-shaped rules moved ONTO the entity, on both tiers

**Decision:** `DealEntity`, `DealLineEntity` and `DealPaymentScheduleEntity` in `sales-entities` carry
the validation rules. `DealEntityServer` **extends `DealEntity`** rather than the generated class.

**Why:** the rules lived on `DealDraft`, a UI-side model — so an Action, an agent or a second surface
bypassed them entirely. On the entity they run in the browser *and* on the server, on the one path every
write takes. The inheritance detail is load-bearing: extend the generated entity instead and every rule
in that file silently stops applying on the server.

**What did NOT move:** anything needing a database — deal numbering, the company stamp, the owner stamp.
Those stay server-only. And the *pane* an issue belongs to stays in the Angular package
(`deal-workspace.validation.ts`), because an entity should not know a tab exists.

**One accepted limitation:** `RelatedRecordCollection.Validate()` pushes a child's errors only when the
child's own result FAILED, so a warning on an otherwise-valid line never reaches the parent. Per-line
advisories are therefore presentational rather than entity rules. Header warnings are unaffected.

---

### D-RRC4 — Two rules were being enforced ONLY by the retired operation

Found by the integration suite rather than by reading, which is the argument for having had it.

- **`Deal.CompanyID` must equal `Pipeline.CompanyID`.** A CHECK constraint cannot reach across the
  foreign key to compare them, so `Sales.SaveDeal` resolved it. Moved to
  `DealEntityServer.stampCompanyFromPipeline()`, which runs on every save for every caller and
  **overwrites** rather than rejects a supplied value — a client stating this is stating something it has
  no standing to know. **SD2** is the check that caught it.
- **The owner stamp.** `SetOwner` moved to the shared `DealEntity` (the workspace's owner picker must
  express the same intent, and two implementations would disagree about the unique index eventually).
  `DealEntityServer` keeps only the derivation, guarded on `Team.IsLoaded || Team.Count > 0` so a
  header-only save cannot silently clear `OwnerEmployeeID`.

---

### D-RRC5 — `Sales.SaveDeal`'s field whitelist is gone, so the rule it enforced moved ONTO the entity

**Decision:** refuse any caller-originated write to the four pricing-provenance columns in
`DealLineEntity.Validate()`. **This reverses an earlier ruling on this same point**, which proposed
accepting the loss and deferring the fix to S2. The reversal is recorded rather than edited away, because
the reasoning that produced the wrong answer is the part worth not repeating.

**What was lost.** `SaveDealOperation` copied a listed set of fields, and `ResolvedUnitPrice`,
`ResolvedExtendedAmount`, `PriceComponentsJSON` and `PricedAt` were deliberately absent from that list —
so the operation could not be the hole through which locally computed money entered the app. A direct
entity save has no whitelist.

**Why deferring was wrong.** The original argument was that this is only a defence-in-depth loss, since
the generated Deal Lines form already exposed those columns to any Explorer user. That is true and it is
not a reason to defer — it is a reason the fix is *more* valuable, because it closes a door that was
already open. The decisive question is the one that should have been asked first: **is anything
recomputing these columns on save?** Nothing is. No pricing bridge exists yet, so the whitelist was the
only guard on that path, and removing it left forged or stale values with nothing to stop them.

**Why not `AllowUpdateAPI = 0`,** which is the obvious-looking answer: `EntityFieldInfo.IsSPParameter`
excludes such fields from the `spCreate` / `spUpdate` parameter list entirely, so the S2 pricing bridge —
the one caller that MUST write these — would be locked out too and would need raw SQL. Refusing at
validation keeps the column writable by design and closed by rule, and it binds the browser, an Action,
an agent and a raw `BaseEntity.Save()` identically.

**A trap found while building it, worth knowing before writing any similar guard.** A dirty-check alone
is not sufficient. `EntityField`'s setter treats the FIRST write to a never-set field as record setup and
copies the incoming value into `_OldValue` as well as `_Value`, so on a NEW record
`line.ResolvedUnitPrice = 4200` leaves `Dirty` reporting **false**. A guard built on `Dirty` alone passes
every forged value on a create — the case that matters most — while looking correct. The test is
therefore "new with a value, **or** dirty". This was caught by the check failing, not by reading the code.

**Pinned by SD16**, which also asserts the refusal names *which* line, and carries a probe proving
`DealLineEntity` is resolved by the class factory at all — no other check exercises a line-level rule, so
a silently-unregistered subclass would otherwise make the whole file dead code.

**The seam for S2** is `DealLineEntityServer`, which will override the guard to permit writes originating
from a verified `Orders.PreviewOrder` response. Until it exists the rule is absolute, which is correct
rather than a gap.

### D-RRC6 — The remote-operations directory is kept, empty

**Decision:** delete the `Sales.SaveDeal` row and its type files; keep `metadata/remote-operations/` and
its `.mj-sync.json`.

**Why:** `Sales.CloseDeal` and `Sales.ReopenDeal` at S4 are genuine multi-table units of work with policy
evaluation and an audited lock bypass — not a save an entity graph can express. They resolve their
`CategoryID` by `@lookup` against `remote-operation-categories`, which is why that directory still carries
its row and still precedes this one in `directoryOrder`.

The lesson worth keeping: **a remote operation is an atomic unit of work, not a way to reach the
server.** `Sales.SaveDeal` was the latter, and stopped being necessary the moment the entity graph could
cross the wire.

---

## Explorer UX rework (#89) — Phase 1

---

### D-UX1 — The vendored `workspace-tabs` copy is retired, and its "byte-identical" claim was false

**Decision:** delete `packages/Angular/src/lib/vendored/workspace-tabs/` (7 files, 473 TS lines + 2 CSS)
and import the components from **`@memberjunction/ng-ui-components`**, which now ships them.

**Why it was vendored at all**, from the deleted `VENDORED.md`: `mj-workspace-card` is the frame every
workspace screen in this family shares; it lived in bizapps-accounting's Angular package, which sales does
not depend on and must not depend on; and its upstream home was always MJ core — accounting's own source
directory was called `transfer-pending` for exactly that reason. Copying was the smaller wrong answer, on
record rather than by accident. **That intent is now redeemed.**

**Three things had to be checked first, and two of them contradicted the rework plan.**

1. **Is it in the PUBLISHED package, or only in the linked local MJ?** This matters and is easy to get
   wrong: `mj dev workspace` resolves `@memberjunction/ng-ui-components` through a **symlink into the
   local MJ checkout**, while CI installs from the registry with `--frozen-lockfile`. Anything present
   only in local source would build here and break in CI. **Verified by downloading the actual
   `6.1.0-edge.2` tarball** — all five files ship in `dist/lib/workspace-tabs/` and are exported from
   `dist/public-api.d.ts`.

2. **`VENDORED.md` claimed the files were byte-identical to upstream, "load-bearing" so the swap would be
   a deletion plus an import change. THEY ARE NOT.** Measured drift against MJ core:
   `workspace-tab-strip.component.css` 200 changed lines · `workspace-tab-strip.component.ts` 157 ·
   `workspace-card.component.ts` 55 · `workspace-tab-store.ts` 22 · `workspace-tabs.types.ts` 20 ·
   `workspace-tip.directive.ts` 9. Only `workspace-card.component.css` is unchanged.

   **The swap still holds, for a better reason than byte-identity: the BINDING SURFACE is a superset.**
   MJ core's card exposes all 23 `@Input`/`@Output` members the template binds, plus one new optional
   input (`AllowReorder`), and the store has all ten members the component calls. The drift is internal
   implementation and styling — which is the part worth inheriting.

3. **The symbols were RENAMED**, so this was not the pure path swap the plan predicted:
   `WorkspaceCardComponent` → `MJWorkspaceCardComponent`, and likewise `MJWorkspaceTabStore`,
   `MJWorkspaceTab`, `MJTabReorder`, `MJWorkspaceTabState`, `MJWorkspaceTabStripComponent`,
   `MJWorkspaceTipDirective`. **The selector is unchanged** (`mj-workspace-card`), so the template needed
   no edits at all.

**`VENDORED.md` also cited "a decision (D8)" that was never recorded in this repository** — the decision
list here runs D1–D7, D-6 and D-RRC1–6. The citation appears to have been carried over from the source
repo's numbering. This entry is the decision that should have existed.

**Why the correction is recorded rather than simply deleted with the file:** the claim was load-bearing
for planning. It is what made Phase 1 look like a five-minute change, and anyone re-reading an old copy of
`VENDORED.md` or the first draft of the rework plan would believe it again.
