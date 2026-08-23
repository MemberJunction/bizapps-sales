# `DealLine.ProductID` — how a deal line acquires a catalog product

**Status:** spec only. No picker built, no schema touched. This feeds the #89 form rework and needs one
decision answered first (§2, and issue #93 already has a position).

**Grounded in:** orders' `__mj_BizAppsOrders.Product` as defined on `origin/next`
(`migrations/V202607061432__v0.1.x__Tables_and_Objects.sql`), and Sales' `DealLine.ProductID` as it
stands today (nullable `uniqueidentifier`, **no FK** — DG-6 / D-PR8).

---

## 0. The gap, restated in one line

Orders requires a real catalog `ProductID` on every order line; Sales deal lines carry a transcribed
`ProductName` with `ProductID` **NULL in every row**. Until something resolves the name to an ID, a won
D2C deal cannot become an order.

---

## 1. How orders identifies a product — what a picker must respect

From the table definition, not from assumption:

| Column | Shape | What it means for selection |
|---|---|---|
| `ID` | `uniqueidentifier` PK | **The stable identity.** This is what `DealLine.ProductID` stores |
| `SKU` | `nvarchar(80)` NULL, **filtered unique** (`WHERE SKU IS NOT NULL`) | The business key humans quote — unique *when present*, so it is a good search term but **not** a safe identifier: a product may have none |
| `Name` | `nvarchar(200)` NOT NULL | The only always-present human label. **Not unique** — never key on it |
| `CompanyID` | `uniqueidentifier` NOT NULL | **Products are per-company.** A picker MUST filter to the deal's company, or a rep can select another tenant's product |
| `Status` | `Draft` / `Active` / `Discontinued` / `EOL` | Only `Active` is normally selectable; the others must be *visible on existing lines* but not offerable |
| `AvailableFrom` / `AvailableTo` | `date`, both nullable | Availability window. A product outside it should not be offered for a deal closing in that window |
| `SuccessorProductID` | self-FK, nullable | The EOL migration path. When a line references an EOL product, the UI should be able to say "superseded by X" |
| `StandaloneSellingPrice` | `decimal(19,4)` NULL | **Display-only for Sales.** Sales must never price from this — the number a deal shows still comes from `Orders.PreviewOrder` |

**Consequences for the picker's query:** filter by `CompanyID` = the deal's company **and**
`Status = 'Active'` **and** the availability window; search on `SKU` and `Name`; store `ID`.

> **Do not resolve by name.** `Name` is not unique and `SKU` is optional. Any "match the transcribed
> text" step is a *suggestion* engine, never an identity mechanism — the rep confirms, the ID is stored.

---

## 2. The decision: real FK, or keep the soft reference

This is the open question. Issue **#93 says FK**; here is the trade honestly stated, because it decides
more than a constraint.

### Option A — real cross-app foreign key (`DealLine.ProductID → __mj_BizAppsOrders.Product.ID`)

**Gains:** referential integrity enforced by the database — no dangling ID, ever; deletes and EOL are
forced to be considered; the relationship becomes visible to CodeGen, so a generated lookup and a join
come for free.

**Costs, and they are structural:**

1. **It ends standalone Sales.** Today `scripts/rebuild-db.sh` builds a working Sales database from MJ
   core + bizapps-common + Sales' own DDL. An FK to `__mj_BizAppsOrders.Product` makes orders' schema a
   **hard prerequisite** — the migration fails without it. Every dev environment, every CI job and the
   test harness would need orders present.
2. **It is a same-database assumption.** A cross-schema FK requires both schemas in one database. That
   holds in the consolidated host (verified this week: Sales and common coexist in `MJ_V6_Host`), but it
   forecloses ever deploying Sales against a separate orders database.
3. **Migration ordering becomes load-bearing.** We already hit the softer version of this: Sales'
   migration failed against a fresh v6 host because its IsA extensions FK into `__mj_BizAppsCommon` and
   common had not been applied yet. The error named neither the schema nor the app. An orders FK adds a
   second such edge.

### Option B — keep the soft reference, validate at the seam

**Gains:** Sales stays installable and testable alone; no migration-ordering edge; deployment topology
stays open.

**Costs:** nothing stops a bad ID at write time. Integrity becomes the resolver's job plus a
reconciliation report.

### Recommendation

**Option B — keep the soft reference — *for the #89 form work*, and treat the FK as a separate decision
tied to consolidation.**

The reasoning is about sequencing rather than principle. The FK's benefit (integrity) is real but
duplicable at the seam; its cost (Sales can no longer stand alone) is paid immediately by every developer
and by CI, and it is paid *before* the consolidated environment that would justify it actually exists.
If and when Sales is only ever deployed inside a host that also has orders, Option A becomes cheap and
should be taken then — the column shape does not change, so **this is a reversible decision in the
direction that matters** (soft → FK is an additive migration; FK → soft is a retreat).

**Flagged as a decision, not a conclusion:** #93 says FK. If the team wants FK now, the work is an
additive migration plus adding orders to Sales' rebuild script and CI — not a redesign of anything in
this document. Queued as **D-SW3**.

---

## 3. How it slots into the #89 form

The picker is a **lookup field on the Product lines pane**, replacing today's free-text
`ProductName` input as the primary control.

**Field behaviour**

- Typeahead over `SKU` and `Name`, scoped by the deal's `CompanyID`, `Status = 'Active'`, and the
  availability window; the deal's `ExpectedCloseDate` is the sensible date to test the window against.
- On select: store `ProductID`, and stamp `ProductName` from the catalog so the line still reads
  correctly if the catalog later changes or is unreachable. **Both columns stay** — the name becomes a
  denormalized label rather than the identity.
- **Free text remains legal.** A rep transcribing an order form before the catalog is settled must still
  be able to type a name and save. That is why the order-readiness warning exists, and it stays: the line
  is valid, just not order-ready.
- Existing lines whose product is `Discontinued`/`EOL` render the product with a marker and, where
  `SuccessorProductID` is set, offer the successor. They are never silently blanked.

**Where the data comes from**

`RunView` against `MJ_BizApps_Orders: Products` with `ResultType: 'entity_object'` — per accounting's
`docs/ui-architecture.md`, and doubly so here: this data feeds a picker whose values are compared and
whose `AvailableFrom`/`AvailableTo` are **dates**, exactly the shape that produced the two v6 bugs fixed
in `7e55bae`.

> **Prerequisite that does not exist yet.** Orders is **not** currently a member of the linked v6
> workspace and its schema is **not** in the host database — only `__mj`, `__mj_BizAppsCommon` and
> `__mj_BizAppsSales` are. Before the picker can query anything, orders must be added as a workspace
> member and its migrations applied to the host. That is host setup, not Sales work, but it gates any
> end-to-end test of this feature.

**Composition fit.** With `RelatedRecordCollection` enabled on Deal → Deal Lines (validated, reverted —
see `EXPLORER-REWORK-DECISIONS.md` D-XR2), a line is `deal.Lines.Create()` and the picker sets
`line.ProductID` directly on the entity. No draft mapping, no operation payload — which is precisely the
simplification #89 is for.

**Order readiness becomes exact.** `LinesMissingCatalogProduct()` already derives from `ProductID IS
NULL`. Once the picker exists, that warning changes meaning from "we cannot resolve this yet" to "someone
skipped the picker" — worth revisiting the wording at that point.

---

## 4. What this spec deliberately does not decide

- **The resolution approach for EXISTING free-text lines** (A/B/C in
  `docs/explorer-ux-rework-plan.md` §8 Q1). This document covers *entry*; back-filling the deals already
  in flight is the same open question, and a bulk "resolve these 40 lines" surface is a different design.
- **Whether `StandaloneSellingPrice` is ever shown.** Displaying a catalog price next to a transcribed
  amount invites someone to reconcile them, and Sales computes no money. Recommend not showing it in v1.
