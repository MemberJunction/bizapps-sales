# BizApps Sales — consolidation notes

What matters when bizapps-sales stops being standalone and shares a database with common, orders,
contracts and accounting. Written for whoever plans that environment.

Everything below is verified against the live `MJ_BizAppsSales` schema, not inferred from the plan.

---

## 1. Schema

Sales owns exactly one schema: **`__mj_BizAppsSales`**. Nothing of its own lives anywhere else, and it
creates no objects in `__mj` or in another app's schema.

19 tables. The ones another app is likely to care about: `Deal`, `DealLine`, `DealTeamMember`,
`DealStageEvent`, `Pipeline`, `PipelineStage`, `SalesAccount`, `SalesContact`, `ForecastSnapshot`, plus
ten vocabulary/type tables.

Declared in `mj-app.json`; the IsA (Table-Per-Type) relationships are declared explicitly in
`codegen-schema-info.json` rather than left to CodeGen's shape auto-detection.

---

## 2. Soft references — the consolidation-relevant part

These columns **point at rows in other apps and have NO foreign key**. They are `uniqueidentifier`
columns that are nullable and unconstrained. That is deliberate: sales must be installable and testable
with no sibling app present, and you cannot FK to a table that may not exist.

| Column | Points at | Today |
|---|---|---|
| `Deal.ContractID` | contracts' agreement | always NULL — `Contracts.CreateFromDeal` does not exist |
| `Deal.RenewsContractID` | the contract being renewed | always NULL |
| `DealLine.ProductID` | **orders' catalog product** | always NULL — see §3, this is the blocking one |
| `Deal.CurrencyID` | a currency row | set by seeds |
| `Deal.CampaignID` | a marketing campaign | unused today |

**Consequence for consolidation: nothing enforces referential integrity across these.** Once the sibling
tables exist in the same database, someone will want to add real FKs. Before doing so, note that
`DealLine.ProductID` is *intentionally* unconstrained for a second reason — sales must never host its own
product catalog, and orders is the source of truth. Adding an FK is a decision about coupling, not a
cleanup.

There is also no validation that a soft reference names a *real* row. A `ProductID` that points at
nothing will be stored happily.

---

## 3. The one hard blocker: product identity

This is the item that will consume the most time, so it is worth stating plainly.

- **Orders requires** a catalog `ProductID` on every order line (`OrderLineInput.ProductID` is a required
  `string`).
- **Sales deal lines carry** a transcribed free-text `ProductName`, with `ProductID` **NULL in every row**
  (verified: 3 of 3 seeded lines).

So a deal line **cannot become a valid order line** until something resolves the name to a catalog ID.
The resolution approach is an open team decision (picker at entry / resolve at close / hybrid — sales
leans hybrid). `feature/deal-line-product-ref` carries the sales-owned half: the column is threaded
end-to-end and the workspace flags a deal that is not order-ready. **No resolver exists.**

Also needed from the orders team: **how the catalog identifies a product** (ID / SKU / name-match).

Related, tracked separately: the seeded D2C `CloseWonPolicy` requests `OrderState: "Draft"`, which
`Orders.CreateOrderInState` explicitly rejects (it accepts `Confirmed`/`Posted`/`Fulfilled`). Either
reseed the policy or route by requested state. See `CLOSE-FLOW-DECISIONS.md` D-CF10.

---

## 4. What sales reads from bizapps-common

Two **IS-A (Table-Per-Type)** relationships, which are the tightest coupling sales has to anything:

| Sales entity | IS-A parent | Meaning |
|---|---|---|
| `SalesAccount` | `MJ_BizApps_Common: Organizations` | the account **is** the organization — same `ID`, real FK on the PK |
| `SalesContact` | `MJ_BizApps_Common: People` | the contact **is** the person — same `ID`, real FK on the PK |

`SalesAccount.ID → __mj_BizAppsCommon.Organization.ID` and `SalesContact.ID → __mj_BizAppsCommon.Person.ID`
are **enforced FKs**. Sales adds CRM attributes (owner, lifecycle stage, territory, tier, ICP fit)
without forking identity — there is no separate "sales customer" record to reconcile, which is the point.

Plus one ordinary FK: `DealTeamMember.PersonID → __mj_BizAppsCommon.Person`.

Addresses are reached **through the account's organization**, not copied — sales has no address column.

> ### ⚠️ The upstream risk that matters most for consolidation
>
> **`AllowMultipleSubtypes` is `false` on common's `Person` and `Organization`.** MJ's IsA defaults to
> *disjoint* — one child type per parent. Sales is currently the **first and only** app extending either,
> so it chains correctly today.
>
> **The moment a second app (ATS, certification, orders' customer model) extends `Person` or
> `Organization` with that flag still false, that app silently mis-chains at runtime** — no error, no
> failed migration, just wrong records. A consolidated environment is exactly the condition that triggers
> this.
>
> The fix belongs in **bizapps-common**, not sales. Full detail and the query to check it:
> `docs/KNOWN-ISSUES.md` KI-1.

## 5. What sales reads from MJ core (`__mj`)

Hard FKs, so these rows must exist and be consistent:

| Sales column(s) | Core table |
|---|---|
| `Deal.CompanyID`, `DealLine.CompanyID`, `Pipeline.CompanyID`, `ForecastSnapshot.CompanyID` | `__mj.Company` |
| `Deal.OwnerEmployeeID`, `DealTeamMember.EmployeeID`, `SalesAccount.OwnerEmployeeID`, `SalesContact.OwnerEmployeeID`, `ForecastSnapshot.OwnerEmployeeID` | `__mj.Employee` |
| `Deal.ClosedByUserID`, `DealStageEvent.ChangedByUserID` | `__mj.User` |

**`Company` is the multi-tenant spine.** `Deal.CompanyID` is resolved server-side from the pipeline and is
never taken from the client — a client that supplies a mismatched company has it overwritten. In a
consolidated environment the company rows must be the shared ones, or by-company rollups will disagree
between apps.

`Pipeline.CompanyID` is `NOT NULL` by decision (D5), so every pipeline belongs to exactly one company.

---

## 6. UUID alignment

**All vocabulary is seeded from `metadata/` with hardcoded UUIDs**, pushed via `mj sync push`, never by a
SQL `INSERT` in a migration. Ten type tables (deal status types, deal types, line types, loss reasons,
forecast categories, lead sources, lifecycle stages, buying roles, account types, deal roles), plus the
application row and the remote-operation rows.

Why this matters for a consolidated environment:

1. **The IDs are stable and intentional.** A deployment can rely on a specific `DealStatusType` ID, and a
   re-seed will not renumber it. Sales' own IDs use a recognisable prefix pattern
   (`D4F8A162-…`), so they are easy to spot and unlikely to collide with another app's hand-picked IDs.
2. **The IsA relationships force ID sharing with common.** `SalesAccount.ID` *is*
   `Organization.ID`. If common's organizations are re-seeded with new UUIDs in a consolidated
   environment, every `SalesAccount` orphans — and because the FK is on the primary key, this shows up as
   a failed migration rather than silent drift. Seed common **before** sales, and never re-mint
   organization/person IDs independently.
3. **CodeGen re-mints entity metadata IDs on every rebuild.** `__mj.Entity` / `EntityField` IDs and the
   generated application row are *not* stable across a `rebuild-db.sh`. Anything outside the DB that
   caches them (a running MJAPI, a running Explorer, a saved dashboard referencing an entity ID) must be
   restarted or re-created afterwards. This is the single most common cause of a "the application doesn't
   exist" dialog.
4. **Behaviour is keyed to flags, never to IDs or names, in application code.** The engine reads
   `DealStatusType.IsWon`, `DealLineType.IsRecurring`, `PipelineStage`→`DealStatusType`, and so on. So a
   consolidated environment may rename or re-rank vocabulary rows freely; what it must **not** do is
   change a flag's meaning. A CI grep (`npm run test:vocabulary-gate`) enforces that no code compares a
   name.

---

## 7. Ports and app registration

- MJAPI **4141**, MJExplorer **4341** — chosen to avoid core (4001/4201), common (4101/4301), accounting
  (4102/4302), orders (4103/4303) and contracts (4151/4351). A consolidated environment serving one API
  makes these moot, but they must not collide while the apps run side by side.
- Sales registers **two** applications: the CodeGen-generated entity browser (`/app/mjbizappssales`) and a
  hand-authored job-shaped app (`/app/sales`, `DefaultSequence` 2020, after accounting's 2010). Both are
  expected; only the second is the product.

## 8. Summary of what sales needs from others

| From | What | Status |
|---|---|---|
| **common** | `AllowMultipleSubtypes = true` on `Person` + `Organization` | **not done — KI-1, the top risk** |
| **common** | the Activity spine (for a deal timeline) | does not exist |
| **orders** | `Subscription.BillingMode`, the pricing-resolver slot (C0) | does not exist |
| **orders** | how the catalog identifies a product | open question |
| **contracts** | `Contracts.CreateFromDeal`, `Contracts.RenewTerm` | do not exist (README-only) |

Sales asks nothing of accounting directly; it reaches the ledger through orders.
