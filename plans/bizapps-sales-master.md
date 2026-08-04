# BizApps Sales — master plan

> **This is the app's source of truth**, kept in-repo alongside the code it governs (the same
> convention `bizapps-orders` follows with `plans/bizapps-orders-master.md`).
>
> **Decisions:** L-1…L-4, L-7, L-8, L-13…L-19, L-21 · **Open:** D-3, D-6
> **Repo:** `MemberJunction/bizapps-sales` · **Schema:** `__mj_BizAppsSales`
> **Status:** Draft. Buildable once the Activity spine and `AllowMultipleSubtypes` land in
> `bizapps-common`.
>
> **Provenance.** Derived from sub-plan 03 of the *Sales & Deal Management* plan set in Blue
> Cypress's internal `new-products` repository, which remains the home of the CROSS-APP strategy
> (positioning, commercial model, the three-app split, the L-1…L-21 decision log). That parent
> document is private and deliberately not mirrored here. **Anything app-specific is now owned by
> this file** — amend it here rather than upstream, and the two will not fight.

---

## 1. What this app is

Deal pipeline management that sits on a real revenue stack. Accounts, contacts, pipelines, deals with
priced lines, deal teams, an activity timeline, forecasting and dashboards, and a close that
**creates things** instead of notifying someone to.

The target user is a sales rep who currently lives in HubSpot. The measure of success is that they do
not miss it.

### Two rules govern everything

> **1. The sales app never computes money.** It records intent — product, quantity, requested
> discount, term — and asks `bizapps-orders`. No pricing arithmetic, no tax logic, no proration, no
> total that was not returned by `Orders.PreviewOrder`. (§6)
>
> **2. Domain vocabulary is data, never a CHECK constraint.** "Closed Won" is one organization's term
> of art. Deal types, outcomes, stages, roles, forecast categories, lead sources and lifecycle stages
> are all **type tables with behaviour flags**. The engine reads the flags; it never compares a
> string literal. (§3)

---

## 2. Repo bootstrap

| | |
|---|---|
| npm scope | `@mj-biz-apps/sales-*` — `sales-entities`, `sales-actions`, `sales-server`, `sales-core-entities-server`, `sales-ng` |
| Schema | `__mj_BizAppsSales` |
| Entity prefix | `MJ_BizApps_Sales:` |
| Ports | MJAPI **4141**, MJExplorer **4341** |
| Dependencies | `mj-bizapps-common`, `mj-bizapps-tasks`, `mj-bizapps-accounting`, `mj-bizapps-orders`, `mj-bizapps-contracts` |
| License | ISC / open source (L-7, L-8) |

---

## 3. Type tables — the configuration layer

**L-13: every piece of domain vocabulary in this app is a type table**, following the house pattern
already proven by `ProductType`, `SubscriptionType`, `ContractType` and `ActivityType`. Each carries
the **behaviour flags the engine actually branches on**, so an organization can rename, add or
reorder its vocabulary without a migration and without a code change.

CHECK constraints survive only for **structural invariants** — exactly-one-of foreign keys, date
ordering, non-negative quantities. Never for domain vocabulary.

| Type table | Behaviour flags the engine reads | Seeded with |
|---|---|---|
| **`DealStatusType`** | `IsOpen` · `IsClosed` · `IsWon` · `IsLost` · `LocksDeal` | Open, Won, Lost, Abandoned, On Hold |
| **`DealType`** | `RequiresContract` · `RequiresRenewalSource` · `DefaultPipelineID` | New Business, Renewal, Expansion, Cross-Sell, Partner-Sourced |
| **`DealRole`** | `IsOwnerRole` · `AllowsMultiplePerDeal` · `DefaultAttributionPct` · `IsQuotaCarrying` | Owner / AE, Sales Engineer, SDR, Executive Sponsor, Partner Manager, CS Lead |
| **`ForecastCategoryType`** | `IncludeInCommit` · `IncludeInBestCase` · `IncludeInPipeline` · `DisplayRank` | Omitted, Pipeline, Best Case, Commit, Closed |
| **`LossReason`** | `Category` · `RequiresNotes` · `IsCompetitive` | Price, Product Gap, Competitor, Timing, No Decision, Internal |
| **`LeadSourceType`** | `IsInbound` · `IsPaid` · `AttributionWindowDays` | Referral, Website, Event, Outbound, Partner, Existing Customer |
| **`LifecycleStageType`** | `IsMarketingQualified` · `IsSalesQualified` · `IsCustomer` · `DisplayRank` | Subscriber, Lead, MQL, SQL, Opportunity, Customer, Evangelist, Disqualified |
| **`BuyingRoleType`** | `IsDecisionMaker` · `IsBlocker` · `InfluenceWeight` | Champion, Economic Buyer, Technical Buyer, Influencer, Blocker, End User |
| **`AccountType`** | `IsCustomer` · `IsProspect` · `IsPartner` | Prospect, Customer, Partner, Former Customer |

All seeded via `metadata/<type>/` with hardcoded UUIDs, following the `bizapps-common`
`address-types` pattern. **Never** SQL `INSERT`s in a migration.

**The rule that makes this real:** no server file may contain `Status === 'Won'` or
`Stage.Name === 'Closed Won'`. It reads `DealStatusType.IsWon`. This is enforceable with a grep in
CI and worth adding, because the shortcut is tempting exactly once and permanent thereafter.

---

## 4. Data model

### 4.1 Identity — IsA extensions, not new tables

Per L-3 and Caliber's DG-8 pattern. Both are **IsA children** sharing the parent's UUID.

> **Depends on the `bizapps-common` Activity spine plan §4:** `common.Person` and `common.Organization` must
> carry `AllowMultipleSubtypes = true` before these ship. MJ's IsA defaults to *disjoint* — one child
> type per parent record — so without the flag, whichever app extends `Person` first claims the only
> slot and the second gets wrong auto-chaining, silently. Sales, ATS and certification all extend
> `Person`; the same human is routinely a sales contact, an applicant and a member.

**`SalesAccount`** IsA `common.Organization`
`OwnerEmployeeID` · `AccountTypeID` · `LifecycleStageTypeID` · `Territory` · `Tier` · `ICPFitScore` ·
`IndustryCode` · `EmployeeCountBand` · `AnnualRevenueBand` · `LeadSourceTypeID` · `HealthStatus` ·
`FirstClosedWonDate` · `IsActive`.

**`SalesContact`** IsA `common.Person`
`OwnerEmployeeID` · `LifecycleStageTypeID` · `BuyingRoleTypeID` · `Seniority` · `LeadSourceTypeID` ·
`OptedOutOfOutreach` · `DoNotContactReason` · `LastEngagedAt`.

**No `Lead` table** (L-3). A lead is a `common.Person` at a lifecycle stage. MJ already ships
duplicate detection (`MJ: Duplicate Runs`) and record merge for the messy inbound case; a second
identity table for humans fights the Person graph and buys nothing.

`AnnualRevenueBand` / `EmployeeCountBand` are deliberately **bands, not numbers** — a rep's guess
stored as `$4,750,000` is false precision that later gets treated as fact.

### 4.2 Pipelines — owned by a company

**L-14: a pipeline belongs to a company; a company may have any number of pipelines; a pipeline may
have any number of deals.**

**`Pipeline`** — `CompanyID` (**NOT NULL**, → MJ `Company`) · `Name` · `Code` · `Description` ·
`DealTypeID` (default deal type for deals created here) · `IsDefault` (per company) · `IsActive` ·
`DisplayRank` · **`CloseWonPolicy`** (JSON, §7) · `DefaultForecastCategoryTypeID` ·
`RequiresDealLines` (§6, simple vs. priced mode as a pipeline-level default).

`CompanyID` being required is what makes every rollup in §9 sliceable by company for free, and it
matches how BC actually sells — several operating companies, each with its own motions. `Code` is
unique **per company**, not globally.

**`PipelineStage`** — `PipelineID` · `Name` · `Code` · `DisplayOrder` · `Probability` ·
`ForecastCategoryTypeID` · **`DealStatusTypeID`** (the status a deal takes on entering this stage) ·
`RottingDays` · **`EntryCriteria`** / **`ExitCriteria`** (declarative JSON predicates) ·
`RequiredFields` (JSON) · `GuidanceMarkdown`.

Stages carry no `IsWon`/`IsClosed` of their own — they point at a `DealStatusType` that does. That is
what makes "Closed Won" a label rather than a behaviour, and lets a pipeline call its winning stage
"Signed", "Booked" or "Enrolled" with no code aware of the difference.

Exit criteria are **declarative predicates evaluated server-side** — the same posture Sonar takes
with factors and Caliber with `WorkflowRoute` conditions. A stage that cannot be left without a
signed mutual action plan is a config row, not a code branch.

`GuidanceMarkdown` is the "what good looks like at this stage" text shown in the deal workspace. It
is the cheapest sales-enablement feature in existence and every CRM makes it an add-on.

### 4.3 The deal

**`Deal`** (`DealHeader` in spirit — L-2)

`DealNumber` (`DEAL-{seq}`) · `Name` · `PipelineID` · `PipelineStageID` · `DealTypeID` ·
**`DealStatusTypeID`** · `AccountID` · `PrimaryContactID` · **`CompanyID`** (selling company, D-4;
must match `Pipeline.CompanyID`) · **`OwnerEmployeeID`** (denormalized — see §5) · `Amount` ·
`AmountIsComputed` · `AmountComputedAt` · `AmountSourceHash` · `CurrencyID` · `MRR` · `ARR` ·
`TermMonths` · `ExpectedCloseDate` · `ActualCloseDate` · `Probability` ·
`ForecastCategoryTypeID` · `LossReasonID` · `LossNotes` · `LeadSourceTypeID` · `CampaignID` ·
**`ContractID`** (→ contracts, nullable) · **`RenewsContractID`** (→ contracts, nullable) ·
`Description` · `NextStep` · `NextStepDate` · `ClosedAt` · `ClosedByUserID`.

The three `Amount*` provenance columns are load-bearing. `Amount` is a **cached answer**;
`AmountSourceHash` fingerprints the `DealLine` set it was computed from, so the UI can say *"this
figure is stale, reprice"* instead of showing a number nobody can trace. Without them, `Amount`
becomes a hand-edited field within a month and the guarantee in §6 quietly dies.

**`DealLine`**
`DealID` · `ProductID` (→ orders catalog) · `Quantity` · `RequestedDiscountPct` ·
`OverrideUnitPrice` (nullable) · `TermMonths` · `ServicePeriodStart` / `End` · `LineType` ·
`DisplayOrder` · `Description` · **`ResolvedUnitPrice`** · **`ResolvedExtendedAmount`** ·
**`PriceComponentsJSON`** · `PricedAt` · `CompanyID` (denormalized stamp of the product's company).

The four resolved columns are **write-only from the sales app's perspective** — populated *only* from
an `Orders.PreviewOrder` response, never computed locally, never hand-edited.
`PriceComponentsJSON` stores the explanation trail orders returns, so a rep can answer "why is it
this price" without a support ticket.

**`DealStageEvent`** — immutable transition log: `DealID` · `FromStageID` · `ToStageID` ·
`FromDealStatusTypeID` · `ToDealStatusTypeID` · `ChangedByUserID` · `ChangedAt` ·
`DaysInPreviousStage` · `AmountAtTransition` · `ProbabilityAtTransition` · `Notes`.

Append-only, never edited. This single table is where stage-conversion rates, velocity, slippage and
"deals that skipped qualification" all come from. Stamping the amount at each transition is what lets
historical roll-ups reconstruct correctly after the deal's amount changes.

**`DealContactRole`** — `DealID` · `SalesContactID` · `BuyingRoleTypeID` · `Influence` · `Notes`.
The buying committee on the **customer** side. One contact can hold different roles on different
deals, which is why this is a junction rather than a field on the contact.

### 4.4 Deal outcome linkage — and its cardinality

`Deal.ContractID` points **down** the dependency graph to contracts. There is deliberately no
`Contract.DealID`, for two independent reasons — **L-15**:

1. **Direction.** Contracts sits below sales; a reference upward inverts the app graph (the same rule
   that removed `Order.ContractID` from orders, D44).
2. **Cardinality.** It is **one contract to many deals**. The original sale is a deal; every renewal
   is another deal; expansions and cross-sells are more. The contract persists across all of them.
   A single `Contract.DealID` could only ever name one of them, and would silently become "whichever
   deal we happened to write last."

`RenewsContractID` is what makes the renewal chain navigable from the sales side without contracts
knowing anything about it.

---

## 5. The deal team

**L-16.** Deals carry multiple internal people in different roles. Reps are MJ **`Employee`** records
(`__mj.Employee`, which already carries `CompanyID` and a supervisor chain, and which
`__mj.User.EmployeeID` links to for "who am I").

**`DealTeamMember`** — `DealID` · **`EmployeeID`** (→ `__mj.Employee`) · **`DealRoleID`** ·
`AttributionPct` (nullable) · `StartDate` / `EndDate` · `IsActive` · `Notes`.
Unique on `(DealID, EmployeeID, DealRoleID)`.

`DealRole.AllowsMultiplePerDeal` governs whether two people may hold the same role on one deal — two
sales engineers, yes; two owners, no. Enforced server-side from the flag, not hardcoded.

### 5.1 Owner is a team member, not a parallel truth

`DealTeamMember` is the **single source of truth** for who is on a deal, including the owner (the
member holding a role where `DealRole.IsOwnerRole = 1`; exactly one per deal, enforced).

`Deal.OwnerEmployeeID` is a **server-maintained denormalized stamp**, written by the entity-server
`Save()` override whenever team membership changes. It exists purely so that filtering and rollups
("my deals", "the board for this rep") do not require a join on every query.

This mirrors `OrderLine.CompanyID` in orders — a denormalized copy of a value owned elsewhere,
maintained by server code, never hand-set. **Document it in the extended property**, or someone will
eventually set it directly and the two will diverge.

### 5.2 Attribution — the trap worth naming now

A deal with an AE, an SE and an SDR has three `DealTeamMember` rows. **Summing `Deal.Amount` across
that table triple-counts the deal.** Every rollup in §9 must do one of:

- **filter to a single role** (the default for "bookings by rep" — the owner role); or
- **weight by `AttributionPct`**, where the app validates that percentages across a deal's active
  members sum to 100 when any are set.

Report definitions state which they use. A total that silently exceeds real bookings is worse than no
total, and this is the shape that produces it.

---

## 6. Pricing — the whole mechanism

```
DealLine[]  ──map──▶  HydratableLine[]  ──▶  Orders.PreviewOrder  ──▶  priced result
                                                                          │
                                       ┌──────────────────────────────────┤
                                       ▼                                  ▼
                        DealLine.Resolved* + PriceComponentsJSON     Deal.Amount
                                                                   + AmountSourceHash
```

On close, **the same draft** goes to `Orders.CreateOrderInState`. The quote and the invoice cannot
disagree, because they are the same computation run twice.

**What sales must never do:** multiply quantity by price · apply a discount percentage · compute
tax · prorate a partial period · sum lines into a header total · round anything.

**Enforcement, not documentation.** An integration check asserts that for any deal with lines,
`Deal.Amount` equals the `Orders.PreviewOrder` result for the same draft. This failure mode arrives
by accretion — "just this one rounding case" — so it needs a test that fails, not a paragraph that
asks nicely.

**Simple deals** (L-2) skip all of this: header only, `Amount` entered by hand,
`AmountIsComputed = 0`, no lines, no catalog. `Pipeline.RequiresDealLines` sets the default per
pipeline — partner-referral and sponsorship pipelines may never carry catalog lines — overridable per
deal. Two clean modes, not a spectrum.

**Approvals:** a requested discount beyond the rep's `SalesAuthority` (orders) raises an Approval
Request Task in `bizapps-tasks` routed to the approver role, with `TaskType` `OnComplete` /
`OnReject` hooks calling back into sales.

---

## 7. Closing a deal

### 7.1 The policy

`Pipeline.CloseWonPolicy` declares the default outcome; a deal may override it; **one remote
operation executes it.**

```jsonc
{
  "CreateContract": true,
  "ContractTypeCode": "Standard",
  "TermMonths": 12,
  "SubscriptionLinesTo": "Contract",   // Contract | Subscription | None
  "OneTimeLinesTo": "Order",           // Order | Contract | None
  "OrderState": "Confirmed",           // Draft | Confirmed
  "RequireApprovalTaskTypeCode": null
}
```

### 7.2 `Sales.CloseDeal(DealID, DealStatusTypeID, overrides?)`

Named for the **outcome type**, not for a hardcoded "won" — the operation resolves behaviour from
`DealStatusType` flags. One transaction:

1. Validate the stage's exit criteria and required fields; refuse with a message naming what is
   missing.
2. If the target status has `IsLost` — require `LossReasonID` (and notes when the reason demands
   them), write the stage event, lock, done.
3. If `IsWon` — resolve the effective policy (deal override → pipeline default).
4. If `CreateContract` — call `Contracts.CreateFromDeal`; stamp `Deal.ContractID`. For a deal whose
   `DealType.RequiresRenewalSource` is set, call `Contracts.RenewTerm` against `RenewsContractID`
   instead.
5. Route lines per policy — subscription lines become contract lines (materializing subscriptions
   with `BillingMode='External'`); one-time lines become an order via `Orders.CreateOrderInState`.
6. Move to the closing stage, write `DealStageEvent`, write an `Activity`, set `ActualCloseDate` /
   `ClosedAt` / `ClosedByUserID`, apply the lock (§7.3).

All-or-none. A partial close — contract created, order missing — is the exact failure the transaction
exists to prevent.

A deal can legitimately need **both** a contract (subscription products) and a standalone order (a
services SOW billed once); the policy expresses that rather than forcing a choice.

**Loss reason is the app's only mandatory field**, and it is worth the friction: loss reasons are the
highest-value, most consistently-skipped data in any CRM.

### 7.3 Locked on close — **L-17**

When a deal enters a status where `DealStatusType.LocksDeal = 1`, the deal and its lines become
**immutable**, enforced in the server-side `DealEntityServer.Save()` override. This mirrors orders'
journal-entry immutability after `Batched`/`GLPosted` and exists for the same reason: the deal is now
the provenance of a contract and an order, and editing it retroactively falsifies both.

| After lock | |
|---|---|
| Header fields | Frozen, except `Description` and `NextStep` (annotation only, no financial meaning) |
| `DealLine` rows | Frozen — no insert, update or delete |
| `DealTeamMember` | Frozen (attribution is now historical fact) |
| `Activity` links | Still allowed — post-close conversations are real and belong on the timeline |
| Reopening | Only via `Sales.ReopenDeal(DealID, reason)`, which writes a `DealStageEvent`, records the reason, and is gated by an approval task when the pipeline requires it |

The lock is **not** a UI concern. Enforce it in the entity server so an Action, an agent or a direct
`BaseEntity.Save()` hits the same wall.

---

## 8. UI

Built on MJ's existing Angular Generic components — `kanban`, `timeline`, `filter-builder`,
`entity-card`, `join-grid`, `record-merge`, `entity-communication`, the page-chrome trio — plus the
Activity widgets from the `bizapps-common` Activity spine plan.

| Surface | Contents |
|---|---|
| **Pipeline board** (rep) | `kanban` over `PipelineStage`, drag-to-advance with exit-criteria validation on drop, rotting indicators, inline amount + close date, saved views via `filter-builder`, pipeline switcher scoped to the user's company |
| **Deal workspace** (rep) | Header with provenance-aware amount · line editor with live reprice · **deal team panel** (add member + role) · buying committee · activity timeline + composer · next step · stage guidance · tasks · files · read-only banner once locked |
| **Account / contact 360** | Common's Person/Org forms with the activity timeline embedded, plus open deals, contracts, orders, subscriptions |
| **Dashboards** (manager / exec) | §9 |
| **Pipeline studio** (ops) | Pipeline/stage authoring per company, probabilities, exit criteria, close policy, and the type-table editors (deal types, roles, loss reasons, forecast categories) |

Rules that apply: standalone components with `inject()` · `@if`/`@for` · PascalCase public members ·
`<mj-loading>` only · **semantic `--mj-*` tokens, no hardcoded colors** · confirm-LEFT / cancel-RIGHT
· Font Awesome · every `BaseResourceComponent` subclass calls `NotifyLoadComplete()`.

---

## 9. Dashboards and roll-ups

The analytics requirement is explicit: slice performance by **company, pipeline, time period, rep,
role — and whatever else.** That is a dimensional problem, so the model is stated as dimensions and
measures rather than as a fixed list of screens.

### 9.1 Grains

| Grain | Table | Answers |
|---|---|---|
| Deal | `Deal` | current pipeline, weighted forecast, win rate, average deal size |
| Transition | `DealStageEvent` | velocity, stage conversion, dwell time, slippage, skipped stages |
| Team membership | `DealTeamMember` | per-rep and per-role performance, coverage, involvement |
| Line | `DealLine` | product mix, attach rate, discount depth |

### 9.2 Dimensions

**Company** (`Deal.CompanyID`, guaranteed present because `Pipeline.CompanyID` is required) ·
**Pipeline** and **Stage** · **Time** (expected close, actual close, transition date, created —
each answers a different question and reports must say which they use) · **Employee** and
**DealRole** (via `DealTeamMember`) · **DealType** · **DealStatusType** · **ForecastCategoryType** ·
**LeadSourceType** · **Account** (territory, tier, industry, account type) · **Product** and
**Product Category** (via `DealLine` → orders catalog).

### 9.3 Measures

Open pipeline · weighted pipeline (`Amount × Probability`) · forecast by category (`IncludeInCommit`
/ `IncludeInBestCase` flags, never a string comparison) · bookings (closed-won amount) · win rate by
count and by value · average cycle time · stage conversion and dwell · slippage (deals whose expected
close moved) · pipeline coverage vs. quota (v2, D-3) · new vs. renewal vs. expansion mix (via
`DealType`) · discount depth (via `DealLine`).

### 9.4 Two things that will be wrong if not designed in

- **Attribution double-count** (§5.2). Every by-rep or by-role rollup declares whether it filters to
  the owner role or weights by `AttributionPct`. There is no safe default that works for both
  "bookings by AE" and "deals I was involved in."
- **Point-in-time vs. current state.** "What is the forecast" and "what did we think the forecast was
  on the 1st" are different queries. The first reads `Deal`; the second reads `ForecastSnapshot`
  (§4.5 below). Reconstructing history from `Deal` alone is impossible once amounts and dates change,
  which is why `DealStageEvent` stamps `AmountAtTransition`.

### 9.5 Implementation

Read models as **MJ Queries** (parameterized, permissioned) feeding an MJ Dashboard, rather than
hand-rolled Angular aggregation — so Skip, the query builder and report snapshots all get them for
free. Heavy rollups become database views registered as MJ entities where the query cost justifies it.

**`ForecastSnapshot`** — `CompanyID` · `PipelineID` · `OwnerEmployeeID` · `PeriodStart` / `PeriodEnd`
· `CapturedAt` · `Commit` · `BestCase` · `Pipeline` · `Closed` · `SnapshotJSON`. Written by a
Scheduled Job. Snapshots matter more than the live number: "what did we think on the first of the
month" is the question a forecast review actually asks, and it is unanswerable after the fact without
them.

**`Quota`** *(D-3 — v2 unless overruled)* — `EmployeeID` · `CompanyID` · `PeriodStart` / `PeriodEnd`
· `Amount` · `QuotaType` · `DealRoleID` (nullable — quota may be role-scoped).

---

## 10. Multi-company *(D-4)*

Mirrors orders' D6/D7 exactly, so nothing has to be re-derived:

| | Sales | Orders (the model being mirrored) |
|---|---|---|
| Attribution / ownership anchor | `Deal.CompanyID` (= `Pipeline.CompanyID`) | `Order.CompanyID` |
| Revenue ownership | `DealLine` inherits `Product.CompanyID` | `Product.CompanyID` (NOT NULL, source of truth) |
| Denormalized stamp | `DealLine.CompanyID` at price time | `OrderLine.CompanyID` at save |

A cross-company deal therefore materializes into orders with correct per-line company ownership, and
each line books its own single-company journal entry (orders D10) with no extra work here.

---

## 11. Lateral integrations

| App | Wiring | Phase |
|---|---|---|
| **MJ Communication** | Inbound (Graph / SendGrid Inbound Parse) and outbound email → `CommunicationLog` → `Activity` rows linked to contact, account and open deals. The timeline populates itself. | 1 |
| **bizapps-tasks** | Approval gates; follow-up tasks from the deal workspace; reopen approvals. | 1 |
| **bizapps-forms** | On-submit Action: match-or-create `Person` → ensure `SalesContact` → write `Activity` → create or route a `Deal`. Forms already ships anonymous magic-link distributions and on-submit Actions; no new plumbing. | 2 |
| **bizapps-sonar** | Anchor a model on `Deal` (health, slip risk) or `SalesAccount` (engagement, expansion propensity). Factors read the Activity spine. Bands drive next-best-action. | 2 |
| **bizapps-caliber** | `SubjectEntityName='MJ_BizApps_Sales: Deals'` — **no schema change** (Caliber DG-5). AI-run discovery/qualification with prospects; rep coaching and roleplay against a rubric. Caliber's `ContextProvider` roster already names a `CRMProvider`. | 2 |
| **MJ Agents** | Deal-desk agent (hygiene, stalled deals, missing next steps) · forecast-review agent · outbound sequences. | 3 |

---

## 12. HubSpot migration

A named workstream, not an afterthought.

| HubSpot | Target |
|---|---|
| Company | `common.Organization` + `SalesAccount` |
| Contact | `common.Person` + `SalesContact` (lifecycle stage maps to `LifecycleStageType`) |
| Deal | `Deal` (+ `DealLine` where line items exist) |
| Deal stage history | `DealStageEvent` — **preserve original timestamps**, do not stamp import time |
| Deal owner + collaborators | `DealTeamMember` rows against MJ `Employee`, roles mapped to `DealRole` |
| Engagements (emails, calls, meetings, notes) | `Activity` + `ActivityLink`, `ActivityDate` = the original date |
| Pipelines and stages | `Pipeline` (assigned to the correct MJ `Company`) + `PipelineStage`, with `DealStatusType` mapped from HubSpot's closed-won/closed-lost flags |
| Line items / products | Map to the orders catalog; unmatched products need a decision, not a silent skip |
| Custom properties | Case by case: promote to `SalesAccount` / `SalesContact` extension columns, or drop with a written list of what was dropped |

**Non-negotiables:** `ActivityDate` and `DealStageEvent.ChangedAt` carry original timestamps — this is
precisely why `ActivityDate` is not `__mj_CreatedAt` (the `bizapps-common` Activity spine plan §3.2). Run the
import twice against a scratch DB and diff; the `UQ_Activity_Source` index makes a re-run safe and
proves idempotency. **Import must bypass the close lock** (§7.3) — historical closed deals arrive
already closed, so the importer needs an explicit, audited path rather than a disabled rule.

---

## 13. Build sequence

| Phase | Work |
|---|---|
| **S0** | Repo bootstrap, `mj-app.json`, ports, CI |
| **S1** | Baseline migration + CodeGen: **type tables first**, then identity extensions, pipelines/stages, deal + lines + team + stage events |
| **S2** | The pricing bridge — `DealLine` ↔ `Orders.PreviewOrder`, provenance stamping, the integration check from §6 |
| **S3** | Pipeline board + deal workspace + deal team + activity timeline (the rep's day) |
| **S4** | `Sales.CloseDeal` + policy evaluation + the close lock + `Contracts.CreateFromDeal` / `RenewTerm` wiring |
| **S5** | Dashboards: MJ Queries for the §9 measures, forecast snapshots, stage-conversion and velocity |
| **S6** | HubSpot import + reconciliation report |
| **S7** | **Cutover.** Run parallel for one full sales cycle before turning HubSpot off |
| **S8** | v2: sequences, Forms capture, Sonar scoring, Caliber discovery, quota/attainment |

---

## 14. Definition of done for v1 ("get off HubSpot")

- [ ] A rep can run their entire day without HubSpot: board, deal, log activity, advance stage, close.
- [ ] No server file compares a status or stage **name** — behaviour comes from type-table flags, with
      a CI grep proving it.
- [ ] `Deal.Amount` for any lined deal provably equals `Orders.PreviewOrder` for the same draft — with
      a test that fails if it does not.
- [ ] Closing creates the contract and/or orders in one transaction, or fails cleanly naming the blocker.
- [ ] A closed deal is immutable at the **entity-server** level — proven by a test that attempts a
      direct `BaseEntity.Save()` and is refused.
- [ ] Stage transitions logged immutably with amount and probability at transition.
- [ ] A deal carries multiple team members in distinct roles; by-rep rollups do not double-count.
- [ ] Dashboards slice by company, pipeline, period, rep and role.
- [ ] The activity timeline shows email, calls, meetings, notes and tasks on contact, account **and**
      deal.
- [ ] HubSpot import completes with original timestamps preserved and a written reconciliation report.
- [ ] Design-token gate passes; verified in dark mode.
- [ ] Package tests pass; counts reported. PG conversion CI-green.

---

## 15. Open questions

1. **D-3** — quota/attainment in v1 or v2. *Recommendation: v2.* Forecast roll-up without quota is
   still useful; quota without a full period model is a half-feature.
2. **Territory** — a label on `SalesAccount` (assumed) or a routing engine? *Recommendation: a label.*
   Routing is a product in its own right and is on the not-doing list in
   the cross-app plan's explicit not-doing list (internal).
3. **Default attribution** — when no `AttributionPct` is set, do by-rep rollups default to the owner
   role, or to equal split across active members? *Recommendation: owner role*, because it is the only
   default that reconciles to total bookings.
4. **Cross-company pipelines** — `Pipeline.CompanyID` is required, so a deal spanning two operating
   companies lives in one company's pipeline while carrying lines owned by both. Confirm that is the
   intended shape (it matches orders' `Order.CompanyID` semantics exactly).
5. **D-6 — non-employee team members.** `DealTeamMember.EmployeeID` cannot express a partner rep or a
   contractor, and `Partner Manager` is in the seeded `DealRole` list, so this bites on the first
   partner-sourced deal. *Recommendation: add a nullable `PersonID` beside `EmployeeID` with an
   exactly-one-of `CHECK`* — the idiom `common.ContactMethod` and `Relationship` already use for
   Person-xor-Organization. Keeps `Employee` primary and costs one column. **Not built until
   confirmed.**
