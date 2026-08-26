# Integration log — which branch heads each integration consumed

## Why this file exists

**A merge captures a moment, not a branch.** Twice now an integration has been reported complete against
branch *names* while the branches had moved on, and both times the gap was invisible from inside the
result: the suite was green, the build was clean, and the tree was simply missing work nobody could see
was absent.

* The first integration merged `feature/contracts-seam-v6` at `ba07f7e` and was later re-merged at
  `a41473f` for drift.
* The second reported **81/81 green while missing both halves of #40** — the 13 MJ Queries and the
  ForecastSnapshot job. Green, and incomplete, with nothing in the repo that could have said so.

A green suite cannot detect work that never arrived. What can is a written record of the exact commit each
integration consumed, so the next one is a diff against a stated baseline rather than a guess. That is all
this file is.

## How to use it

**Before an integration**, for each branch you intend to merge:

```bash
git log --oneline <consumed-sha>..<branch>      # nothing = you already have it
git diff --stat <consumed-sha> <branch> | tail -1
```

**After it**, add a row per branch with the head you actually merged — `git rev-parse` it, do not copy it
from the instruction you were given, because that is the step that failed twice.

**State the expected shape and check it.** Not "the suite is green" but *how many checks in how many
bundles*, and for anything that ships as metadata, *how many files*. Both misses above would have been
caught by one count. `node scripts/assert-check-count.mjs` runs the suite and asserts the per-bundle
counts against `scripts/expected-check-counts.json`; it does not know what a merge was supposed to bring,
which is why the expected shape belongs here in writing.

> ⚠️ **`ls metadata/queries/` shows almost nothing.** Every metadata definition is a **dotfile**
> (`.deal-roster.json`), so a plain `ls` hides all 13 and the directory looks like a README and an empty
> SQL folder. Use `ls -a`. This produced a false alarm during integration 3 — the opposite failure to the
> one this file exists to prevent, and just as expensive.

---

## Integration 4 — 2026-08-21, onto `feature/embed-order-on-deal`

Four merges. Two were re-merges of heads that had moved again since integration 3; two were branches this
session had not been told about until they were ready.

| # | Branch | Head consumed | Brought |
|---|---|---|---|
| 1 | `feature/closewon-tasks` | `fbf414d` | WT12 (the `Code` lookup), tasks PR #42 on the host |
| 2 | `feature/forecast-query-source` | `d348a88` | `QueryForecastSource` proven, FS11–FS13, the capture script demoted to a manual tool |
| 3 | `feature/dashboard-queries` | `172a6d8` | The dashboard on MJ Queries, `Sales: Dashboard Summary`, `Sales: Forecast by Owner` |

(Three rows, four merges: `closewon-tasks` also appears in integration 3 at `187c8a4`.)

### Expected shape, stated before measuring — and how it was derived

This is the part worth copying. Neither branch's own total could be used directly, because both predated
the WT11/WT12 rename and so reported `close-won-tasks` as 11 where this tree has 12:

| Branch | Its own reported total | Difference from this tree | What it actually adds |
|---|---|---|---|
| `dashboard-queries` @ 172a6d8 | 92 | −1, entirely `close-won-tasks` 11 vs 12 | **0 checks** |
| `forecast-query-source` @ d348a88 | 95 | +3 −1 on the same basis | **exactly 3** (FS11–FS13) |

So: 93 + 0 + 3 = **96 across 9 bundles**, with `forecast` 10 → 13 and `close-won-tasks` staying 12.

| Claim | Expected | Measured |
|---|---|---|
| Integration checks | 96 | **96**, 0 failed, 0 skipped |
| Bundles | 9 | **9** |
| `forecast` bundle | 13 | **13** |
| `close-won-tasks` bundle | 12 | **12** |
| `metadata/queries/` definitions | 15 | **15** (`ls -a`) |
| `metadata/queries/SQL/` files | 15 | **15** |
| Dashboard measure agreement | 11 comparisons | **11 agree, 0 differ**; 213,720 priced + 37,500 stated = 251,220 |

The manifest auto-merged to exactly 96 without a hand edit, which is the first time the arithmetic and the
merge agreed with no intervention.

### Verified rather than assumed, because assuming has cost twice

* **`scripts/capture-forecast-snapshot.sql` did not conflict**, and was checked anyway — it still carries
  the demoted `NOT THE FORECAST SNAPSHOT WRITER. A MANUAL TOOL, DELIBERATELY UNSEEDED` header, so the
  pre-demotion copy did not come back in.
* **The three metadata files both sessions touched were read**, not trusted to agree.
* **A rename the merge would have left stale:** `UnweightedWonAmount` → `WonAmountOfDealsTouched`. Two
  places outside the query cited the old name and now cite the new one. A comment naming a column that
  does not exist is exactly how the `AttributionCoveragePct` problem started.

---

## Integration 3 — 2026-08-20, onto `feature/embed-order-on-deal`

Five merges. The last two exist because the first three consumed heads that had already moved.

| # | Branch | Head consumed | Brought |
|---|---|---|---|
| 1 | `feature/closewon-tasks` | `187c8a4` | `CloseWonTaskService`, WT1–WT10, TaskType metadata |
| 2 | `feature/contracts-seam-v6` | `a41473f` | The route proof and the seam proof harnesses |
| 3 | `feature/activities-and-ingest` | `1db90c9` | S-US9 activities, the Outlook ingest, AC1–AC17 |
| 4 | `feature/contracts-seam-v6` | `01b4437` | **The 13 MJ Queries** — #40's read-model half, plus `query-categories` |
| 5 | `feature/activities-and-ingest` | `99be05b` | **ForecastSnapshot daily job**, FS1–FS10, AC18, and the D-25 fix |

Merges 2 and 3 were themselves re-merges: merge 2 replaced an earlier `ba07f7e`, and both were superseded
within the same session by 4 and 5. **Three of five merges in this integration were corrections for a
moved head.** That ratio is the argument for this file.

### Expected shape after integration 3, and what was measured

| Claim | Expected | Measured |
|---|---|---|
| Integration checks | ~92 | **92**, `0 failed, 0 skipped` |
| Check bundles | 10 (as briefed) | **9** — see below |
| `metadata/queries/` definitions | 13 | **13** (`ls -a`, excluding `.mj-sync.json`) |
| `metadata/queries/SQL/` files | 13 | **13** |
| `metadata/query-categories/` | present | present |
| Query rows in the database | 13 | **13**, all `Approved`, 58 parameters, 184 fields, SQL 2.8k–4.8k chars each |

**The bundle count is 9, not the 10 briefed, and that is correct.** The tree holds the union: all eight
bundles on `99be05b` plus `close-won-tasks`, which does not exist on that branch. Nothing was dropped —
verified by comparing `git ls-tree -r 99be05b -- packages/IntegrationTests/src/checks` against the working
tree. `close-won-handoff` and `close-won-d2c` are **deliberately retired** (`2a95cf1`) and replaced by
`close-won-order`; a count that expects them will always be one or two high.

| Bundle | Checks | Requires |
|---|---|---|
| `save-deal` | 22 | orders |
| `close-deal` | 14 | orders |
| `product-picker` | 4 | orders |
| `close-won-order` | 5 | orders |
| `close-won-contract` | 4 | contracts |
| `board-move` | 4 | orders |
| `close-won-tasks` | 11 | tasks |
| `activities` | 18 | common |
| `forecast` | 10 | — |
| **total** | **92** | |

### Sibling repos this integration required

Beyond `bizapps-common`: **orders**, **contracts** and now **tasks**, all checked out at `/c/v6` and
**built**. `@mj-biz-apps/tasks-core` and `tasks-entities` are hard dependencies of
`sales-core-entities-server` as of merge 1, so this repo no longer builds without bizapps-tasks present.

### Known-incomplete, deliberately

* ~~**`metadata/task-types/` cannot be pushed.**~~ **RESOLVED — do not use `--exclude task-types`.**
  bizapps-tasks PR #42 is applied to `MJ_V6_Host`, `TaskType.Code` exists, and a full
  `mj sync push --dir metadata` runs clean. `CloseWonTaskService` resolves task types by `Code`, and the
  by-`Name` fallback with its warning is now the exception rather than the normal path.

  **Two things about HOW it was applied that outlive the fix, because they change what a later migration
  may assume.**

  **It is untracked in Flyway.** The column was added to this host by a bare `ALTER TABLE … ADD Code`; no
  schema-history row was fabricated for it, and that was deliberate rather than an oversight. A row under
  bizapps-tasks' versioning would claim a migration ran that did not; a row under MJ core's would assert
  MJ shipped something it has not. Both are false statements written into the one table whose job is to
  be true. **The consequence, stated so nobody meets it as a surprise:** a future MJ-core or tasks
  migration that adds `TaskType.Code` will FAIL on this host, because the column is already there and
  Flyway has no record explaining why. Whoever hits that should expect to baseline or skip it, not debug
  it.

  **It introduced two cross-schema foreign keys**: `FK_TaskType_OnCreateAction` and
  `FK_TaskType_OnStatusChangeAction`, both into `__mj.Action(ID)`. That is a dependency-graph change, not
  a detail — **the tasks schema now depends structurally on MJ core's `Action` table.** Anything that
  drops, recreates or reorders those objects has to account for it: a core rebuild that takes `__mj.Action`
  down before tasks is no longer safe in either order, and a schema-only restore of one without the other
  will fail on the constraint rather than on anything that names tasks.
* **`MJ: Query Parameters` inserts fail on re-push — A DIFFERENT PROBLEM FROM THE ONE ABOVE, AND STILL
  OPEN.** Read this bullet and the previous one together: there are now **two unrelated ways a push can
  fail**, and both surface as *the push failed*. The task-types exclusion is genuinely resolved and the
  flag must not be reintroduced. This one is not resolved and no flag avoids it.

  The push extracts parameters from the Nunjucks template in each query's SQL, then collides with the
  parameter declarations the metadata files carry themselves — a duplicate on
  `UQ_QueryParameter_QueryID_Name` — and **rolls the entire push back**. An MJ defect, not a defect in
  this repo's metadata.

  The queries and their parameters are in the database and complete, so nothing is broken for reading the
  reports. What is broken is CHANGING them: the file is the only correct copy and a push cannot carry an
  edit across. That is why `metadata/queries/SQL/slippage.sql`'s fix was applied by updating the live
  `Query.SQL` directly (DN-18/DN-19) — a workaround for THIS bullet, not evidence that the bullet above
  regressed. Worth knowing before anyone reads that failure as the
  queries not having landed — they have. Verify with a count, not with the push's exit code.

---

## Integration 2 — 2026-08-20, onto `feature/embed-order-on-deal`

Recorded retrospectively, because it is the one that went wrong and the shape of the error is the reason
this file exists.

| # | Branch | Head consumed | Brought |
|---|---|---|---|
| 1 | `feature/closewon-tasks` | `187c8a4` | The task service |
| 2 | `feature/contracts-seam-v6` | `a41473f` | The proof harnesses |
| 3 | `feature/activities-and-ingest` | `1db90c9` | Activities and the ingest |

Reported **81/81 green**, and it was — against a tree missing the 13 MJ Queries and the ForecastSnapshot
job, because heads 2 and 3 had already advanced past what was merged. No gate could have caught it. A
stated expected shape would have.
