<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp">
    <img alt="MemberJunction" src="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp" width="220">
  </picture>
</p>

<h1 align="center">BizApps Sales</h1>

<p align="center">
  <strong>Deal pipeline management that sits on a real revenue stack — so closing a deal <em>creates the contract, the subscriptions and the orders</em>, for the <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> platform</strong>
</p>

<p align="center">
  <a href="#what-this-is--and-is-not">What this is</a> &middot;
  <a href="#two-rules-govern-everything">The two rules</a> &middot;
  <a href="#what-you-get">What you get</a> &middot;
  <a href="#closing-a-deal">Closing a deal</a> &middot;
  <a href="#entity-model">Entity model</a> &middot;
  <a href="#build-sequence">Build sequence</a>
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/Status-Bootstrap%20%2F%20no%20schema%20yet-red?style=flat-square" />
  <img alt="MJ Version" src="https://img.shields.io/badge/MemberJunction-5.50%2B-blue?style=flat-square" />
  <img alt="Angular" src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="SQL Server" src="https://img.shields.io/badge/SQL%20Server-2019%2B-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-ISC-green?style=flat-square" />
</p>

---

> **🚧 Status: repo bootstrap. Nothing is built yet.**
>
> There is no schema, no migration, no package code. **This README is the specification we are
> building to, not a description of what exists.** Every table, operation and behaviour below is a
> commitment, not a claim. The design is settled — see
> [`sales-deal-management/plans/03-bizapps-sales.md`](https://github.com/BlueCypress/new-products/blob/main/sales-deal-management/plans/03-bizapps-sales.md)
> and its [parent plan](https://github.com/BlueCypress/new-products/blob/main/sales-deal-management/plan.md)
> (decisions **L-1…L-4**, **L-7**, **L-8**, **L-13…L-19**, **L-21**).

CRM is the most crowded software category on earth, and this is not an entry into it.

Every CRM stops at "Closed Won." The agreement, the billing schedule, the subscriptions and the
revenue recognition all get **re-keyed by hand** into whatever runs the money. That re-keying is the
product gap — and we already own everything on the far side of it.

BizApps Sales makes **Closed Won a transaction**: one server call that creates the contract,
parameterizes the subscriptions and materializes the orders, priced by **the same engine that will
later invoice them**. Not pipeline management. The *lifecycle* — pipeline through agreement through
billing through recognition — on one schema, with one Person graph, one catalog, one pricing engine.

---

## Two rules govern everything

> ### 1. The sales app never computes money.
>
> It records **intent** — product, quantity, requested discount, override price, term — and asks
> [`bizapps-orders`](https://github.com/MemberJunction/bizapps-orders). No pricing arithmetic, no tax
> logic, no proration, no total that was not returned by `Orders.PreviewOrder`.
>
> **This is not a rule against overriding prices.** Overriding is expected, and it is
> [modelled in full below](#overriding-a-price-is-an-input-not-an-exception). The rule is against
> *computing* — see the distinction, because misreading it in either direction causes real damage.
>
> ### 2. Domain vocabulary is data, never a `CHECK` constraint.
>
> "Closed Won" is one organization's term of art. Deal types, statuses, roles, forecast categories,
> loss reasons, lead sources and lifecycle stages are all **type tables carrying the behaviour flags
> the engine branches on**. The engine reads `DealStatusType.IsWon`. It never compares a string.

| ✅ Sales may absolutely | ❌ Sales must never |
|---|---|
| Set `OverrideUnitPrice` on a line | Multiply quantity by price |
| Request a discount (`RequestedDiscountPct`) | **Apply** a discount percentage |
| Name a term, a service period, a quantity | Prorate a partial period |
| Choose a `PriceListID` | Compute tax |
| Display any number orders returned | Sum lines into a header total, or round anything |

Both rules fail the same way — **by accretion.** "Just this one rounding case." "Just this one
`Status === 'Won'`." So both are enforced by tests that fail, not paragraphs that ask nicely:

- an integration check asserts `Deal.Amount` equals the `Orders.PreviewOrder` result for the same
  draft;
- a **CI grep** proves no server file compares a status or stage *name*.

---

## What This Is — and Is Not

| ✅ This is | ❌ This is not |
|---|---|
| Accounts, contacts, pipelines, deals with **priced** lines, deal teams, forecasting | A pricing engine — every number comes from `Orders.PreviewOrder` |
| **Closed Won as one transaction** — contract + subscriptions + orders, all-or-none | A handoff that emails someone a PDF |
| A **unified activity timeline** — email, calls, meetings, notes, tasks | Marketing automation / campaign builders (that is rasa) |
| Multi-company native — a cross-company deal books correctly for free | Support ticketing or case management (`bizapps-issues`, `bizapps-ethics`) |
| Dashboards sliced by company, pipeline, period, rep, role and product mix | E-signature (integrate DocuSign / Dropbox Sign) or telephony (capture the *activity*) |
| Quota and attainment *(v2)* | Commission and comp-plan calculation — payroll/accounting territory |
| A `Territory` **label** on accounts | A territory routing engine — a product in its own right |
| An **Open App** installed into an adopter's own MJ instance | A hosted multi-tenant CRM SaaS |

The target user is a sales rep who currently lives in HubSpot. **The measure of success is that they
do not miss it.**

---

## Dependency position

Sales sits at the **top** of the BizApps stack, so every reference it makes points *down* the graph
and every foreign key is legal — no polymorphic gymnastics required for the core model.

```
__mj                     Company, User, Employee, Communication, Conversations,
   ↑                     Files, Lists, Tags, Actions, Agents, Scheduled Jobs
bizapps-common           Person, Organization, Address, ContactMethod
   ↑                     >> Activity, ActivityType, ActivityLink  (the timeline spine)
bizapps-tasks            Task primitives; approval gates; TaskType Action hooks
   ↑
bizapps-accounting       GL roles/links, JournalEntry primitives
   ↑
bizapps-orders           Catalog, ResolvePrice, promotions, charges, tax,
   ↑                     Order-as-A/R, Subscriptions, SalesRule / SalesAuthority
bizapps-contracts        Agreement envelope; the billing event
   ↑
bizapps-sales       ◄── you are here

     lateral, optional: bizapps-forms · bizapps-caliber · bizapps-sonar
```

| | |
|---|---|
| **Schema** | `__mj_BizAppsSales` |
| **Entity prefix** | `MJ_BizApps_Sales:` |
| **npm scope** | `@mj-biz-apps/sales-*` |
| **Ports** | MJAPI **4141** · MJExplorer **4341** |
| **Branching** | `next` → `main`; feature branches track same-named remotes |
| **Keys** | UUID primary keys throughout |

**Sales consumes:** `common` (Person/Organization, the Activity spine) · `orders`
(`PreviewOrder`, `CreateOrderInState`, `PreviewPrice`, the catalog, `PriceList`, `SalesAuthority`) ·
`contracts` (`CreateFromDeal`, `RenewTerm`) · `tasks` (approval gates) · MJ core (Communication,
Conversations, Files, Lists, Tags, Actions/Agents, Scheduled Jobs, Duplicate Runs, Record Merge).

**Sales does NOT:** compute prices, taxes, totals or revenue schedules · book journal entries ·
manage subscriptions directly · own the customer master · own the agreement.

---

## What You Get

### Type tables — the configuration layer

**L-13: every piece of domain vocabulary in this app is a type table**, following the house pattern
proven by `ProductType`, `SubscriptionType`, `ContractType` and `ActivityType`. Each carries the
behaviour flags the engine actually branches on, so an organization can rename, add or reorder its
vocabulary **without a migration and without a code change**.

| Type table | Behaviour flags the engine reads | Seeded with |
|---|---|---|
| **`DealStatusType`** | `IsOpen` · `IsClosed` · `IsWon` · `IsLost` · `LocksDeal` | Open, Won, Lost, Abandoned, On Hold |
| **`DealType`** | `RequiresContract` · `RequiresRenewalSource` · `DefaultPipelineID` | New Business, Renewal, Expansion, Cross-Sell, Partner-Sourced |
| **`DealRole`** | `IsOwnerRole` · `AllowsMultiplePerDeal` · `DefaultAttributionPct` · `IsQuotaCarrying` | Owner/AE, Sales Engineer, SDR, Exec Sponsor, Partner Manager, CS Lead |
| **`ForecastCategoryType`** | `IncludeInCommit` · `IncludeInBestCase` · `IncludeInPipeline` · `DisplayRank` | Omitted, Pipeline, Best Case, Commit, Closed |
| **`LossReason`** | `Category` · `RequiresNotes` · `IsCompetitive` | Price, Product Gap, Competitor, Timing, No Decision, Internal |
| **`LeadSourceType`** | `IsInbound` · `IsPaid` · `AttributionWindowDays` | Referral, Website, Event, Outbound, Partner, Existing Customer |
| **`LifecycleStageType`** | `IsMarketingQualified` · `IsSalesQualified` · `IsCustomer` · `DisplayRank` | Subscriber, Lead, MQL, SQL, Opportunity, Customer, Evangelist, Disqualified |
| **`BuyingRoleType`** | `IsDecisionMaker` · `IsBlocker` · `InfluenceWeight` | Champion, Economic Buyer, Technical Buyer, Influencer, Blocker, End User |
| **`AccountType`** | `IsCustomer` · `IsProspect` · `IsPartner` | Prospect, Customer, Partner, Former Customer |

`CHECK` constraints survive only for **structural invariants** — exactly-one-of foreign keys, date
ordering, non-negative quantities. Never for domain vocabulary. All seeded via `metadata/<type>/`
with hardcoded UUIDs; **never** SQL `INSERT`s in a migration.

### Identity — IsA extensions, not new tables

| Concept | Where it lives |
|---|---|
| **Account** | `SalesAccount` **IsA** `common.Organization` — owner, account type, lifecycle stage, territory, tier, ICP fit, industry, size bands, health |
| **Contact** | `SalesContact` **IsA** `common.Person` — owner, lifecycle stage, buying role, seniority, lead source, opt-out, last engaged |
| **Lead** | **Not an entity.** A `common.Person` at a lifecycle stage. MJ already ships duplicate detection and record merge for the messy inbound case; a second identity table for humans fights the Person graph and buys nothing *(L-3)* |
| **Us** | MJ `Company` + `Employee`. Deal team members are `Employee`s; `User.EmployeeID` supplies "who am I" *(L-4, L-19)* |

`AnnualRevenueBand` and `EmployeeCountBand` are deliberately **bands, not numbers** — a rep's guess
stored as `$4,750,000` is false precision that later gets treated as fact.

> **⚠️ Blocking prerequisite.** `common.Person` and `common.Organization` must carry
> **`AllowMultipleSubtypes = true`** before these ship. MJ's IsA defaults to *disjoint* — one child
> type per parent record — so without the flag, **whichever app extends `Person` first claims the only
> slot and the second gets wrong auto-chaining, silently, at runtime.** Sales, ATS and certification
> all extend `Person`; the same human is routinely a sales contact, an applicant and a member. It is
> one line of declarative config, and it needs a test that attaches two children to one Person and
> reads both back.

### Pipelines — owned by a company

**L-14: a pipeline belongs to a company; a company may have any number of them.**

**`Pipeline`** — `CompanyID` (**NOT NULL**) · name · code (unique *per company*) · default deal type
· `IsDefault` · `CloseWonPolicy` (JSON) · `DefaultForecastCategoryTypeID` · `RequiresDealLines`.

`CompanyID` being required is what makes **every rollup sliceable by company for free**, and it
matches how Blue Cypress actually sells — several operating companies, each with its own motions.

**`PipelineStage`** — display order · probability · `ForecastCategoryTypeID` · **`DealStatusTypeID`**
(the status a deal takes on entering this stage) · `RottingDays` · `EntryCriteria`/`ExitCriteria`
(declarative JSON predicates, evaluated server-side) · `RequiredFields` · `GuidanceMarkdown`.

Stages carry **no** `IsWon`/`IsClosed` of their own — they point at a `DealStatusType` that does.
That is what makes "Closed Won" a *label* rather than a *behaviour*, and lets a pipeline call its
winning stage "Signed", "Booked" or "Enrolled" with no code aware of the difference.

`GuidanceMarkdown` — the "what good looks like at this stage" text shown in the deal workspace — is
the cheapest sales-enablement feature in existence, and every CRM sells it as an add-on.

### The deal

**`Deal`** — `DEAL-{seq}` · pipeline · stage · type · **status** · account · primary contact ·
**`CompanyID`** (must match `Pipeline.CompanyID`) · **`OwnerEmployeeID`** (denormalized stamp) ·
`Amount` + **`AmountIsComputed`** + **`AmountComputedAt`** + **`AmountSourceHash`** · MRR · ARR ·
term months · expected/actual close · probability · forecast category · loss reason + notes · lead
source · **`ContractID`** · **`RenewsContractID`** · next step.

The three `Amount*` provenance columns are load-bearing. `Amount` is a **cached answer**;
`AmountSourceHash` fingerprints the `DealLine` set it came from, so the UI can say *"this figure is
stale, reprice"* instead of showing a number nobody can trace. **Without them, `Amount` becomes a
hand-edited field within a month and rule #1 quietly dies.**

**`DealLine`** — product · quantity · requested discount · override price · term · service period ·
plus four **write-only** columns populated *only* from an `Orders.PreviewOrder` response:
`ResolvedUnitPrice`, `ResolvedExtendedAmount`, `PriceComponentsJSON`, `PricedAt`.
`PriceComponentsJSON` stores orders' explanation trail, so a rep can answer *"why is it this price"*
without a support ticket.

**`DealStageEvent`** — immutable transition log, append-only: from/to stage, from/to status, who,
when, days in previous stage, **`AmountAtTransition`**, `ProbabilityAtTransition`. This single table
is where stage-conversion rates, velocity, slippage and "deals that skipped qualification" all come
from. Stamping the amount at each transition is what lets historical roll-ups reconstruct correctly
**after** the deal's amount changes.

**`DealContactRole`** — the buying committee on the *customer* side. A junction rather than a field
on the contact, because one contact holds different roles on different deals.

**`ForecastSnapshot`** — written by a Scheduled Job. *"What did we think on the first of the month"*
is the question a forecast review actually asks, and it is **unanswerable after the fact** without
snapshots.

---

## The deal team, and the trap it sets

**L-16.** A deal carries multiple internal people in distinct roles — AE, SE, SDR, exec sponsor,
partner manager — via **`DealTeamMember`** (`Employee` × `DealRole`, unique on the triple).
`DealRole.AllowsMultiplePerDeal` governs whether two people may hold the same role: two sales
engineers, yes; two owners, no. Enforced **server-side from the flag**, not hardcoded.

`DealTeamMember` is the **single source of truth** for who is on a deal, including the owner (the
member whose role has `IsOwnerRole = 1`; exactly one per deal, enforced). `Deal.OwnerEmployeeID` is a
**server-maintained denormalized stamp**, written by the entity-server `Save()` override whenever
team membership changes, so "my deals" does not require a join on every query. This mirrors
`OrderLine.CompanyID` in orders — a denormalized copy maintained by server code, never hand-set.
**Document it in the extended property**, or someone will eventually set it directly and the two will
diverge.

> ### ⚠️ Attribution double-count
>
> A deal with an AE, an SE and an SDR has three `DealTeamMember` rows. **Summing `Deal.Amount` across
> that table triple-counts the deal.** Every by-rep or by-role rollup must either **filter to a single
> role** (the default for "bookings by rep" — the owner role) or **weight by `AttributionPct`**, with
> the app validating that percentages sum to 100 when any are set.
>
> Report definitions state which they use. **A total that silently exceeds real bookings is worse than
> no total**, and this is the shape that produces it.

---

## Pricing — the whole mechanism

```
DealLine[]  ──map──▶  HydratableLine[]  ──▶  Orders.PreviewOrder  ──▶  priced result
                                                                          │
                                       ┌──────────────────────────────────┤
                                       ▼                                  ▼
                        DealLine.Resolved* + PriceComponentsJSON     Deal.Amount
                                                                   + AmountSourceHash
```

On close, **the same draft** goes to `Orders.CreateOrderInState`. The quote and the invoice cannot
disagree, because they are **the same computation run twice**.

### Overriding a price is an input, not an exception

A rep negotiating a number is the normal case, not a workaround, and orders already models it with a
full audit and authority trail — `OrderAdjustment` carries `Amount`, a **required** `Reason` when it
is not a promotion, `AppliedByUserID`, `AuthorizedBySalesAuthorityID` and the `ApprovedByUserID` /
`ApprovedAt` pair; `SalesAuthority` carries the per-rep caps (`MaxDiscountPct`, `MaxOrderValue`,
allowed payment terms, allowed product categories).

**The override is an input to the pipeline, never a replacement for it.** Sales sets
`OverrideUnitPrice` or `RequestedDiscountPct` on the line; `Orders.PreviewOrder` honours it and then
**still** computes extended amount, charges, tax and proration on top, and returns the totals. Sales
stamps what came back.

```
DealLine.OverrideUnitPrice = 50,000     ← a human decided this
        │
        ▼
Orders.PreviewOrder                     ← honours the override, THEN applies
        │                                  charges + tax + proration on top
        ▼
Deal.Amount = 53,240                    ← stamped, never derived here
```

Computing `quantity × override` locally would produce **50,000** — quietly dropping tax and charges,
so the quote and the invoice disagree by an amount nobody can trace. That, and not the human
judgement, is what the rule exists to prevent.

The same logic covers contracted pricing, which is cleaner still: `ContractPriceResolver` registers
**inside** orders' `BasePriceResolver` walk, so contracts does not override orders from outside — it
participates in orders' own computation as a plugin. That is why contracted prices reach ad-hoc
orders for free.

> **Approval level is data, and it varies by organization.** Exceeding a rep's `SalesAuthority` raises
> an Approval Request Task routed to an approver role — configured per org, never hardcoded.
> **Open question:** `SalesAuthority` is a *flat cap per rep*, which expresses single-gate approval
> well but cannot express an escalation ladder (">20% to the manager, >40% to the CFO") as
> configuration. If an org needs tiers, that is a threshold→role table belonging in **orders** beside
> `SalesAuthority` — because ad-hoc order confirm needs it too, not just deals. Not built until
> confirmed.

**Two clean modes, not a spectrum** *(L-2)*:

| Mode | Shape | When |
|---|---|---|
| **Simple deal** | Header only. `Amount` hand-entered, `AmountIsComputed = 0`, no lines, no catalog | Small, B2C-ish, or early-stage where line detail is noise. Closes to nothing, or to a single ad-hoc order |
| **Priced deal** | `DealLine[]` against real catalog products, priced through orders. Requires a selling `CompanyID` | Everything that will become a contract or a subscription |

`Pipeline.RequiresDealLines` sets the default per pipeline — partner-referral and sponsorship
pipelines may never carry catalog lines — overridable per deal.

**Approvals:** a requested discount beyond the rep's `SalesAuthority` (orders) raises an Approval
Request Task in [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks), routed to the
approver role, with `TaskType` `OnComplete`/`OnReject` hooks calling back into sales.

---

## Closing a deal

### The policy

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

A deal can legitimately need **both** a contract (subscription products) *and* a standalone order (a
services SOW billed once). The policy expresses that rather than forcing a choice. And a deal type
may legitimately close to **nothing** — a partner referral, a sponsorship handshake — which is a
first-class outcome, not a gap.

### `Sales.CloseDeal(DealID, DealStatusTypeID, overrides?)`

Named for the **outcome type**, not a hardcoded "won" — behaviour resolves from `DealStatusType`
flags. One transaction:

1. Validate the stage's exit criteria and required fields; **refuse with a message naming what is
   missing.**
2. If the target status has `IsLost` — require `LossReasonID` (and notes when the reason demands
   them), write the stage event, lock, done.
3. If `IsWon` — resolve the effective policy (deal override → pipeline default).
4. If `CreateContract` — call `Contracts.CreateFromDeal`, stamp `Deal.ContractID`. When
   `DealType.RequiresRenewalSource` is set, call `Contracts.RenewTerm` against `RenewsContractID`
   instead.
5. Route lines per policy — subscription lines become contract lines (materializing subscriptions
   with **`BillingMode='External'`**); one-time lines become an order via
   `Orders.CreateOrderInState`.
6. Move to the closing stage, write `DealStageEvent`, write an `Activity`, set the close stamps,
   apply the lock.

**All-or-none.** A partial close — contract created, order missing — is the exact failure the
transaction exists to prevent.

> **Loss reason is the app's only mandatory field**, and it is worth the friction: loss reasons are
> the highest-value, most consistently-skipped data in any CRM.

### Locked on close — L-17

When a deal enters a status where `DealStatusType.LocksDeal = 1`, the deal and its lines become
**immutable**, enforced in the server-side `Save()` override. This mirrors orders' journal-entry
immutability after `Batched`/`GLPosted` and exists for the same reason: **the deal is now the
provenance of a contract and an order, and editing it retroactively falsifies both.**

| After lock | |
|---|---|
| Header fields | Frozen, except `Description` and `NextStep` (annotation only, no financial meaning) |
| `DealLine` rows | Frozen — no insert, update or delete |
| `DealTeamMember` | Frozen (attribution is now historical fact) |
| `Activity` links | **Still allowed** — post-close conversations are real and belong on the timeline |
| Reopening | Only via `Sales.ReopenDeal(DealID, reason)`, which writes a `DealStageEvent`, records the reason, and is gated by an approval task when the pipeline requires it |

**The lock is not a UI concern.** Enforce it in the entity server so an Action, an agent or a direct
`BaseEntity.Save()` hits the same wall.

---

## Entity model

```
 BizAppsCommon                    __mj                        BizAppsOrders / Contracts
 Organization ◄─IsA─┐      Company · User · Employee        Product · PriceList · Order
 Person       ◄─IsA─┤             │                          Subscription · Contract
 Activity spine     │             │                                ▲         ▲
      │             │             │                                │         │
      │   ┌─────────┴──────┐      │                                │         │
      │   │  SalesAccount  │      │                                │         │
      │   │  SalesContact  │      │                                │         │
      │   └────────┬───────┘      │                                │         │
      │            │              ▼                                │         │
      │            │      ┌───────────────┐  CompanyID NOT NULL    │         │
      │            │      │   Pipeline    │  (L-14 — what makes    │         │
      │            │      │ CloseWonPolicy│   every rollup         │         │
      │            │      └───────┬───────┘   sliceable)           │         │
      │            │              │ 1 → N                          │         │
      │            │      ┌───────▼────────┐                       │         │
      │            │      │ PipelineStage  │ → DealStatusTypeID    │         │
      │            │      │ probability ·  │   (stages have NO     │         │
      │            │      │ exit criteria  │    IsWon of their own)│         │
      │            │      └───────┬────────┘                       │         │
      │            │              │                                │         │
      │            ▼              ▼                                │         │
      │   ┌────────────────────────────────┐  ContractID ──────────┼─────────┘
      │   │             Deal               │  RenewsContractID ────┼─────────┘
      │   │  Amount (CACHED) + IsComputed  │                       │
      │   │  + ComputedAt + SourceHash     │   ← provenance, not   │
      │   │  CompanyID = Pipeline.CompanyID│     a hand-typed number│
      │   └──┬────────┬────────┬───────┬───┘                       │
      │      │        │        │       │                           │
      │      │        │        │       └──► DealContactRole        │
      │      │        │        │            (buying committee)     │
      │      │        │        │                                   │
      │      │        │        └──► DealTeamMember ──► Employee    │
      │      │        │             (Employee × DealRole;          │
      │      │        │              owner is a MEMBER, not a      │
      │      │        │              parallel truth)               │
      │      │        │                                            │
      │      │        └──► DealStageEvent  (immutable; stamps      │
      │      │             AmountAtTransition so history           │
      │      │             reconstructs after Amount changes)      │
      │      │                                                     │
      │      └──► DealLine ──── ProductID ────────────────────────►┘
      │            Resolved* + PriceComponentsJSON
      │            ← WRITE-ONLY from Orders.PreviewOrder
      │
      └──► Activity / ActivityLink   (timeline on contact, account AND deal)

           ForecastSnapshot · Quota (v2)   ← point-in-time, because current state
                                              cannot answer "what did we think then"
```

### Multi-company

Mirrors orders' **D6/D7** exactly, so nothing has to be re-derived:

| | Sales | Orders (the model being mirrored) |
|---|---|---|
| Attribution / ownership anchor | `Deal.CompanyID` (= `Pipeline.CompanyID`) | `Order.CompanyID` |
| Revenue ownership | `DealLine` inherits `Product.CompanyID` | `Product.CompanyID` (NOT NULL, source of truth) |
| Denormalized stamp | `DealLine.CompanyID` at price time | `OrderLine.CompanyID` at save |

A cross-company deal therefore materializes into orders with correct per-line company ownership, and
**each line books its own single-company journal entry** (orders D10) with no extra work here.

---

## Dashboards and roll-ups

The requirement is to slice performance by **company, pipeline, time period, rep, role — and
whatever else.** That is a dimensional problem, so the model is stated as **grains, dimensions and
measures** rather than a fixed list of screens.

| Grain | Table | Answers |
|---|---|---|
| Deal | `Deal` | current pipeline, weighted forecast, win rate, average deal size |
| Transition | `DealStageEvent` | velocity, stage conversion, dwell time, slippage, skipped stages |
| Team membership | `DealTeamMember` | per-rep and per-role performance, coverage, involvement |
| Line | `DealLine` | product mix, attach rate, discount depth |

**Dimensions** — Company · Pipeline · Stage · Time (expected close, actual close, transition,
created — *each answers a different question and every report must say which it uses*) · Employee ·
DealRole · DealType · DealStatusType · ForecastCategoryType · LeadSourceType · Account (territory,
tier, industry) · Product and Product Category.

**Measures** — open pipeline · weighted pipeline · forecast by category (**via `IncludeInCommit` /
`IncludeInBestCase` flags, never a string comparison**) · bookings · win rate by count and by value ·
average cycle time · stage conversion and dwell · slippage · coverage vs. quota *(v2)* · new vs.
renewal vs. expansion mix · discount depth.

Implemented as **MJ Queries** (parameterized, permissioned) feeding an MJ Dashboard rather than
hand-rolled Angular aggregation — so Skip, the query builder and report snapshots all get them for
free.

**Two things that will be wrong if not designed in:** the attribution double-count above, and
**point-in-time vs. current state** — *"what is the forecast"* reads `Deal`; *"what did we think on
the 1st"* reads `ForecastSnapshot`, and is unreconstructable from `Deal` alone once amounts and dates
change.

---

## UI

Built on MJ's existing Angular Generic components — `kanban`, `timeline`, `filter-builder`,
`entity-card`, `join-grid`, `record-merge`, `entity-communication`, the page-chrome trio — plus the
Activity widgets from `bizapps-common`.

| Surface | Contents |
|---|---|
| **Pipeline board** *(rep)* | `kanban` over `PipelineStage`, drag-to-advance with exit-criteria validation **on drop**, rotting indicators, inline amount + close date, saved views, pipeline switcher scoped to the user's company |
| **Deal workspace** *(rep)* | Provenance-aware amount header · line editor with live reprice · deal team panel · buying committee · activity timeline + composer · next step · stage guidance · tasks · files · read-only banner once locked |
| **Account / contact 360** | Common's Person/Org forms with the timeline embedded, plus open deals, contracts, orders, subscriptions |
| **Dashboards** *(manager / exec)* | The dimensional model above |
| **Pipeline studio** *(ops)* | Pipeline/stage authoring per company, probabilities, exit criteria, close policy, and the type-table editors |

House rules: standalone components with `inject()` · `@if`/`@for` · PascalCase public members ·
`<mj-loading>` only · **semantic `--mj-*` tokens, no hardcoded colors** · confirm-LEFT / cancel-RIGHT
· Font Awesome · every `BaseResourceComponent` subclass calls `NotifyLoadComplete()`.

---

## Lateral integrations

None are dependencies. Each is a metadata wiring exercise once the app exists.

| App | Wiring | Phase |
|---|---|---|
| **MJ Communication** | Inbound (Graph / SendGrid Inbound Parse) and outbound email → `CommunicationLog` → `Activity` linked to contact, account and open deals. **The timeline populates itself.** | 1 |
| **bizapps-tasks** | Approval gates; follow-up tasks from the deal workspace; reopen approvals | 1 |
| **bizapps-forms** | On-submit Action: match-or-create `Person` → ensure `SalesContact` → write `Activity` → create or route a `Deal`. **Zero new plumbing** — Forms already ships anonymous magic-link distributions and on-submit Actions | 2 |
| **bizapps-sonar** | Anchor a scoring model on `Deal` (health, slip risk) or `SalesAccount` (engagement, expansion propensity). Factors read the Activity spine. **Explainable deal scoring instead of a rep's gut probability** | 2 |
| **bizapps-caliber** | `SubjectEntityName='MJ_BizApps_Sales: Deals'` — **no schema change** (Caliber DG-5). AI-run discovery/qualification; rep coaching against a rubric. Caliber's `ContextProvider` roster already names a `CRMProvider` — this is what it was for | 2 |
| **MJ Agents** | Deal-desk agent (hygiene, stalled deals, missing next steps) · forecast-review agent · outbound sequences | 3 |

---

## HubSpot migration

A named workstream, not an afterthought.

| HubSpot | Target |
|---|---|
| Company | `common.Organization` + `SalesAccount` |
| Contact | `common.Person` + `SalesContact` (lifecycle stage → `LifecycleStageType`) |
| Deal | `Deal` (+ `DealLine` where line items exist) |
| Deal stage history | `DealStageEvent` — **preserve original timestamps**, do not stamp import time |
| Deal owner + collaborators | `DealTeamMember` against MJ `Employee`, roles mapped to `DealRole` |
| Engagements (emails, calls, meetings, notes) | `Activity` + `ActivityLink`, `ActivityDate` = the **original** date |
| Pipelines and stages | `Pipeline` (assigned to the correct MJ `Company`) + `PipelineStage`, `DealStatusType` mapped from HubSpot's closed-won/closed-lost flags |
| Line items / products | Map to the orders catalog — **unmatched products need a decision, not a silent skip** |
| Custom properties | Case by case: promote to extension columns, or drop **with a written list of what was dropped** |

**Non-negotiables:** original timestamps on `ActivityDate` and `DealStageEvent.ChangedAt` — precisely
why `ActivityDate` is not `__mj_CreatedAt`. Run the import twice against a scratch DB and diff. And
**the import must bypass the close lock** — historical closed deals arrive already closed, so the
importer needs an explicit, audited path rather than a disabled rule.

---

## Local development

`bizapps-contracts`, `bizapps-orders` and `bizapps-accounting` are **not published to npm**, so this
repo resolves them through sibling checkouts declared in `.mj-links.json` and symlinked by
`scripts/link-local-apps.mjs` on `postinstall`. Check out the whole family as peers:

```
develop/M5/
├── bizapps-common/         (npm: @mj-biz-apps/common-*@5.32.0 ✓ published)
├── bizapps-tasks/          (npm: @mj-biz-apps/tasks-*@1.2.0   ✓ published)
├── bizapps-accounting/     (unpublished — sibling link required)
├── bizapps-orders/         (unpublished — sibling link required)
├── bizapps-contracts/      (unpublished — sibling link required)
└── bizapps-sales/          ← this repo
```

> **This is a known-bad interim hack, and it is deliberate.** Sales sits **three hops** from an
> unpublished dependency (sales → contracts → orders → accounting), which is the deepest chain in the
> family. The module-identity collapse that makes symlinking work — `type-graphql`, `graphql` and
> `reflect-metadata` must resolve to exactly one copy, or `buildSchema` fails on decorators that are
> perfectly correct — has never been exercised at this depth. A pnpm-based fix is in flight from the
> platform team; this survives until then. **Read the header comment in `scripts/link-local-apps.mjs`
> before touching anything about resolution.**

---

## Testing

**Unit** — `npm test` per package. Pure logic only (policy evaluation, exit-criteria predicates,
attribution weighting), no database. Plus the **CI grep** proving no server file compares a status or
stage name.

**Integration** — check bundles driving a live database through the real stack, dispatched by
`mj test`. Nothing is mocked; each check owns a transaction that always rolls back.

```bash
node test-harnesses/integration.mjs close-deal

RUN_MUTATION_TESTS=1 MJ_INTEGRATION_TEST=1 \
  npm run mj -- test suite --name "BizApps Sales Integration"
```

> **`RUN_MUTATION_TESTS=1` is not optional.** Every check is `RequiresMutation`, and MJ's driver skips
> them without it — so a run without the flag executes **nothing and reports success**.
> `scripts/assert-check-count.mjs` fails if fewer checks ran than the registry declares.

CI runs **unit tests only, deliberately** — the integration suite needs SQL Server plus sibling
checkouts of three unpublished repos. The integration suite is a **pre-merge step run locally**.

---

## Repository structure

```
bizapps-sales/
├── mj-app.json                    # MJ Open App manifest (schema __mj_BizAppsSales)
├── mj.config.cjs                  # CodeGen config + IsA declarations + PG placeholder rules
├── .mj-links.json                 # sibling links to unpublished contracts + orders + accounting
├── apps/
│   ├── MJAPI/                     # GraphQL API server (port 4141)
│   └── MJExplorer/                # Angular UI application (port 4341)
├── packages/
│   ├── Entities/                  # @mj-biz-apps/sales-entities
│   ├── Actions/                   # @mj-biz-apps/sales-actions
│   ├── Server/                    # @mj-biz-apps/sales-server
│   ├── CoreEntitiesServer/        # @mj-biz-apps/sales-core-entities-server (close lock, owner stamp)
│   ├── IntegrationTests/          # @mj-biz-apps/sales-integration-tests
│   └── Angular/                   # @mj-biz-apps/sales-ng
├── migrations/                    # T-SQL migrations (source of truth)
├── migrations-pg/                 # PG migrations (converter output)
├── metadata/                      # The nine type tables + pipelines, synced via mj-sync
├── metadata-tests/                # MJ: Tests + Test Suite records
├── scripts/                       # rebuild-db.sh, append-codegen.sh, link-local-apps.mjs
├── test-harnesses/                # standalone dispatchers
└── plans/
    └── bizapps-sales-master.md
```

---

## Build sequence

| Phase | Work | Status |
|---|---|---|
| **S0** | Repo bootstrap, `mj-app.json`, ports, CI | In progress |
| **S1** | Baseline migration + CodeGen: **type tables first**, then identity extensions, pipelines/stages, deal + lines + team + stage events | Not started |
| **S2** | The pricing bridge — `DealLine` ↔ `Orders.PreviewOrder`, provenance stamping, the enforcement check | Not started |
| **S3** | Pipeline board + deal workspace + deal team + activity timeline (**the rep's day**) | Not started |
| **S4** | `Sales.CloseDeal` + policy evaluation + the close lock + `Contracts.CreateFromDeal` / `RenewTerm` wiring | Not started |
| **S5** | Dashboards: MJ Queries, forecast snapshots, stage-conversion and velocity | Not started |
| **S6** | HubSpot import + reconciliation report | Not started |
| **S7** | **Cutover** — run parallel for one full sales cycle before turning HubSpot off | Not started |
| **S8** | v2: sequences, Forms capture, Sonar scoring, Caliber discovery, quota/attainment | Not started |

### Upstream prerequisites

| Gate | Where | Blocks |
|---|---|---|
| **Activity spine** (`Activity`, `ActivityType`, `ActivityLink`) | `bizapps-common` | S3 — the timeline is core to the rep's day |
| **`AllowMultipleSubtypes = true`** on `Person` / `Organization` | `bizapps-common` | S1 — identity extensions |
| **`Subscription.BillingMode`** | `bizapps-orders` | S4 — close routing materializes `External` subscriptions |
| **Pricing resolver pre-walk slot** | `bizapps-orders` | S2 (soft) — quotes reflect contracted pricing |
| **`Contracts.CreateFromDeal` / `RenewTerm`** | `bizapps-contracts` | S4 |

> **Fastest-path note.** If getting off HubSpot must precede contracts, S1–S3 can run with deals
> closing to nothing or to a plain Order, and `Deal → Contract` wired additively afterward. **The
> Activity spine cannot move** — everything in S3 assumes the timeline exists.

### Open questions

| # | Question | Recommendation |
|---|---|---|
| **D-3** | Quota/attainment in v1 or v2? | **v2** — forecast roll-up without quota is still useful; quota without a full period model is a half-feature |
| **D-6** | Can a non-employee (partner rep, contractor) be on a deal team? `Partner Manager` is in the seeded `DealRole` list, so this bites on the first partner-sourced deal | **Add a nullable `PersonID` beside `EmployeeID` with an exactly-one-of `CHECK`** — the idiom `common.ContactMethod` and `Relationship` already use. Keeps `Employee` primary, costs one column. *Not built until confirmed* |
| — | Territory: label or routing engine? | **A label.** Routing is a product in its own right and is explicitly out of scope |
| — | Default attribution when no `AttributionPct` is set | **Owner role** — the only default that reconciles to total bookings |

---

## Definition of done for v1 — "get off HubSpot"

- [ ] A rep can run their entire day without HubSpot: board, deal, log activity, advance stage, close
- [ ] **No server file compares a status or stage *name*** — behaviour comes from type-table flags, with a CI grep proving it
- [ ] `Deal.Amount` for any lined deal provably equals `Orders.PreviewOrder` for the same draft — **with a test that fails if it does not**
- [ ] Closing creates the contract and/or orders **in one transaction**, or fails cleanly naming the blocker
- [ ] A closed deal is immutable at the **entity-server** level — proven by a test that attempts a direct `BaseEntity.Save()` and is refused
- [ ] Stage transitions logged immutably with amount and probability at transition
- [ ] A deal carries multiple team members in distinct roles; **by-rep rollups do not double-count**
- [ ] Dashboards slice by company, pipeline, period, rep and role
- [ ] The activity timeline shows email, calls, meetings, notes and tasks on contact, account **and** deal
- [ ] HubSpot import completes with **original timestamps preserved** and a written reconciliation report
- [ ] Design-token gate passes; verified in dark mode
- [ ] Package tests pass; counts reported. PG conversion CI-green

---

## Documentation

| Document | Description |
|---|---|
| [Sales sub-plan](https://github.com/BlueCypress/new-products/blob/main/sales-deal-management/plans/03-bizapps-sales.md) | The buildable spec this README summarizes |
| [Parent plan](https://github.com/BlueCypress/new-products/blob/main/sales-deal-management/plan.md) | Strategy, architecture, the three-app split, decision log L-1…L-21 |
| [Activity spine spec](https://github.com/BlueCypress/new-products/blob/main/sales-deal-management/plans/01-common-activity.md) | The `bizapps-common` prerequisite |
| [BizApps Contracts](https://github.com/MemberJunction/bizapps-contracts) | The agreement envelope a won deal creates |
| [BizApps Orders](https://github.com/MemberJunction/bizapps-orders) | The catalog and pricing engine every number comes from |
| [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks) | The approval substrate |

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| **Platform** | [MemberJunction](https://github.com/MemberJunction/MJ) | 5.50+ |
| **Runtime** | Node.js | 18+ |
| **Language** | TypeScript | 5.9 (strict) |
| **Database (primary)** | SQL Server / Azure SQL | 2019+ |
| **Database (secondary)** | PostgreSQL | 17 |
| **API** | GraphQL (Apollo Server) | — |
| **UI Framework** | Angular | 21 |
| **Build** | Turborepo | 2.7 |
| **Validation** | Zod | 3.24 |

---

## License

ISC, consistent with the BizApps line. *(Family-wide licensing is under review; if the BizApps apps
move to BUSL-1.1, this app follows the family.)*

---

<p align="center">
  Built on <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> — the open-source metadata-driven application platform.
</p>
