# Mutation evidence — which integration checks have been proven able to FAIL, and which have not

**Rewritten from scratch on 2026-08-21 against the merged tree** (dashboard-queries,
forecast-query-source and pipeline-board-rebased all in). Every figure below is counted from the current
sources or from a recorded run. Nothing is carried across from either predecessor version of this file,
because both were arithmetically stale the moment they merged:

- the previous target asserted `activities` 18/0 and `forecast` 13/0 — the first falsified by this merge,
  which brings activities to 22;
- the forecast branch's copy said `board-move` was not covered, which its own sibling's `M-ST1` falsifies
  by killing BD1, BD2 and BD4;
- and **both called their round "Round 4", on the same date.** Rounds are numbered chronologically here,
  and the collision is called out where it lands.

---

## The numbers, counted rather than remembered

| | |
|---|---|
| Checks registered across 9 bundles | **118** |
| Mutants defined in `test-harnesses/mutate-checks.mjs` | **54** |
| Checks a mutant is DECLARED to kill (`expect` lists) | **54** |
| Checks additionally proven by measured collateral kills | **2** (BD1, BD4 — see `M-ST1`) |
| **Checks proven able to fail** | **56 of 118** |

118 is agreed by two independent routes: the per-key arithmetic in
`scripts/expected-check-counts.json`, and grepping registered `Id:` values straight out of
`packages/IntegrationTests/src/checks/*.checks.ts` (118, same per-bundle split, no duplicate ids). The
suite then ran 118, 0 failed, 0 skipped.

### Per bundle

| Bundle | Checks | Proven | Not proven |
|---|---|---|---|
| `save-deal` | 31 | 22 | 9 |
| `close-deal` | 19 | 16 | 3 |
| `product-picker` | 4 | 4 | — |
| `close-won-order` | 5 | 3 | 2 |
| `close-won-contract` | 4 | 3 | 1 |
| `board-move` | 6 | 5 | 1 (BD3) |
| `close-won-tasks` | 14 | 3 | **11** |
| **`activities`** | **22** | **0** | **22** |
| **`forecast`** | **13** | **0** | **13** |

---

## The two bundles with NO mutant at all, and a commit title that reads otherwise

`activities` (22) and `forecast` (13) — **35 checks, 30% of the suite — have never been shown able to
fail.** For those the honest statement is that they pass, not that they work.

This needs saying precisely, because the merged history looks like it was fixed. Commit `1352b2c` on
`feature/forecast-query-source` is titled *"mutants for activities and forecast, and four checks that
could not fail"*. Its diff touches four files:

```
packages/.../activities/ActivityIngestService.ts     |  30 +++-
packages/IntegrationTests/src/checks/activities.checks.ts | 153 +++++++++++
packages/IntegrationTests/src/checks/forecast.checks.ts    |  44 +++-
scripts/expected-check-counts.json                        |   2 +-
```

**`test-harnesses/mutate-checks.mjs` is not among them.** The commit added CHECKS to both bundles — four
of them, AC19–AC22 — and repaired four that could not fail. It added no mutant. There is no `M-AC*` or
`M-FS*` entry in the driver on any branch in this merge, and no mutant's `expect` list names an `AC` or
`FS` id. Verified by listing the driver rather than by reading the title.

That is not a criticism of the work — the checks it added are real and the four repairs are exactly the
kind this file exists to prompt. It is a warning about *this document's* sourcing: a title is not evidence,
and the previous two versions of this file both inherited the claim.

`close-won-tasks` is the third notable gap: 14 checks, 3 proven (WT11, WT13, WT14), 11 unproven.

---

## What "proven" means here, and the one place it is softer than it looks

**Method.** For each mutation: change the PRODUCT code (never the check), rebuild, run the whole suite,
record which check ids failed, restore the file from a copy-aside, **rebuild again**. The whole suite runs
each time rather than one bundle, so a mutation that breaks something unintended shows up instead of
hiding.

The final rebuild is new and was added after it cost real time — see Round 5.

**Declared versus measured.** 54 of the 56 are the mutants' own `expect` lists: each was run at least once
and the named check fell. The other 2 (BD1, BD4) are collateral kills recorded from an actual `M-ST1` run.
Where this file says "proven", it means a run was observed — not that the campaign was re-run end to end
against the merged tree. **It has not been.** Re-running all 54 on the merged tree is roughly 100 minutes
and is the obvious next verification; until then, treat the per-bundle table as a claim about the code the
mutants were run against, which for 50 of them predates this merge.

---

## Round 1–3 (2026-08-20) — the original campaign

26 mutations, extended the same day with `M-OS1`–`M-OS3` for the stage → order-status writer. Against
`MJ_V6_Host` with bizapps-orders and bizapps-accounting linked and bizapps-contracts absent. Three rounds
were needed, and the reason there were three is the point: round 1's misses were findings, not retries.

### What it found

1. **`close-deal.CD4` was asserting nothing.** It read `Assert('AmountAtTransition' in last, …)` — always
   true of a `RunView` row whose `Fields` names the column. Replacing
   `event.AmountAtTransition = deal.Amount` with `= null` left every check green. It was invisible for a
   second reason: a seeded deal carries no amount, so null-versus-null was indistinguishable even to a
   stricter assertion. CD4 now gives the deal real figures and compares the stamped values.
2. **`IsDealFieldEditableWhileLocked()` is not what the server calls.** Mutating it to `return true`
   changed nothing: `DealEntityServer` reads the `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` set directly, so the
   helper is used only by the Angular workspace. Not a defect — but anyone reasoning about the lock from
   the helper is reading the wrong half.
3. **The line checks are sensitive to the CATALOGUE, not just the save.** Widening the product filter
   failed PP1/PP3/PP4 *and* all seven order-line checks: they discover their products through that same
   filter, so a non-sellable product gets selected and orders refuses the line.

---

## Round 4 (2026-08-21) — four writers on one trigger, and MJ's create semantics

Five mutations against `DealEntityServer.ts`, each reverting one decision of the mechanism that replaced
four separate writers on the `PipelineStageID` trigger.

| Mutant | What it reverts | Checks it fells |
|---|---|---|
| `M-ST1` | one writer for the stage log — calls the appender twice | BD1, BD2, BD4, CD4, CD11, CD15, CD16 |
| `M-ST2` | the case-insensitive stage compare | **SD32** |
| `M-ST3` | a declared transition suppressing the stage defaults | **CD16** |
| `M-ST4` | the create guard on the stage log | **SD30** |
| `M-OW2` | `callerSuppliedValue` on the owner stamp, back to `Dirty` | **SD31** |

Four of the five isolate exactly one check. `M-ST1` is broad by nature — doubling every event breaks every
count-based assertion — and that breadth is the finding: **seven checks were counting stage events and not
one could see a duplicated row**, because the only input that makes a close move the stage
(`ClosingStageID`) was never passed by any of them. `CD15` exists to pass it. BD1 and BD4 had been green
and unproven since S3 and fell here, to a mutation aimed elsewhere — which is the argument for running the
whole suite per mutation.

**What this round could not express as a mutation.** The original defect was TWO writers. With one writer
left, "two rows" cannot be reintroduced by a one-line edit; re-adding a writer is a thirty-line insertion.
`M-ST1` reproduces the symptom faithfully by calling the single writer twice, and its note in the driver
says so. It is a proxy, labelled as one, exactly like `M-TK1`.

> **This is the round both predecessor documents numbered "Round 4".** The forecast branch's version
> described a different set — its driver held 36 mutants where this one holds 54, all of its ids being a
> subset of these. Nothing is lost by renumbering: the mutants themselves merged cleanly because one file
> was a superset of the other.

---

## Round 5 (2026-08-21) — the stage declares the status, and the reopen restores the stage

| Mutant | What it reverts | Checks it fells |
|---|---|---|
| `M-ST5` | deriving `DealStatusTypeID` from the stage | **SD33** |
| `M-ST6` | the `callerSuppliedValue` guard on the status | **SD34** |
| `M-ST8` | the `LocksDeal` gate on the derived status | **SD35** |
| `M-RO1` | deriving the reopen's landing stage from the close event | **CD18** |
| `M-RO2` | reads `ToStageID` instead of `FromStageID` | **CD18** |
| `M-ST7` | the close setting the status at all | CD4, CD5, CD13, CD14, **CD17**, CD18 |

### CD17 cannot be felled by a single edit, and that is the finding

`CD17` asserts the closing status beats the status the closing stage declares. **Two independent
mechanisms protect it**, so no one-line mutation of the status writer can break it: a declared transition
suppresses stage defaults entirely, *and* the closing status is assigned before the save so it arrives
dirty. Measured rather than argued — `M-ST3` removes the suppression and **CD17 stays green**. `M-ST7`
therefore stops the close setting a status at all, which proves CD17 is not vacuous at the cost of felling
five sibling checks. CD17 is a regression guard against a future change, not a live single-point defence.

### CD19 has no mutant of its own, deliberately

`CD19` pins the other direction — after a status-only close the stage never moved, so there is nothing to
restore and nothing fires. `M-RO2` **cannot** fell it: on a status-only close `FromStageID === ToStageID`,
so swapping them is invisible there. That is exactly why CD18 catches it and why CD19 alone would be
insufficient. The pair is the assertion, not either half.

### The round that nearly shipped a rule violation

`SD33` broke the rule the app exists to uphold on its first version. The seeded pipelines declare a
LOCKING status on their winning and losing stages, so an ordinary save into one of those stages closed the
deal by side effect: locked, `IsWon` set, no close event, no routing, no contract, no tasks,
`Sales.CloseDeal` never invoked. **A board drag would have booked revenue.** The whole suite stayed green,
because until then nothing about a stage could close a deal and so no check ever moved one into a closing
stage. `SD35` does now.

### And the driver bug it exposed

It was found by an Explorer spec, and finding it took three false starts, because **the driver restored the
source but never rebuilt.** After a mutation session `dist/` still held the last mutant while the source
was clean and `git diff` was empty — so MJAPI served mutated code and a browser spec failed three times on
a defect that had already been fixed, through two API restarts and a wrong hypothesis, until the compiled
output was read. The driver now rebuilds in its `finally` block, alongside the copy-aside restore. A tool
whose job is to break things on purpose must not be able to leave them broken.

---

## What this file does NOT establish

That the suite is adequate. It establishes that **56 of 118 checks fail for the reason they claim to**,
each against a specific mutation, on the code that mutation was run against. The 62 unproven include two
entire bundles and eleven of fourteen close-won-task checks. And no mutation campaign says anything about
behaviour no check covers at all — for that, see the Explorer specs under
`test-harnesses/playwright/specs/`, which is where DN-17, DN-18 and DN-19 came from.
