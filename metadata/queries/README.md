# Sales read models — golive #40, "Critical reports"

Issue #40 has an **empty body**. Its de facto specification is master plan **§9 (Dashboards and
roll-ups)**, which is where the grains, dimensions and measures below come from — and §9.5 is explicit
about the mechanism: *"Read models as MJ Queries (parameterized, permissioned) feeding an MJ Dashboard,
rather than hand-rolled Angular aggregation — so Skip, the query builder and report snapshots all get
them for free."*

That last clause is the reason these exist as queries rather than as more component code. The dashboard
already computes four of these measures correctly in TypeScript; nothing else in the product can reach
them there.

## The four rules every query in this directory follows

**1. Vocabulary is data.** Every filter branches on a behaviour FLAG — `DealStatusType.IsWon`,
`IsOpen`, `IsClosed`, `ForecastCategoryType.IncludeInCommit`, `DealRole.IsOwnerRole` — and never on a
status, stage, role or category NAME. A pipeline can call its winning stage "Signed" and every number
here still lands. `npm run test:vocabulary-gate` does not scan SQL, so this rule is upheld by review
rather than by CI; the flags are named in each file's header so a reviewer can check it in one read.

**2. Sales never computes money.** These queries SUM and COUNT values that are already answers. None
multiplies quantity by price, applies a discount, computes tax, prorates, or rounds. Two cases look
close enough to be worth naming:

- **Weighted pipeline is `Amount × Probability`,** which §9.3 names as a measure in exactly those
  words. It is a forecast weighting — a statistic about likelihood — not a price. Nothing downstream
  bills from it.
- **Discount depth reads `OrderLine.DiscountPct` and `DiscountAmount` as stored.** Orders computed
  them; sales reports them.

**3. Every report declares which DATE it means.** §9.2 lists four — expected close, actual close,
transition date, created — and says reports must state which they use, because they answer different
questions. Each query's `TechnicalDescription` names its date column.

**4. Every by-rep report declares its attribution basis.** §9.4 is blunt that there is no safe default:
summing `Deal.Amount` across `DealTeamMember` triple-counts a deal with three members. So the two
by-rep queries here are deliberately a PAIR with different bases, and each says so in its name and its
description:

| Query | Basis | Answers |
|---|---|---|
| `Bookings by Owner` | filtered to `DealRole.IsOwnerRole = 1` | "bookings by AE" — every deal counted once |
| `Deal Involvement by Rep` | weighted by `AttributionPct` | "deals I was involved in" — credit split |

Reading either as the other is the double-count §9.4 warns about.

## Two places the master plan needed rebasing, not reinterpreting

§9.1 gives the **Line grain** as `DealLine`, and §9.2 sources the **Product dimension** from
`DealLine → orders catalog`. `DealLine` no longer exists: the embedded-order rework retired it and
line items now live on `OrderLine`, reached through `Deal.OrderID`. Both are rebased onto `OrderLine`
here. That is the same consolidation that retired the table rather than a new modelling decision —
the grain, the dimension and the measures on them are unchanged, only the source table moved.

## What is deliberately not here

- **Pipeline coverage vs. quota** (§9.3) needs a `Quota` table, deferred to v2 by `docs/DECISIONS.md`
  D-2. No query can be written for it.
- **Point-in-time forecast** (§9.4) reads `ForecastSnapshot`, not `Deal`. The snapshot query is here;
  what fills the table is `scripts/capture-forecast-snapshot.sql`, which a Scheduled Job runs. Live
  and point-in-time are different questions and stay different queries.

## Layout

`.<name>.json` carries the record; the SQL lives beside it in `SQL/<name>.sql` and is pulled in with
`@file:`, so the SQL is readable and diffable as SQL. Same shape bizapps-orders uses.
