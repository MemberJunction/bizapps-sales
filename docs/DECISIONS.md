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
