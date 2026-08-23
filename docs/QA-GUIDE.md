# BizApps Sales — QA guide

How to stand up bizapps-sales from a clean checkout and test it. Written for a tester who has not built
this app before.

**Read the "Known limitations" section before filing anything.** Several behaviours that look like bugs
are deliberate and documented — a stubbed downstream returning "not executed" is the app working
correctly, not failing.

---

## 1. Prerequisites

| Thing | Version / value | Notes |
|---|---|---|
| Node | **≥ 18** | `package.json` engines |
| SQL Server | 2019+ (or the `mj-sql` Docker container) | Local dev target is SQL Server; **production is Postgres** |
| MJ core | **`v5.51.0`** (`MJ_CORE_VERSION`) | Must satisfy `mj-app.json`'s `mjVersionRange`: `>=5.50.0 <6.0.0` |
| Database | `MJ_BizAppsSales` | Created by the rebuild script |
| bizapps-common | published on npm (`@mj-biz-apps/common-*`) | **No local checkout needed** — `.mj-links.json` is deliberately empty |

**You do not need bizapps-orders or bizapps-contracts.** Sales is standalone today; its downstream calls
are stubbed (§6).

### The workspace CLI rule

Always invoke the MJ CLI through the repo, never a globally installed `mj`:

```bash
npm run mj -- <command>          # correct
mj <command>                     # WRONG — a global CLI ships its own packages and cannot see this repo's
```

---

## 2. `.env`

One `.env` at the repo root. `apps/MJAPI/.env` is a **symlink** to it — do not create a second file
there.

```dotenv
# ── Database ────────────────────────────────────────────────────────────────
DB_PLATFORM=sqlserver
DB_HOST=localhost
DB_PORT=1433
DB_DATABASE=MJ_BizAppsSales
DB_USERNAME=sa
DB_PASSWORD=<your sa password>
DB_TRUST_SERVER_CERTIFICATE=true

# CodeGen connects separately — same credentials are fine locally.
CODEGEN_DB_USERNAME=sa
CODEGEN_DB_PASSWORD=<your sa password>

# ── MJ core ─────────────────────────────────────────────────────────────────
MJ_CORE_SCHEMA=__mj
MJ_CORE_VERSION=v5.51.0

# Where the sibling common repo lives, used by the rebuild script.
BIZAPPS_COMMON_REPO=../bizapps-common

# ── Ports ───────────────────────────────────────────────────────────────────
GRAPHQL_PORT=4141

# ── Auth (MJExplorer) ───────────────────────────────────────────────────────
MJ_API_KEY=<key>
TENANT_ID=<entra tenant id>
WEB_CLIENT_ID=<entra app client id>
```

`MJ_BASE_ENCRYPTION_KEY` is **not** set in local dev. You will see a boxed
`ENCRYPTION KEY VALIDATION FAILED` warning at API and test startup. It is **expected and non-fatal** —
nothing in sales uses an encrypted field. Ignore it.

### Ports

| Service | Port |
|---|---|
| MJAPI (GraphQL) | **4141** |
| MJExplorer | **4341** |

These are chosen to avoid every other MJ environment (core 4001/4201, common 4101/4301, accounting
4102/4302, orders 4103/4303, contracts 4151/4351). If 4141/4341 are busy, something else of yours is
running — do not just change the port, or the Explorer will point at the wrong API.

---

## 3. Build → seed → run

```bash
npm install                       # at the REPO ROOT, never inside a package

scripts/rebuild-db.sh             # drop + create, MJ core, bizapps-common, this app's DDL
npm run mj:codegen                # PASS 1 — entity metadata + SQL objects
scripts/append-codegen.sh         # fold generated SQL into the baseline migration
npm run mj -- sync push --dir metadata   # seed the type tables + remote-operation rows
npm run mj:codegen:files          # PASS 2 — FILES ONLY (--skipdb).  See the warning below.
npm run build                     # expect 8/8 turbo tasks

scripts/seed-dev-data.sh          # pipelines, stages, vocabulary, employees
scripts/seed-demo-data.sh         # the 6 demo deals
```

Then start the servers **and restart them after any rebuild**:

```bash
npm run start:api                 # 4141
npm run start:explorer:msal       # 4341  ← use the :msal variant for a human login
```

### Four traps that will cost you an afternoon

1. **CodeGen runs twice and pass 2 MUST be `--skipdb`.** A second *full* pass regenerates `vwDeals` with
   an extra virtual column but no matching `EntityField` row, after which **every Deal insert fails**
   with *"Column name or number of supplied values does not match table definition."* Use
   `npm run mj:codegen:files`.
2. **Restart BOTH servers after a rebuild.** They cache entity metadata at startup, and a rebuild
   re-mints every entity ID. The symptom is not an error — Explorer pops an `mj-app-access-dialog`
   saying *the application doesn't exist*, which reads exactly like a broken permission.
   `ng serve`'s watch rebuilds the bundle but does **not** re-read metadata: reload is not enough,
   restart the process.
3. **Never run the two seed scripts concurrently.** They take table locks and deadlock, presenting as a
   hang rather than an error.
4. **Use `start:explorer:msal`, not `start:explorer`,** for anything involving your own login. Plain
   `ng serve` selects the Auth0 *automation* tenant (service accounts), which rejects staff credentials.

---

## 4. Automated checks (run these before manual testing)

```bash
npm run verify                                  # vocabulary gate + build 8/8
RUN_MUTATION_TESTS=1 npm run test:integration    # live-DB checks, each rolls back
```

**`RUN_MUTATION_TESTS=1` is mandatory.** Without it the writing checks are *skipped*; a run reporting
mostly-skipped is not a pass. Expected counts depend on the branch:

| Branch | Expected |
|---|---|
| base / `s0-s1…` | 12 (`save-deal` SD1–SD12) |
| `feature/close-flow` | 24 (`+ close-deal` CD1–CD12) |
| `feature/deal-line-product-ref` | 19 (`+ product-ref` PR1–PR7) |
| `feature/pipeline-board` | 16 (`+ board-move` BD1–BD4) |

Requires the seeds to have been run — the suite **discovers** its fixture from seeded rows rather than
creating one, and fails with an instruction if they are missing.

There is also a Playwright harness that drives the real Explorer UI
(`test-harnesses/playwright/README.md`). It needs a one-time interactive login:
`npm run test:explorer:auth`, then `npm run test:explorer`. Deliberately **not** in CI.

---

## 5. Test scenarios

Log in at `http://localhost:4341`. Two applications exist and this confuses people:

- **`/app/sales`** — the hand-authored, job-shaped app. **This is what you are testing.**
- **`/app/mjbizappssales`** — the CodeGen entity browser (one generated CRUD form per table). Useful for
  checking raw data, not the product.

`/app/sales` opens on a **Deals section** with a left rail: **Dashboard · All deals · Board · Workspace**.

### 5.1 Dashboard (KPIs)
1. Open **Dashboard**.
2. Expect tiles summarising open pipeline and stalled deals, and no console errors.
3. **Amounts are stored values, summed.** Sales computes nothing — a tile total is a `SUM` of
   `Deal.Amount` as recorded. Do not expect it to recompute from lines.
4. ✅ Tiles render with numbers, not blanks or `NaN`.

### 5.2 Roster (All deals)
1. Open **All deals**. Expect the 6 seeded demo deals.
2. Each row should resolve a **customer name** (not a bare GUID).
3. Click a row → it opens that deal in the **Workspace**.
4. ✅ Row click lands in the workspace with that deal loaded.

### 5.3 Create a deal
1. **Workspace** → **New deal**.
2. A deal requires a **name** and a **pipeline**; Save stays disabled until both are set.
3. Choosing a pipeline populates its stages and sets the selling company.
4. Save → expect a success message and a `DEAL-{n}` number assigned.
5. ✅ Saved deal appears in **All deals**.

### 5.4 Workspace panes
Five inner panes: **Party info · Product lines · Payment schedule · Terms · Variances**.
1. Visit each; fields render and accept input.
2. Add two product lines and two instalments; switch panes and back — **the rows must survive**.
3. Remove a line and save — the array you see is the complete desired set, so the removed line is deleted.
4. Tab badges show **error counts only**; warnings deliberately do not badge.
5. ✅ No pane is blank; nothing lost on pane switch.

### 5.5 Order-readiness *(branch `feature/deal-line-product-ref`)*
1. Open **Northwind Health — Platform Rollout** (2 lines) — **not** a Beacon or Cascade deal, which have
   **no lines** and therefore correctly show nothing.
2. Expect an amber **"Not order-ready"** chip in the customer-context band.
3. **Product lines** pane shows an amber warning: *"2 lines need a catalog product before this deal can
   become an order."* Open **Year 2 Renewal** (1 line) for the singular wording.
4. It is a **warning, never a save block** — the deal must still save.
5. ✅ Chip and warning agree word-for-word; a deal with no lines shows neither.

### 5.6 Close a deal *(branch `feature/close-flow`)*
1. Open an open deal → close it as **won**.
2. Expect: the deal locks, a stage event is written, and the routing outcome appears in the event notes
   as **"PLANNED but not executed"** (see §6 — this is correct).
3. Close another as **lost** with no loss reason → **must be refused**, naming `LossReasonID`. Pick a
   reason flagged as requiring notes and supply none → refused, naming `LossNotes`.
4. On a closed deal: editing the **name** must be refused; editing **Description** must succeed.
5. Reopen with no reason → refused. With a reason → unlocks, and the close event survives.
6. ✅ Refusals are specific; the lock is real; the reopen is recorded.

### 5.7 Pipeline board *(branch `feature/pipeline-board`)*
1. Open **Board**. Columns are the selected pipeline's stages in `DisplayOrder`.
2. Switch pipeline (**B2B / D2C**) → columns change to that pipeline's stages.
3. Each column header shows a deal count and a summed amount.
4. A card shows name, customer, amount, owner, expected close. **Click a card → opens in the Workspace.**
5. **Drag a card to another stage.** Expect: the stage updates, and **exactly one** new
   `DealStageEvent` is appended stamping amount and probability at transition. Probability and forecast
   category pick up the target stage's defaults, and stay editable afterwards.
6. **Drag onto a closing (locking) stage must be refused** with a hint pointing at the explicit close
   action. A board move must never close a deal or create an order/contract.
7. ✅ Move persists after refresh; event count grows by exactly one per move; no auto-close.

### 5.8 Regression sweep
- Reload every page — no console errors.
- Check one surface in **dark mode**; colours are semantic tokens, so nothing should be unreadable.
- Confirm no page shows a raw GUID where a name belongs.

---

## 6. Known limitations — **do not file these as bugs**

1. **Downstream is stubbed. Sales is standalone.** `bizapps-orders` and `bizapps-contracts` are not
   reachable from this repo. Closing a won deal therefore reports its routing as **"PLANNED but not
   executed"** with a reason, and creates **no order and no contract**. That is the intended behaviour —
   the stub deliberately returns a real blocker rather than a fake success or an invented record ID.
2. **`Contracts.CreateFromDeal` / `Contracts.RenewTerm` do not exist yet.** Contracts is README-only.
3. **Orders cannot accept a deal's lines yet** even when linked: orders requires a catalog `ProductID`
   on every order line, and sales deal lines carry a transcribed `ProductName` with `ProductID` NULL.
   Closing that gap needs a resolver that has not been designed (see `docs/consolidation-notes.md`).
4. **Sales never computes money.** No total is derived, no discount applied, no tax, no proration. Every
   figure is either transcribed from a signed document or returned by orders. A tile or column total is a
   `SUM` of stored amounts. **Amounts not matching the lines is not a bug** — `Deal.Amount` is a cached
   answer with provenance (`AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`), and may legitimately
   be stale.
5. **No Activity timeline.** The Activity spine does not exist in bizapps-common or MJ core yet, so the
   close flow deliberately does not write one.
6. **No quota/attainment, no territory routing.** Deferred by decision (`docs/DECISIONS.md` D2, D3).
7. **The encryption-key warning at startup** is expected (§2).
8. **Only 2 of the 6 seeded deals have product lines** (both Northwind deals). Beacon and Cascade deals
   have none, so line-dependent surfaces correctly show nothing for them.
9. **`ForecastSnapshot` columns are `*Amount`-suffixed** (`CommitAmount`, not `Commit`) — a documented
   divergence from the plan, because `COMMIT` is reserved in T-SQL and Postgres (D6).
10. **A known upstream risk, not a sales bug:** `AllowMultipleSubtypes` is `false` on common's `Person`
    and `Organization`. Sales is currently the only app extending them so it works today; a second app
    doing so would mis-chain. The fix belongs in bizapps-common — `docs/KNOWN-ISSUES.md` KI-1.

## 7. Filing a bug

Include: branch and commit (`git log --oneline -1`), whether `npm run verify` was green, the integration
count, the browser console output, and which of the two applications (`/app/sales` vs
`/app/mjbizappssales`) you were in. Check this document's §6 first.
