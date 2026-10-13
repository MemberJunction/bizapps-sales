# Mutation evidence — which integration checks have been shown able to FAIL

`test-harnesses/mutate-checks.mjs` breaks one piece of product code, rebuilds, runs the whole
integration suite, and restores the file. It prints one line per mutant: `OK` (every check it declares
fell), `MISS` (a declared check stayed green) or `INCOMPLETE` (the suite printed no tally), each with
`failed=`, `expect=` and the suite's tally — or a skip, when the anchor did not match, the build failed,
or the build left `dist/` unchanged.

Nothing writes this file. After a run, copy each mutant's result into the table below with the commit it
ran against and the date. `node test-harnesses/mutate-checks.mjs --list` prints the registry the table
follows, with full file paths. The round-by-round narratives behind these results are in this file's
history, last at commit `fe8d94a`.

## State at `eab0dda`

| | |
|---|---|
| Checks registered | **150** in 10 bundles (`scripts/expected-check-counts.json`) |
| Mutants registered | **96** |
| Last full campaign | 2026-08-21/22: 68 mutants against a 121-check suite. It recorded totals, not per-mutant results, and its commit (`6d3add4`) is not in this repository |
| Since then | single mutants only, recorded below |
| Checks no mutant declares | **59** of 150, listed below the table |

## Per mutant

The latest itemized run of each mutant; **—** means none is itemized. "Fell" lists every check that
went red, declared or not. Tallies from September runs include twelve checks that failed on that host
with nothing mutated: AC6, AC8, AC12, AC13, AC16, AC19, CT1, CT5, CT6, SD6, WT10 and WT14.

| Mutant | File | Declares | Last recorded run |
|---|---|---|---|
| `M-PP1` | `product-filter.ts` | PP1 | — |
| `M-PP2` | `product-filter.ts` | PP2 | — |
| `M-TS1` | `term-start.ts` | TS1 | — |
| `M-TS2` | `term-start.ts` | TS3 | — |
| `M-TS3` | `term-start.ts` | TS1 | — |
| `M-TS4` | `term-start.ts` | TS3 | — |
| `M-TS5` | `term-start.ts` | TS2 | — |
| `M-TS6` | `term-start.ts` | TS4 | — |
| `M-PP3` | `product-filter.ts` | PP3, PP4 | — |
| `M-SD2` | `DealEntityServer.ts` | SD2 | — |
| `M-SD3` | `DealEntityServer.ts` | SD3 | — |
| `M-SD8` | `deal-entity.ts` | SD8 | — |
| `M-SD9` | `SequenceService.ts` | SD9 | — |
| `M-SD10` | `DealEntityServer.ts` | SD10 | — |
| `M-SD11` | `SequenceService.ts` | SD11 | — |
| `M-SD15` | `DealEntityServer.ts` | SD15 | — |
| `M-SD18` | `DealEntityServer.ts` | SD18 | — |
| `M-CD1` | `CloseDealOperation.ts` | CD1 | — |
| `M-CD2` | `CloseDealOperation.ts` | CD2, CO1 | — |
| `M-CD4` | `DealEntityServer.ts` | CD4 | OK — fell BD2, CD20, CD4 · `b9e73d4`, 2026-08-23 |
| `M-CD5` | `DealEntityServer.ts` | CD5, CD13, CD14 | OK — 124 passed, 16 failed · `a9bc0e0`, 2026-09-17 |
| `M-CD6` | `DealEntityServer.ts` | CD6, CD14 | OK — 125 passed, 15 failed · `a9bc0e0`, 2026-09-17 |
| `M-CD7` | `downstream-seams.ts` | CD7 | — |
| `M-CD8` | `CloseDealOperation.ts` | CD8 | — |
| `M-CD9` | `CloseDealOperation.ts` | CD9 | — |
| `M-CD10` | `CloseDealOperation.ts` | CD10 | — |
| `M-CD11` | `CloseDealOperation.ts` | CD11 | — |
| `M-CD13` | `DealEntityServer.ts` | CD13 | OK — fell CD13, CD28 · 2026-09-17, no SHA |
| `M-CD29` | `DealEntityServer.ts` | CD29 | — |
| `M-CD30` | `DealEntityServer.ts` | CD30 | — |
| `M-CD28` | `DealEntityServer.ts` | CD28 | OK — fell CD28 alone · 2026-09-17, no SHA |
| `M-CD26` | `DealEntityServer.ts` | CD26 | OK — 127 passed, 13 failed · `2e79c37`, 2026-09-16 |
| `M-CD27` | `DealEntityServer.ts` | CD27 | OK — 126 passed, 14 failed · `2e79c37`, 2026-09-16 |
| `M-CD14` | `DealEntityServer.ts` | CD14 | — |
| `M-OS1` | `DealEntityServer.ts` | CO3, CO5 | OK — fell CO3, CO5, SD25 · `b9e73d4`, 2026-08-23 |
| `M-OS2` | `DealEntityServer.ts` | CO3 | — |
| `M-AM1` | `DealEntityServer.ts` | SD21 | — |
| `M-AM2` | `DealEntityServer.ts` | SD41 | OK — 127 passed, 13 failed · `a9bc0e0`, 2026-09-16 |
| `M-AM3` | `DealEntityServer.ts` | SD22, SD23 | OK — 123 passed, 17 failed · `a9bc0e0`, 2026-09-16 |
| `M-OS3` | `DealEntityServer.ts` | CO5 | — |
| `M-PV1` | `DealEntityServer.ts` | SD24 | — |
| `M-PV2` | `DealEntityServer.ts` | SD25 | — |
| `M-OW1` | `DealEntityServer.ts` | SD26 | — |
| `M-WT1` | `CloseDealOperation.ts` | WT11 | OK — fell WT11 alone · `b9e73d4`, 2026-08-23 |
| `M-BD1` | `DealEntityServer.ts` | BD5 | — |
| `M-BD2` | `DealEntityServer.ts` | BD2 | OK — fell BD2, SD31, SD33 · `b9e73d4`, 2026-08-23 |
| `M-BD3` | `DealEntityServer.ts` | BD6 | OK — fell BD2, BD6 · `b9e73d4`, 2026-08-23 |
| `M-TK1` | `CloseDealOperation.ts` | WT13 | — |
| `M-TK2` | `CloseDealOperation.ts` | WT14 | — |
| `M-LK1` | `DealEntityServer.ts` | SD27 | — |
| `M-DN1` | `DealEntityServer.ts` | SD29 | — |
| `M-ST1` | `DealEntityServer.ts` | CD4, CD15, BD2 | OK — fell BD1, BD2, BD4, CD4, CD11, CD15, CD16 · 2026-08-21, no SHA |
| `M-ST2` | `DealEntityServer.ts` | SD32 | OK — fell SD32 · 2026-08-21, no SHA |
| `M-ST3` | `DealEntityServer.ts` | CD16 | OK — fell CD16 · 2026-08-21, no SHA |
| `M-ST4` | `DealEntityServer.ts` | SD30 | OK — fell SD30 · 2026-08-21, no SHA |
| `M-OW2` | `DealEntityServer.ts` | SD31 | OK — fell SD31 · 2026-08-21, no SHA |
| `M-ST5` | `DealEntityServer.ts` | SD33 | OK — fell SD33 · 2026-08-21, no SHA |
| `M-ST6` | `DealEntityServer.ts` | SD34 | OK — fell SD34 · 2026-08-21, no SHA |
| `M-RO1` | `CloseDealOperation.ts` | CD18 | OK — fell CD18 · 2026-08-21, no SHA |
| `M-RO2` | `CloseDealOperation.ts` | CD18 | OK — fell CD18 · 2026-08-21, no SHA |
| `M-ST8` | `DealEntityServer.ts` | SD35 | OK — fell SD35 · 2026-08-21, no SHA |
| `M-AP1` | `DealEntityServer.ts` | CD20 | — |
| `M-AP2` | `DealEntityServer.ts` | CD20 | MISS, standing: CD20 saves the flag before closing, so it cannot see this mutation (the note in the driver) · 2026-08-21, before the dist-change guard |
| `M-DA1` | `CloseDealOperation.ts` | CD21 | — |
| `M-DA2` | `CloseWonTaskService.ts` | CD21 | — |
| `M-CS1` | `CloseDealOperation.ts` | CD22 | — |
| `M-CS2` | `CloseDealOperation.ts` | CD22 | — |
| `M-WT3P` | `CloseWonTaskService.ts` | WT3 | — |
| `M-WT2R` | `CloseWonTaskService.ts` | WT2 | MISS · 2026-08-24, not a measurement: the run tested unmutated code. Applied by hand it fell WT1, WT2, WT3, WT9, WT10, CD23 |
| `M-WT7S` | `CloseWonTaskService.ts` | WT7 | — |
| `M-WT5F` | `CloseWonTaskService.ts` | WT5 | — |
| `M-WT6T` | `CloseWonTaskService.ts` | WT6 | MISS · 2026-08-24, before the dist-change guard; re-run before quoting it |
| `M-WT8O` | `CloseWonTaskService.ts` | WT8 | — |
| `M-WT12C` | `CloseWonTaskService.ts` | WT12 | — |
| `M-RB1` | `CloseDealOperation.ts` | CD24 | — |
| `M-RB2` | `CloseDealOperation.ts` | CD24 | — |
| `M-DS1` | `DealEntityServer.ts` | SD36 | — |
| `M-DS2` | `DealEntityServer.ts` | SD37 | — |
| `M-DS3` | `DealEntityServer.ts` | — (`expectMiss`) | Expected to miss on seeded data: the driver reports EXPECTED-MISS, and UNEXPECTED-HIT (exit 1) once an open-and-locking status is seeded |
| `M-ST7` | `CloseDealOperation.ts` | CD17 | OK — fell CD4, CD5, CD13, CD14, CD17, CD18, CD20 · `b9e73d4`, 2026-08-23 |
| `M-TN1` | `CloseWonTaskService.ts` | WT15 | OK — fell WT15 alone · `9724489`, 2026-08-23 |
| `M-TL1` | `CloseWonTaskService.ts` | WT16 | OK — fell WT16 alone · `9724489`, 2026-08-23 |
| `M-WT1O` | `CloseWonTaskService.ts` | WT1 | OK — fell WT1, WT10, WT13 · `9724489`, 2026-08-23 |
| `M-WT4L` | `CloseWonTaskService.ts` | WT4 | OK — fell WT4, WT14 · `9724489`, 2026-08-23 |
| `M-CT1` | `LiveContractsSeam.ts` | CT4 | — |
| `M-CT2` | `LiveContractsSeam.ts` | CT5 | — |
| `M-CT4` | `LiveContractsSeam.ts` | CT8 | — |
| `M-CT5` | `LiveContractsSeam.ts` | CT8 | — |
| `M-CT3` | `CloseDealOperation.ts` | CT6 | — |
| `M-RI1` | `CloseDealOperation.ts` | CD23 | OK — fell CD23 alone · `33dd263`, 2026-08-23 |
| `M-RI2` | `CloseDealOperation.ts` | CD23 | OK — fell CD23, CD7 · `33dd263`, 2026-08-23 |
| `M-AC1` | `ActivityWriterService.ts` | AC8, AC13 | OK — fell AC8, AC13 · 2026-08-21, no SHA |
| `M-AC2` | `activity-vocabulary.ts` | AC3, AC13 | OK — fell AC3, AC13, AC18, AC22 · 2026-08-21, no SHA |
| `M-FS1` | `ForecastSnapshotJob.ts` | FS8 | OK — fell FS8 · 2026-08-21, no SHA |
| `M-FS2` | `QueryForecastSource.ts` | FS11, FS12 | OK — fell FS11, FS12 · 2026-08-21, no SHA |
| `M-FS3` | `ForecastSnapshotJob.ts` | FS3 | OK — fell FS3 · 2026-08-21, no SHA |
| `M-FS4` | `ForecastSnapshotJob.ts` | FS6 | OK — fell FS6 · 2026-08-21, no SHA |
| `M-FS5` | `ForecastSnapshotJob.ts` | FS7 | OK — fell FS7 · 2026-08-21, no SHA |

A `MISS` recorded before the dist-change guard landed (2026-08-24) is suspect: until then a run could
measure unmutated code and report a miss. `OK` results are unaffected, because a kill shows the mutation
reached the running code.

## Checks no mutant declares

| Bundle | Checks |
|---|---|
| `save-deal` | SD1, SD6, SD7, SD13, SD14, SD17, SD19, SD20, SD28, SD38, SD39, SD40 |
| `close-deal` | CD3, CD12, CD19, CD25, CD31, CD32, CD33, CD34, CD35 |
| `product-picker` | PP5 |
| `close-won-order` | CO2, CO4 |
| `close-won-contract` | CT1, CT7 |
| `board-move` | BD1, BD3, BD4 |
| `close-won-tasks` | WT9, WT10 |
| `activities` | AC1, AC2, AC4, AC5, AC6, AC7, AC9, AC10, AC11, AC12, AC14, AC16, AC18, AC19, AC20, AC21, AC22, AC23 |
| `forecast` | FS1, FS2, FS4, FS5, FS9, FS10, FS13, FS14 |
| `term-start` | TS5, TS6 |

Some of these have fallen under a mutant aimed elsewhere — BD1 and BD4 under `M-ST1`, SD28 under
`M-AM3`. By the counting rule below that is the weaker claim until a mutant declares them. An analysis of
which sales-owned branch a mutant could aim at for most of them, and which cannot be reached by mutating
sales source at all, is in this file's history at commit `e10c78a`.

---

## The counting rule

**"Proven" means a mutant DECLARED that check and that check then fell.** Nothing else counts. A
mutation disturbs the whole suite: `M-ST1` doubles every stage event and fells seven checks having been
aimed at three. Counting every failure as proof asserts that the mutated code is on each failing check's
path, which is exactly what has not been established.

The driver reports the two separately:

```
  N mutations ran · N checks proven able to fail (declared and fell) · N isolated exactly one
  + N more fell as COLLATERAL -- a weaker claim, since the mutation was not aimed at them
```

**When a collateral kill matters, promote it deliberately:** read the `failed=` column, confirm the
mutated code is on that check's path, and give the check a mutant of its own. Read `failed=` per mutant;
do not sum it. Every result in this file carries the commit it was measured against, or says it has
none: a figure without one describes no tree in particular.

## What this file does NOT establish

That the suite is adequate. An `OK` here shows that the checks a mutant declares fail for the reason
they claim, against that one mutation, on the commit it ran against. Most recorded runs predate the
current tree, and 59 of the 150 checks have no declared mutant. And no mutation run says anything about
behaviour no check covers — for that, see the Explorer specs under `test-harnesses/playwright/specs/`
(`COVERAGE-MAP.md`).
