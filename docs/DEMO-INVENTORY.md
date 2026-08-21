# Demo inventory — what is actually on the host

**Measured 2026-08-21 19:15 UTC against `MJ_V6_Host` on `mj-sql`, read-only.** Every figure below came
from a `SELECT` against the live database or from running a shipped query's own SQL; none was read from
`scripts/seed-demo-data.sh`. The integration suite was deliberately **not** run — two other sessions are
working against this host and write-heavy runs are what cause the contention.

This is the inventory a demo script gets written from. It is not the script.

> ### Read this first: the host is not recordable right now
>
> **`GRAPHQL_PORT=4141` and nothing is listening on 4141.** MJExplorer is up on 4341 and another API is
> up on 4143. Until 4141 is serving — or the Explorer is deliberately pointed at 4143 — every query the
> UI makes fails, so nothing in this document can be filmed. That is the first thing to fix and the
> cheapest to miss, because the Explorer shell renders fine with a dead API behind it.

## Two corrections to the brief

**1. It is no longer true that every deal has `AmountIsComputed = 0`.** Five of seven now carry `1`, with
real provenance: `AmountComputedAt` stamped 2026-08-21 01:13 and a populated `AmountSourceHash`, and
`Deal.Amount` equal to both `SUM(OrderLine.LineTotalNet)` and `OrderHeader.TotalGross` to the penny. The
two that are `0` — `DEAL-9004` and `DEAL-9007` — have **no order lines at all** and sit on the D2C
pipeline, which is configured `RequiresDealLines = 0`. So they are *stated by design*, not un-priced by
accident.

The dashboard already tells that story correctly: **`OpenPricedAmount` 213,720 against
`OpenStatedAmount` 37,500**. The board's total is 85% engine-priced, not a pile of typed figures. This is
now a demo *strength*, provided nobody claims all of it is engine-priced — the two D2C cards would
contradict that on screen.

**2. `stage_events` is 7 against a baseline of 5, and the two extra are worse than surplus.** They are a
20-second round trip on the flagship deal; see the hazard section.

## Host state, and how far it has drifted

| | Count |
|---|---|
| Deals | **7** (`DEAL-9001`–`DEAL-9007`) |
| Order headers | **57** |
| Order lines | **63** |
| Stage events | **7** (baseline 5) |
| Deal team rows | **10** |
| Pipelines / stages | 2 / 9 |
| Products | 9 |
| Forecast snapshots | **1** |
| Activities / activity links | **0 / 0** |
| Tasks / task links | **1 / 0** |
| Contracts / contract types | **0 / 4** |

Deal count agrees with the seed today. Orders do not: **50 of the 57 headers are orphans** — no deal
points at them — carrying **57 orphan lines** between them. By status: 31 `Confirmed`, 11 `Draft`, 6
`Quoted`, 2 `Voided`, numbered from `ORD-000002` to `ORD-000064`. The seven live orders are
`ORD-000057`–`ORD-000063`, so the sequence has already run *past* the demo set: the next order minted
will be `ORD-000065`, and a viewer who reads order numbers as a volume signal will conclude this company
has done 64 orders.

## The seven deals

| # | Name | Pipe | Stage | Status | Amount | Priced? | Prob | Expected | Order | Ord. status | Lines | Team | Events |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9001 | Northwind Health — Platform Rollout | B2B | Negotiation | Open | 124,400 | **priced** | 75 | 2026-09-30 | ORD-000057 | Quoted | 2 | 3 | **6** |
| 9002 | Cascade Manufacturing — Pilot | B2B | Qualification | Open | 16,240 | **priced** | 25 | **2026-08-05** | ORD-000058 | Draft | 1 | **0** | 0 |
| 9003 | Northwind Health — Year 2 Renewal | B2B | Proposal | Open | 73,080 | **priced** | 50 | 2026-11-30 | ORD-000059 | Quoted | 1 | **0** | 0 |
| 9004 | Beacon Charter Schools — District | D2C | Evaluating | Open | 28,000 | stated | 60 | 2026-10-01 | ORD-000062 | Draft | **0** | 2 | 0 |
| 9005 | Cascade Manufacturing — Line 2 | B2B | Signed | **Won** | 27,480 | **priced** | 100 | 2026-07-31 | ORD-000060 | Quoted | 1 | 3 | 1 |
| 9006 | Beacon Charter Schools — Add-on | B2B | Lost | **Lost** | 12,180 | **priced** | 0 | 2026-07-15 | ORD-000061 | **Voided** | 1 | 2 | 0 |
| 9007 | Beacon Charter Schools — Campus | D2C | Evaluating | Open | 9,500 | stated | 60 | 2026-10-20 | ORD-000063 | Draft | **0** | **0** | 0 |

Actual close dates: 9005 on 2026-07-28, 9006 on 2026-07-14. Every deal resolves an account and a primary
contact — no dangling or null parties, so the workspace's party pane is clean on all seven.

**The moved close date is `DEAL-9003`.** `Sales: Slipped Deals` returns it and only it: **slipped twice**,
earliest expected 2026-09-15, current 2026-11-30, **net 76 days**, last slipped 2026-08-21 01:11:37. It is
the one deal that tile has anything to say about.

### Order lines, in full

| Deal | Ln | Product | Qty | Unit | Disc % | Net |
|---|---|---|---|---|---|---|
| 9001 | 1 | Platform — Standard Seat | 250 | 406.00 | 0 | 101,500 |
| 9001 | 2 | Platform — Premium Seat | 100 | 229.00 | 0 | 22,900 |
| 9002 | 1 | Platform — Standard Seat | 40 | 406.00 | 0 | 16,240 |
| 9003 | 1 | Platform — Standard Seat | 180 | 406.00 | 0 | 73,080 |
| 9005 | 1 | Platform — Premium Seat | 120 | 229.00 | 0 | 27,480 |
| 9006 | 1 | Platform — Standard Seat | 30 | 406.00 | 0 | 12,180 |

**Every discount is 0.0000.** There is no discount anywhere in the demo data, so nothing about discounting
can be shown from the seed — it can only be demonstrated by typing one live, which is where the two known
defects sit.

Order status follows the stage, correctly and by data: `PipelineStage.OrderStatusOnEntry` is `Quoted` on
Proposal, Negotiation and Signed; `Voided` on Lost; unset on Discovery, Qualification, Introduced,
Evaluating. Every order's status matches its deal's stage under that rule.

### Team and attribution

| Deal | Role | Person | Attribution |
|---|---|---|---|
| 9001 | Owner / AE | Local Developer | 100 |
| 9001 | Sales Engineer | Priya Raman | **null** |
| 9001 | SDR | Tom Okafor | **null** |
| 9004 | Owner / AE | Priya Raman | 100 |
| 9004 | Partner Manager | **(no employee)** | **null** |
| 9005 | Owner / AE | Local Developer | 60 |
| 9005 | Sales Engineer | Priya Raman | 25 |
| 9005 | SDR | Tom Okafor | 15 |
| 9006 | Owner / AE | Tom Okafor | 100 |
| 9006 | Sales Engineer | Priya Raman | 30 |

`DEAL-9005` is the clean 60/25/15 split DN-21 describes. `DEAL-9006` carries 100 + 30 = 130. **`DEAL-9002`,
`DEAL-9003` and `DEAL-9007` have no team rows at all**, yet all three carry a non-null
`Deal.OwnerEmployeeID` (Local Developer, Priya Raman, Priya Raman).

## What each tile renders right now

**`Sales: Dashboard Summary`** — one row:

| OpenAmount | OpenCount | TotalCount | NoStatus | PastExpectedClose | Won | OpenPriced | OpenStated | OpenNoAmount |
|---|---|---|---|---|---|---|---|---|
| 251,220 | 5 | 7 | 0 | **1** | 1 | 213,720 | 37,500 | 0 |

`PastExpectedCloseCount = 1` is `DEAL-9002` (expected 2026-08-05, today is the 21st). Nothing else flips
until 2026-09-30, so the tile is stable for about six weeks.

**`Sales: Pipeline Summary`** — open deals only, so it returns **four rows for nine stages**:

| Pipeline | Stage | Deals | Open | Weighted | Priced | Stated |
|---|---|---|---|---|---|---|
| B2B | Qualification | 1 | 16,240 | 4,060 | 16,240 | 0 |
| B2B | Proposal | 1 | 73,080 | 36,540 | 73,080 | 0 |
| B2B | Negotiation | 1 | 124,400 | 93,300 | 124,400 | 0 |
| D2C | Evaluating | 2 | 37,500 | 22,500 | **0** | **37,500** |

**`Sales: Forecast by Owner`** — four rows, and one of them is empty:

| Owner | Pipeline | Commit | Best case | Pipeline | Closed won |
|---|---|---|---|---|---|
| Local Developer | B2B | 124,400 | 124,400 | 140,640 | 27,480 |
| Priya Raman | D2C | 37,500 | 37,500 | 37,500 | 0 |
| Priya Raman | B2B | 0 | 73,080 | 73,080 | 0 |
| **Tom Okafor** | B2B | **0** | **0** | **0** | **0** |

**`Sales: Bookings by Owner`** — two rows: Local Developer booked 27,480 (1 won, win rate **1.000**), Tom
Okafor booked 0 and lost 12,180 (win rate **0.000**).

**`Sales: Deal Involvement by Rep`** — four rows. `DEAL-9005`'s split reconciles exactly as DN-21 says:
16,488 + 6,870 + 4,122 = 27,480, while `WonAmountOfDealsTouched` reads 27,480 on three separate rows and
sums to 82,440 — §9.4's triple-count, visible on screen. **This query is `WHERE d.ActualCloseDate IS NOT
NULL` — closed deals only.** So `DEAL-9001`, the flagship with the three-person team, appears nowhere in
it, and `UnstatedAttributionCount` correctly reads 0 because no *closed* deal has a null share. Both are
right; both will be misread if the tile is narrated as "involvement" in general.

**`Sales: Win Rate by Count and Value`** — a single row: B2B / Upsell, 2 closed, 1 won, 1 lost, rate by
count 0.500, by value 0.693.

**`Sales: Product Mix and Discount Depth`** — two rows, both Blue Cypress: Standard Seat (4 lines, 500
qty, 203,000 net) and Premium Seat (2 lines, 220 qty, 50,380 net). `AvgDiscountPct`, `MaxDiscountPct`,
`TotalDiscountAmount` and `DiscountedLineCount` are **all zero**, and no D2C product appears at all.

**`Sales: Forecast History`** — **one snapshot**, period 2026-07-01…2026-09-30, captured 2026-08-01, with
`CommitAmount` 185,000 and `ClosedAmount` 64,000. A single point, and its figures are the *old* amounts.

All 15 query files in `metadata/queries/` are registered on the host and `Approved`. No gap there.

## The board, column by column

The board renders every stage, including the closing ones, so nine columns:

| Pipeline | Stage | Declares | Locks | Order on entry | Cards | Column total |
|---|---|---|---|---|---|---|
| B2B | Discovery | Open | no | — | 0 | — |
| B2B | Qualification | Open | no | — | 1 | 16,240 |
| B2B | Proposal | Open | no | Quoted | 1 | 73,080 |
| B2B | Negotiation | Open | no | Quoted | 1 | 124,400 |
| B2B | Signed | **Won** | **yes** | Quoted | 1 | 27,480 |
| B2B | Lost | **Lost** | **yes** | Voided | 1 | 12,180 |
| D2C | Introduced | Open | no | — | 0 | — |
| D2C | Evaluating | Open | no | — | 2 | 37,500 |
| D2C | Booked | **Won** | **yes** | Quoted | 0 | — |

Three of nine columns are empty. Signed and Lost each hold exactly one card and both refuse a drop —
which is the guard working, and also means a drag demo has **one** legal move available on B2B
(Qualification ⇄ Proposal ⇄ Negotiation) and **none** on D2C, where both cards sit in the only open stage
that has any.

## What the product picker offers

`ProductFilterFor` = `CompanyID` match **and** `Status = 'Active'` **and** inside the availability window.
Against today that gives:

**Blue Cypress (B2B) — 2 of 7 offered**

| Product | SKU | Verdict | Why |
|---|---|---|---|
| Platform — Standard Seat | PLAT-STD | **offered** | Active, no window |
| Platform — Premium Seat | PLAT-PRM | **offered** | Active from 2024-01-01 |
| Expired Promo Bundle | PROMO-24 | excluded | window closed 2025-12-31 |
| Next Year Programme | PROG-27 | excluded | window opens 2027-01-01 |
| Legacy Toolkit | DISC-01 | excluded | `Status = Discontinued` |
| Retired Appliance | EOL-01 | excluded | `Status = EOL` |
| Unreleased Concept | DRAFT-01 | excluded | `Status = Draft` |

**BC Education Group (D2C) — 2 of 2 offered**: EDU Campus Licence (EDU-CAMP), EDU Learner Seat (EDU-SEAT).

The five exclusions are deliberately one per reason — two status kinds beyond Active, plus a window that
has closed and one that has not opened — so the picker demo has a real story. Note both offered B2B
products are typed `Add-On / Fee` in orders' catalogue, which reads oddly for a seat licence.

## What a close-won actually produces, end to end

**Nothing on this host has ever been closed through `Sales.CloseDeal`.** `DEAL-9005` was *seeded* Won, so
it is not evidence of what the operation does. Measured state of the downstream:

- **Order: untouched in the sense that matters** — `ORD-000060` is `Quoted`, which is what the Signed
  stage's `OrderStatusOnEntry` declares. Note it says **Quoted, not Confirmed**: a won deal showing a
  *quoted* order is correct here and will be questioned on camera.
- **Tasks: one on the entire host, and it is wrong in three ways.** Name
  `Review order for deal 93111111-0000-4000-A000-000000000001` — a **raw GUID**, and that GUID is
  `DEAL-9001`, which is *open*. Type resolves to the generic `ACTION_ITEM`. `DueAt` is **NULL**. Created
  2026-08-20 23:25 by a test run, not by any close.
- **Task links: zero.** So even that task is attached to nothing; the deal-to-task relationship is
  unrepresented on this host.
- **Contract: none.** 0 contracts against 4 contract types. B2B's `CloseWonPolicy` is
  `{"CreateContract":true,"ContractTypeCode":"Order Form",...}` and `Order Form` **is** seeded, and
  `__mj_BizAppsContracts.vwContracts` now reads cleanly (0 rows, no error) — so the refusal recorded in
  KI-16/DN-16 is resolved and the path *should* work. It has simply never been exercised here. D2C's
  policy is `CreateContract: false`, so a D2C close correctly produces none.

**So the brief's expected end state — order untouched, both tasks raised and linked, contract routed or
refused with a stated reason — cannot be demonstrated from existing data.** It has to be produced live,
and what a live close will produce is unverified.

---

# What would trip a recording

Ranked by how likely a camera is to catch it.

### 1. The API is down — nothing can be recorded at all
`GRAPHQL_PORT=4141`, nothing listening. Explorer up on 4341, a different API on 4143. Blocking.

### 2. `DEAL-9001`'s timeline contains a 20-second round trip
The flagship deal's stage history reads:

```
2026-05-02  (new) → Discovery      120,000  @10   "Created from an inbound referral…"
2026-05-20  Discovery → Qualification  120,000  @25   "Economic buyer confirmed."
2026-06-18  Qualification → Proposal   150,000  @50   "Scope grew to a second site…"
2026-07-22  Proposal → Negotiation     185,000  @75   "Proposal accepted in principle…"
2026-08-21 18:19:28  Negotiation → Discovery  124,400  @75   (no note)
2026-08-21 18:19:48  Discovery → Negotiation  124,400  @10   (no note)
```

A spec dragged it back and forward. The departing-value stamps are *correct* — 75 leaving Negotiation, 10
leaving Discovery — which is the provenance rule working, and it is exactly what makes the pair look like
a data error: the probabilities appear to run backwards. Two note-less events, 20 seconds apart, on
today's date, after a clean three-month narrative. **This is the single most filmable defect on the host.**
It needs the two events deleted before recording — which means deleting from an append-only table, so it
is a deliberate, recorded act, not a tidy-up.

### 3. The same deal's history and header disagree about money
The timeline says the deal reached **185,000** at Negotiation; the header says **124,400**. Legitimate —
amounts move and the stamps freeze what was true — but on screen it invites "so which is it?". Same
shape on the won deal: `DEAL-9005`'s close event stamps **64,000** while the deal reads **27,480**, and
DN-21's attribution story quotes 27,480.

### 4. The single forecast snapshot contradicts the live forecast by 60,600
`ForecastHistory` has one row: commit **185,000**, closed **64,000**, captured 2026-08-01. Live commit is
**124,400** and closed-won is **27,480**. That is the snapshot doing its job, and it is indefensible on
camera unless narrated as "this is what we believed on 1 August". With one data point there is also no
trend to show.

### 5. A rep cannot remove an order line
Confirmed: `UQ_OrderLine_OrderHeader_LineNumber` on `(OrderHeaderID, LineNumber)`, **unfiltered**. Per
KI-20 the whole save is now refused on the unique-index violation rather than failing silently. Do not
put line removal in the script. `DEAL-9001` is the only deal with two lines, i.e. the only place the
gesture is even reachable.

### 6. Three of seven deals have an owner but no team row
`DEAL-9002`, `DEAL-9003`, `DEAL-9007` carry `OwnerEmployeeID` with **zero** `DealTeamMember` rows. This
puts two tiles into disagreement on the same screen: anything reading `Deal.OwnerEmployeeID` counts them
(`Forecast by Owner` credits Priya Raman 73,080 of best case on `DEAL-9003`), while anything joining
`DealTeamMember` drops them. It also contradicts the documented invariant that `DealTeamMember` is the
source of truth for membership *including the owner*. Opening the team pane on any of those three shows
an owner in the header and an empty team.

### 7. `DEAL-9004` has a team row pointing at nobody
Role `Partner Manager`, `EmployeeID` **NULL**, `IsActive = 1`. The team pane will render a live row with
no person in it.

### 8. Tom Okafor's forecast row is all zeros
`Forecast by Owner` returns him with 0 commit, 0 best case, 0 pipeline, 0 closed won and 0 counts —
because his only deal is lost. A named individual rendered as an empty row reads as either a bug or an
unkind callout. Same person is the 0.000 win rate in `Bookings by Owner`, against a 1.000 for Local
Developer: two reps, one at 100% and one at 0%, on one deal each.

### 9. Nothing to show in three surfaces
- **Activity timeline: 0 activities, 0 links.** S-US9's pane renders empty. Do not open it.
- **Discount depth: every line is 0% discount.** The tile has no signal, and the only way to create one
  live runs into the sub-1% and step-constraint issues.
- **Product mix has no D2C row**, because both D2C deals have zero lines.

### 10. 50 orphan orders, and the order sequence has run past the demo
31 `Confirmed`, 11 `Draft`, 6 `Quoted`, 2 `Voided`, holding 57 lines. Invisible on the sales surfaces but
visible the moment anything shows an order list or the next minted number — the live orders are
`ORD-000057`–`ORD-000063` and the next will be `ORD-000065`.

### 11. Both pipelines are flagged `IsDefault = 1`
Two defaults means "the default pipeline" has no single answer, so which one a new deal opens on may
differ between takes. This is the most likely cause of a *"it did something different last time"* moment.

### 12. A won deal's order says `Quoted`
Correct by data — Signed declares `OrderStatusOnEntry = Quoted` — and it will be read as unfinished.
Decide the narration before the camera is on rather than in front of it.

### Reproducibility summary

| Can be run twice unchanged | Runs once, or changes the data |
|---|---|
| Every dashboard tile and board column (read-only) | Closing a deal — mints a task, maybe a contract, moves the stage |
| The product picker, including all five exclusions | Any board drag — appends a permanent stage event |
| The slippage tile on `DEAL-9003` | Adding a line — mints an order line and moves `Amount` |
| Opening any deal in the workspace | Editing a discount — the sub-1% and step-constraint paths |

Anything in the right column needs a database restore between takes, because the tables it writes to are
append-only by design and the demo set has exactly one deal per interesting state.
