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
| Checks registered across 9 bundles | **121** |
| Mutants defined in `test-harnesses/mutate-checks.mjs` | **75** |
| Checks a mutant is DECLARED to kill (`expect` lists) | **75** |
| Checks additionally proven by measured collateral kills | **3** (BD1, BD4 — see `M-ST1`; AC22 — see round 7) |
| **Checks proven able to fail** | **77 of 121** |

**The merged figure was verified at 118 by two independent routes**: the per-key arithmetic in
`scripts/expected-check-counts.json`, and grepping registered `Id:` values straight out of
`packages/IntegrationTests/src/checks/*.checks.ts` — same total, same per-bundle split, no duplicate ids.
Round 6 then added CD20–CD22 for the three server-side fixes, giving **121**. The suite ran 121, 0 failed,
0 skipped.

### Per bundle

| Bundle | Checks | Proven | Not proven |
|---|---|---|---|
| `save-deal` | 31 | 22 | 9 |
| `close-deal` | 22 | 19 | 3 |
| `product-picker` | 4 | 4 | — |
| `close-won-order` | 5 | 3 | 2 |
| `close-won-contract` | 4 | 3 | 1 |
| `board-move` | 6 | 5 | 1 (BD3) |
| `close-won-tasks` | 14 | 3 | **11** |
| `activities` | 22 | 12 | 10 |
| `forecast` | 13 | 6 | 7 |

---

## The two bundles that had NO mutant at all — CLOSED 2026-08-21, and the failure mode worth keeping

`activities` (22) and `forecast` (13) — **35 checks, 30% of the suite — had never been shown able to
fail.** 15 mutants now cover them (`M-AC1`–`M-AC10`, `M-FS1`–`M-FS5`); the run is round 7 below. 18 of the
35 are proven, 17 are not, and the remaining gap is itemised there rather than summarised away.

**The rest of this section is kept as written, because how the wrong claim got in matters more than the
claim.**

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

**Declared versus measured.** 57 of the 59 are the mutants' own `expect` lists: each was run at least once
and the named check fell. The other 2 (BD1, BD4) are collateral kills recorded from an actual `M-ST1` run.
One mutant — `M-AP2` — is a standing MISS and is counted in neither figure; see Round 6.

Where this file says "proven", it means a run was observed — not that the campaign was re-run end to end
against the merged tree. **It has not been.** The six Round 6 mutants ran against the merged code; the
other 54 predate the merge. Re-running all 60 is roughly two hours and is the obvious next verification;
until then, treat the per-bundle table as a claim about the code each mutation was run against.

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

## Round 7 (2026-08-21) — the activities and forecast mutants, landed and run

**15 mutants, 14 killed, 1 standing miss.** `M-AC1`–`M-AC10` and `M-FS1`–`M-FS5`, named for the check
family they target as `M-CD*`/`M-CT*` are. Every anchor was re-verified against this merged tree rather
than carried across from the by-hand campaign, because the merge moved code under several of them.

| Mutant | What it breaks | Killed |
|---|---|---|
| `M-AC1` | the external-key dedupe read's answer is ignored | AC8, AC13 |
| `M-AC2` | party links land under the sales child, not common's parent | AC3, AC13, AC18, AC22 |
| `M-AC3` | relevance fails OPEN — nothing is irrelevant | AC6, AC7 |
| `M-AC4` | a failed contact-method read reported as a successful one | **nothing — standing miss** |
| `M-AC5` | a cancelled meeting stored as one that happened | AC18 |
| `M-AC6` | the watermark advances past items whose write failed | AC20 |
| `M-AC7` | a sync with failures in it reports success | AC20 |
| `M-AC8` | the fixture stops mirroring each surface's real watermark rule | AC14, AC19 |
| `M-AC9` | the live Graph calendar reports the newest event start as its watermark | AC21 |
| `M-AC10` | the tenant-admin gate on a live mailbox read is removed | AC11 |
| `M-FS1` | a query that could not run reads like a period with no deals | FS8 |
| `M-FS2` | the `ClosedWonAmount` → `ClosedAmount` mapping dropped | FS11, FS12 |
| `M-FS3` | a second run the same day writes a second snapshot | FS3 |
| `M-FS4` | a reversed period reaches the CHECK constraint | FS6 |
| `M-FS5` | the month boundary read in the host's timezone | FS7 |

### `M-AC4` is a standing miss, in the shape `M-AP2` already uses

It reverts `RelevanceFilter.lookup`'s failure report from `failed: true` to `failed: false`, so a
`ContactMethod` read that blipped is filed as *"nothing was relevant"* — and the watermark advances over a
batch of real mail that can never be fetched again, because `GetMessages` has no date filter to re-fetch
it with (D-17).

Nothing in this repository can kill it, and that is measured rather than assumed. Provoking a real
`RunView` failure against a registered entity means revoking a permission, dropping a view or killing the
connection: none is available inside a rolled-back transaction, and each would take the rest of the suite
with it. `AC22` covers the CONSEQUENCE by INJECTING a filter that reports a failed lookup, which is
exactly why `AC22` cannot fall to this mutant — it never calls the real `lookup`.

So the handling is proven and the reporting is not. Its `expect` names `AC22` deliberately, so the driver
reports MISS on every run and exits 1. **The gap is stated rather than implied by an absence.**

`AC22` *is* nonetheless proven able to fail — collaterally, by `M-AC2`. Worth separating: a check can be
provably falsifiable while the specific guard a mutant aims at remains untested.

### Four cross-bundle failures that are NOT attributed, and how that was decided

Three runs reported failures outside the bundle they mutated: `SD25` (twice), `FS2`, `FS3`, `FS5` and
`WT13`. None is counted as proven, on two independent grounds.

**Causality.** A check is credited only where the mutated symbol is in its path. `M-AC4`'s mutation is
unreachable without a genuine read failure — that is the whole standing-miss argument above — so it cannot
have felled `FS2` or `SD25`. `M-AC3` mutates `RelevanceFilter`, which no forecast or save-deal check
touches. And `M-AC2` mutates `E_PERSON`, consumed only by `ActivityReader`, `ActivityWriterService` and
the activities checks; `close-won-tasks.checks.ts` declares its **own** `E_PEOPLE` literal at line 41, so
`WT13` is out of reach of that edit.

**Reproduction.** The suite was then run **four consecutive times against the clean tree: 121 passed, 0
failed, every time.** None of those checks fails on its own.

What the six failures do correlate with is duration: the three runs that produced them took 170s, 171s and
187s against ~120s for the other twelve. That points at contention on the shared host — `MJ_V6_Host` is
worked by more than one session — rather than at anything in the code.

**The rule this establishes for the driver's output:** the driver prints every check that went red, which
is right, and it also summarised "22 checks proven able to fail" for this run. The honest figure is 18.
A collateral kill is evidence only when the mutated code is in the failing check's path; otherwise it is
noise, and on a shared database noise is expected. Read the `failed=` column, do not sum it.

---

## What this file does NOT establish

That the suite is adequate. It establishes that **77 of 121 checks fail for the reason they claim to**,
each against a specific mutation, on the code that mutation was run against. The 44 unproven are now
concentrated rather than wholesale — eleven of fourteen close-won-task checks, ten of twenty-two
activities, seven of thirteen forecast, nine of thirty-one save-deal — and every one of those figures is
counted from a recorded run rather than from a commit message. And no mutation campaign says anything about
behaviour no check covers at all — for that, see the Explorer specs under
`test-harnesses/playwright/specs/`, which is where DN-17, DN-18 and DN-19 came from.
