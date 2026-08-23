# Pipeline board + QA docs — run report

**Both tracks complete.** Two docs for Andrew, and the pipeline board on a new branch with four local
commits, `verify` green, 16/16 integration checks, and the board **visually verified end-to-end** including
a real drag that persisted and wrote correct provenance.

**The one thing to look at first:** `BOARD-DECISIONS.md` **D-BD1** — MJ has **no generic kanban component**
at v5.51.0, contradicting both the brief and CLAUDE.md. Evidence is in that entry. The board lays out its
own columns but uses `@angular/cdk/drag-drop`, already this package's drag primitive. **D-BD2** is the
second: the stage event is appended in `Sales.SaveDeal` rather than `DealEntityServer.Save()`, to avoid a
double-stamp collision with `feature/close-flow`, and that has a stated cost.

---

## Track 1 — the two QA docs

Written as **untracked** files for you to commit:

| File | What it covers |
|---|---|
| `docs/QA-GUIDE.md` | Prerequisites, MJ core `v5.51.0`, a full `.env` template, ports, build→seed→run, the four traps that cost an afternoon, automated checks with **expected counts per branch**, eight manual test scenarios (dashboard, roster, create, panes, order-readiness, close, **board**, regression), and **ten known limitations testers must not file as bugs** |
| `docs/consolidation-notes.md` | The `__mj_BizAppsSales` schema, **five** soft references, the product-identity blocker, the two IS-A relationships to common, what it reads from MJ core, UUID alignment in four parts, ports/app registration, and a summary of what sales needs from each sibling |

Two things I found while writing them rather than assuming:

- **Five soft references, not two.** The brief named `Deal.ContractID` and `DealLine.ProductID`; the schema
  also has `Deal.RenewsContractID`, `Deal.CurrencyID` and `Deal.CampaignID` with no FK. All five are in the
  notes.
- **The IS-A relationships are the tightest coupling sales has**, and they force UUID sharing:
  `SalesAccount.ID` **is** `Organization.ID` with a real FK on the primary key. If common is re-seeded with
  new UUIDs in a consolidated environment, every `SalesAccount` orphans — and because the FK is on the PK it
  surfaces as a failed migration rather than silent drift. Seed common before sales.

---

## Track 2 — the pipeline board

Branch **`feature/pipeline-board`**, cut from `s0-s1-bootstrap-and-baseline-schema`. Four commits, authored
as Josue, no co-author trailer, **no upstream — never pushed**.

```
1a405f1  chore(sales): changeset for the pipeline board
97566eb  test(sales): board-move BD1-BD4 for stage-transition provenance
a242463  feat(ui): pipeline board as a Board rail page in the Deals section
24a7fe8  feat(sales): append a DealStageEvent when Sales.SaveDeal sees a stage change
```

### Results

| Check | Result |
|---|---|
| `npm run verify` | **exit 0** — vocabulary gate clean (10 server files), **build 8/8** |
| `RUN_MUTATION_TESTS=1 npm run test:integration` | **16/16** — 12 `save-deal` + 4 `board-move`, 0 failed, 0 skipped |
| Schema change | **none** — every column already existed, verified against the live schema first |
| Visual verification | **done**, including a real move (below) |

**That all 12 pre-existing `save-deal` checks still pass is the load-bearing result**, because commit
`24a7fe8` wraps `Sales.SaveDeal` in an explicit transaction. Without those 12 staying green, the wrap would
be plausible rather than safe.

### What shipped

- **A `Board` page** in the Deals rail between All deals and Workspace, with a `Description` like its
  siblings. Columns are the selected pipeline's `PipelineStage` rows by `DisplayOrder`; a **B2B / D2C**
  switcher picks the pipeline.
- **Cards** carry name, customer, amount, probability, owner and expected close, and **open the deal in the
  workspace** through the section's existing `OpenDeal` — one path, not two.
- **Column headers** show a count and `SUM(Deal.Amount)` over that column's cards. Deals with no amount are
  counted separately as `+N unpriced`, so a partial total says so rather than reading as a smaller one. The
  sum is per **deal**, never across `DealTeamMember` — the attribution double-count trap.
- **Drag to move** applies the target stage's probability and forecast defaults (still editable), exactly as
  the workspace's own `ApplyStageDefaults` does, and appends the stage event.
- **Drag-to-close is refused.** A stage whose `DealStatusType.LocksDeal` is set renders dashed, inert, with a
  lock icon and an explanatory title; the refusal is enforced in **two** places (the CDK enter-predicate and
  the drop handler). Nothing here calls `Sales.CloseDeal` or the orders/contracts seams.
- **Deals with no stage** get a "No stage set" chip row, because on a stage-column board they would otherwise
  be invisible — and invisible is indistinguishable from deleted.
- Semantic `--mj-*` tokens only, no hardcoded colour; horizontal scroll on the column strip, not the page.

### Provenance — the part that needed building

The base branch stamped **nothing** on a stage change; `DealEntityServer` only had a comment saying S4
would. So `Sales.SaveDeal` now appends an append-only `DealStageEvent` when it sees the stage change, sharing
**one explicit transaction** with the save so a move cannot land without its provenance.

The stamps are the **departure** values, not the current ones. A drag applies the target stage's probability
on arrival, so reading `deal.Probability` at append time would record the number the deal acquired *by
arriving*. `BD2` exists to pin exactly that, and the live UI run confirmed it (below).

### Visual verification — measured, not asserted

Servers run from an isolated worktree so the board was genuinely in the bundle. Playwright with the saved
MSAL session, headless:

- **6 columns** on B2B: `Discovery · Qualification · Proposal · Negotiation · Signed · Lost`, headers
  `0 $0 · 1 $42,000 · 1 $96,000 · 1 $185,000 · 1 $64,000 · 1 $15,000`.
- **Pipeline switch works**: B2B's six stages → D2C's `Introduced · Evaluating · Booked`.
- **2 closing columns** detected — `Signed` and `Lost` — via the `LocksDeal` flag, rendered dashed with the
  lock icon.
- **A card** read: *"Cascade Manufacturing — Pilot · Cascade Manufacturing · $42,000 · 25% · Local Developer
  · Nov 14, 2026"* — all six fields.
- **A real drag**, Qualification → Discovery: headers became `Discovery 1 $42,000 · Qualification 0 $0`; the
  total followed the card. **It survived a full page reload**, so it persisted rather than only moving in the
  DOM. Dragged back afterwards, restoring the seeded state.
- **The database confirms the provenance**, two events for two moves:

  ```
  Qualification -> Discovery | amt=42000 | prob=25.00
  Discovery -> Qualification | amt=42000 | prob=10.00
  ```

  The second event stamping **10** is the departure-value rule working in the real UI: 10 is what the deal
  held while sitting in Discovery, not the 25 it reacquired by arriving back in Qualification.
- Console errors: only two pre-existing unrelated resource failures (a 403 and a 404), present on other pages
  too. Nothing from the board.

**Screenshots: `C:\Users\josue\Downloads\pipeline-board-verification\`** — six files:

| File | Shows |
|---|---|
| `01-board-b2b.png` | the board as it opens, in the shell with the rail |
| `02-columns-full-strip.png` | **all six columns** including `Signed`/`Lost` past the fold, with their locks |
| `03-card-detail.png` | one card's six fields close up |
| `04-closing-column-locked.png` | a closing column: dashed, inert, lock icon |
| `05-board-d2c.png` | the D2C pipeline's three different stages |
| `06-rail-with-board.png` | Board's place in the rail |

I lost the first capture by deleting the worktree before copying the files out, then rebuilt and
re-captured rather than leave a requested artifact missing. The second pass is deliberately read-only — no
drag — because the move was already proven in the first run and there was no reason to write again.

---

## Decisions queued (full text in `BOARD-DECISIONS.md`)

| | Decision |
|---|---|
| **D-BD1** | **MJ has no generic kanban at v5.51.0** — evidence included; board lays out columns, drag via `@angular/cdk/drag-drop` already used in this package |
| **D-BD2** | Stage event appended in `Sales.SaveDeal`, **not** `DealEntityServer.Save()`, to avoid double-stamping with close-flow — **with a stated cost and a recommended follow-up** |
| D-BD3 | The board is a rail page, not its own section |
| D-BD4 | A move reuses `LoadDraft` + `Save` rather than a new `Sales.MoveDealStage` op — avoids a CodeGen run against a drifted DB |
| D-BD5 | Closing columns shown disabled, not hidden; **"close from board" queued for design, not built** |
| D-BD6 | Deals with no stage get their own chip row |
| D-BD7 | Column totals label their own incompleteness (`+N unpriced`) |
| D-BD8 | The `AmountIsComputed` provenance marker is carried onto the card |
| D-BD9 | No schema change, and none was needed |
| D-BD10 | Column recomputation is not memoized |

---

## Machine state — everything intact

- **Dev DB `MJ_BizAppsSales`: working and seeded.** Never rebuilt, never dropped. Verified after teardown:
  **6 deals · 2 pipelines · 9 stages · 3 deal lines · 0 leftover test deals** (everything the integration
  suite wrote rolled back). `Cascade Manufacturing — Pilot` is back in `Qualification`, its seeded stage.

  The only net additions are **two `DealStageEvent` rows**, and that is checkable rather than asserted: the
  table holds 7 events, 5 dated May–July from the seeds and exactly 2 dated today — the append-only history
  of my two verified drags, which is precisely what that table exists to record.
- **Working tree: untouched.** All board work happened in an isolated worktree, so the known drift
  (regenerated files, CRLF churn, untracked `AutomationRule*` form dirs) is exactly as I found it. I never
  ran `git add .`, and no CodeGen was run at all this session.
- **`plans/` and every report/decisions doc: present** — `plans/`, `CLOSE-FLOW-*`, `PRODUCT-REF-*`, plus the
  new `BOARD-DECISIONS.md` and this file, and the two new `docs/` files.
- **All branches intact and untouched:** `s0-s1…` `a7f34e5`, `feature/close-flow` `2ed66f7`,
  `feature/deal-line-product-ref` `65b9ec9`, `feature/automation-rules` `3a03e39`, plus the new
  `feature/pipeline-board` `1a405f1`.
- **I pushed nothing.** `feature/pipeline-board` has **no upstream**. Note for accuracy: `close-flow`,
  `deal-line-product-ref` and `automation-rules` now *do* have upstreams at exactly my commit SHAs — **you
  pushed those between sessions**; my reflog contains only commits and checkouts.
- **Servers restored** on 4141/4341 from the main repo, as they were running when I started. The temporary
  worktrees are removed.

### To see the board yourself

```bash
git worktree add /c/Dev/board feature/pipeline-board   # short path: Windows MAX_PATH bites in deep temp dirs
cd /c/Dev/board && npm ci && npm run build
cp ../MJ/bizapps-sales/.env . && cp ../MJ/bizapps-sales/.env apps/MJAPI/.env   # .env is gitignored
npm run start:api & npm run start:explorer:msal
```

Then `/app/sales` → **Board**. Stop the main-repo servers first, or the ports collide.

## Suggested next steps

1. **Rule on D-BD1** — if a generic kanban is coming in MJ 5.52+, `lib/board/` is deliberately isolated so
   it is cheap to throw away.
2. **Rule on D-BD2**, and if you agree, move the stamping into `DealEntityServer.Save()` *after* close-flow
   merges and delete `CloseDealOperation`'s own append, so there is one writer.
3. Decide the **"close from the board"** design (D-BD5).
4. Commit the two `docs/` files.
