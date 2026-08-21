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

* **`metadata/task-types/` cannot be pushed.** It declares `TaskType.Code`, a column this host does not
  have until bizapps-tasks PR #42 lands (`D-8`). `mj sync push --dir metadata` therefore fails validation
  on it; push with `--exclude task-types`. Until then `CloseWonTaskService` resolves task types by `Name`
  and says so out loud in a warning.
* **`MJ: Query Parameters` inserts fail on re-push.** The queries and their parameters are in the database
  and complete, but pushing again attempts to CREATE parameters that already exist, with fresh UUIDs, and
  dies inside MJ core's `spCreateQueryParameter`. Worth knowing before anyone reads that failure as the
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
