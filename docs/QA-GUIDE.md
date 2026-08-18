# BizApps Sales — QA guide

How to stand up bizapps-sales and test it. Written for a tester who has not run this app before.

**Read §6 "Known limitations" before filing anything.** Several behaviours that look like bugs are
deliberate and documented — an absent section, or a downstream that does nothing because its app is not
installed, is this app working correctly.

---

## 1. How this app runs

Sales is an **Open App**. It ships no server and no Explorer of its own: it runs *inside* an MJ host,
linked through a joined pnpm workspace alongside the other bizapps repos.

**`docs/WORKSPACE-SETUP.md` is the standup document.** It covers cloning the members, generating the
workspace, migrating every schema in dependency order, and seeding. This guide assumes that is done and
covers only what a tester needs afterwards.

| Thing | Version / value | Notes |
|---|---|---|
| Node | **≥ 18** | `package.json` engines |
| pnpm | **10.33.0** | `packageManager`; always install from the **workspace root**, never inside a member |
| SQL Server | 2019+ | Local dev target is SQL Server |
| MJ core | **`6.1.0-edge.2`** | Must satisfy `mj-app.json`'s `mjVersionRange`: `>=6.0.0 <7.0.0` |
| bizapps-common | workspace member | Required — Sales' accounts and contacts are IS-A children of common's Organization and Person |
| bizapps-orders | workspace member | Optional. Required for the product picker and for close-won to create an order |
| bizapps-contracts | workspace member | Optional, and **not currently installable on a fresh database** — see §6.2 |

### What each sibling unlocks

Sales runs standalone. Linking a sibling switches features from inert to live:

| Without | With |
|---|---|
| Product picker shows nothing | Picker lists that company's active catalog products |
| Close-won routes nothing downstream, records why | Close-won creates a real, priced order (and a contract, if contracts is linked) |

Neither state is a bug. Sales checks what is installed and degrades deliberately.

### The workspace CLI rule

Always invoke the MJ CLI through the repo, never a globally installed `mj` — a global CLI ships its own
packages and cannot see this workspace.

```bash
pnpm run mj -- <command>
```

---

## 2. Configuration

Sales' repo-root `.env` is read by migrations and the test harnesses. The MJ host has its own `.env` for
the API.

```dotenv
# ── Database ────────────────────────────────────────────────────────────────
DB_PLATFORM=sqlserver
DB_HOST=localhost
DB_PORT=1433
DB_DATABASE=<your QA database>
DB_USERNAME=sa
DB_PASSWORD=<password>
DB_TRUST_SERVER_CERTIFICATE=true

# CodeGen connects separately — the same credentials are fine locally.
CODEGEN_DB_USERNAME=sa
CODEGEN_DB_PASSWORD=<password>

# ── MJ core ─────────────────────────────────────────────────────────────────
MJ_CORE_SCHEMA=__mj
MJ_CORE_VERSION=v6.1.0-edge.2
```

`MJ_CORE_VERSION` pins the MJ core the migrations expect. It must match what `@memberjunction/*`
actually resolved to in the workspace — a database behind the packages driving it fails with
"column does not exist" on core metadata, which reads like a broken migration rather than a version skew.

> **Sales' `.env` also contains `GRAPHQL_PORT=4141`. Ignore it.** It is vestigial: sales no longer ships
> its own API (the `apps/` importers were retired), so nothing reads that value. The API you connect to
> is the **host's**, on the port below.

`MJ_BASE_ENCRYPTION_KEY` is not set in local dev. You will see a boxed
`ENCRYPTION KEY VALIDATION FAILED` warning at API and test startup. It is **expected and non-fatal** —
nothing in sales uses an encrypted field. Ignore it.

### Ports

| Service | Port |
|---|---|
| Host MJAPI (GraphQL) | **4143** |
| Host MJExplorer | **4341** |

**MJExplorer must serve on 4341.** The MSAL redirect URI is pre-registered in Entra for that origin; on
any other port the login round-trip fails. If 4341 is busy, stop whatever holds it rather than changing
the port.

---

## 3. Seeding

Run both, in this order, from the Sales repo. They are idempotent, and never run them concurrently —
they take table locks and will deadlock, which presents as a hang rather than an error.

```bash
scripts/seed-dev-data.sh      # companies, employees, users
scripts/seed-demo-data.sh     # pipelines, stages, vocabulary, accounts, contacts, 7 demo deals
```

`scripts/seed-demo-data.sh --remove` tears the demo set back down, children first.

**Seed before testing.** The integration suite discovers its fixture from seeded rows rather than
creating one, and the UI is unexercisable without deals. What you get:

- **2 pipelines** — B2B (deals carry product lines) and D2C (`RequiresDealLines = 0`; header-only deals
  whose amount is typed directly)
- **9 pipeline stages**, 3 sales accounts, 4 sales contacts
- **7 deals** — one won, one lost with a loss reason, five open — across both pipelines and two selling
  companies, with product lines, a payment schedule, deal team members, a buying committee, stage
  history and a forecast snapshot

Only some deals carry product lines — both Northwind deals on B2B, and `DEAL-9007` on the order-only
pipeline. Line-dependent surfaces correctly show nothing for the others.

---

## 4. Automated checks (run these before manual testing)

```bash
pnpm run verify                                   # vocabulary gate + build (6/6)
RUN_MUTATION_TESTS=1 pnpm run test:integration    # live-DB checks
pnpm run test:coverage-gate                       # asserts the run actually covered what it claims
```

**`RUN_MUTATION_TESTS=1` is mandatory.** Every check is `RequiresMutation`; without the flag the driver
skips all of them and reports success. A run that reports mostly-skipped is not a pass.

**Run the coverage gate after the suite, and trust it over the tally.** It reads the log the suite
writes and fails if fewer checks ran than this host should have run — the failure a green
"0 failed" hides. It is also the check that catches a forgotten `RUN_MUTATION_TESTS=1`.

| Bundle | Checks | Requires |
|---|---|---|
| `save-deal` (SD1–SD16) + `close-deal` (CD1–CD14) | **30** | — (the default gate) |
| `product-picker` (PP1–PP4) | 4 | orders linked |
| `close-won-handoff` (CW1–CW4) | 4 | orders linked |
| `close-won-d2c` (D1–D4) | 4 | orders linked |
| `close-won-contract` (CT1–CT4) | 4 | contracts linked |
| **Total, fully linked** | **46** | |

**You do not invoke the conditional bundles yourself.** `test:integration` adapts to what is linked: it
runs 30 on a sales-only host and all 46 when orders and contracts are both present, and the coverage
gate expects exactly that. So the count you see *is* the coverage this host can prove.

Run one on its own only when narrowing something down:

```bash
RUN_MUTATION_TESTS=1 pnpm run test:integration close-won-d2c
```

Invoked that way on a host whose app is absent, a conditional bundle **fails loudly with a named
precondition**. That is correct and is not a product failure — it is the bundle refusing to report a
pass it cannot back up.

There is also a Playwright harness driving the real Explorer UI
(`test-harnesses/playwright/README.md`). It needs a one-time interactive login and is deliberately not
in CI:

```bash
PW_FORCE_LOGIN=1 pnpm run test:explorer:auth   # opens a browser; complete the login
pnpm run test:explorer
```

`PW_FORCE_LOGIN=1` forces a headed window and ignores any stored session. Use it whenever a session has
expired — otherwise the setup runs headless against a dead session and waits for a login nobody can see.

---

## 5. Test scenarios

Log in at `http://localhost:4341`. Two applications exist and this confuses people:

- **`/app/sales`** — the hand-authored, job-shaped app. **This is what you are testing.**
- **`/app/mjbizappssales`** — the CodeGen entity browser, one generated CRUD form per table. Useful for
  checking raw data, not the product.

`/app/sales` opens on a **Deals section** with a left rail: **Dashboard · All deals · Workspace**.

### 5.1 Dashboard
1. Open **Dashboard**. Expect KPI tiles (open pipeline, open deals, past expected close, won), a
   "closing soonest" table and the roster.
2. **Amounts are stored values, summed.** Sales computes nothing — a tile is a `SUM` of `Deal.Amount` as
   recorded. Do not expect it to recompute from lines.
3. ✅ Tiles render numbers, not blanks or `NaN`; no console errors.

### 5.2 All deals
1. Open **All deals**. Expect the seeded demo deals.
2. Each row resolves a **customer name**, not a bare GUID.
3. Click a row → it opens that deal in the **Workspace**.
4. Click the **customer name** → it opens that account as its own **Explorer tab**, and the workspace
   stays where it was.
5. ✅ Row click lands in the workspace; customer click opens a record tab without losing your place.

### 5.3 Create a deal
1. **Workspace** → **New deal**.
2. A deal requires a **name** and a **pipeline**; Save stays disabled until both are set.
3. Choosing a pipeline populates its stages and sets the selling company.
4. Save → expect a success message and a `DEAL-{n}` number.
5. Reopen it from the roster → **every value must survive the round-trip**, dates included.
6. ✅ Saved deal appears in All deals; reopening shows exactly what you entered.

### 5.4 Workspace panes
Five inner panes: **Party info · Product lines · Payment schedule · Terms · Variances**.
1. Visit each; fields render and accept input.
2. Add two product lines and two instalments, switch panes and back — **the rows must survive**.
3. Remove a line, save, reopen — the line is gone from the database, not just the screen.
4. Tab badges show **error counts only**; warnings deliberately do not badge.
5. ✅ No pane is blank; nothing is lost on a pane switch.

### 5.5 Product picker *(requires orders)*
1. Open a B2B deal → **Product lines** → add a line and open the product picker.
2. It lists that company's **active** products within their availability window — products belonging to
   another company, or discontinued, draft, EOL, or outside their dates, must not appear.
3. Pick one, set a quantity, save, reopen — the product sticks.
4. ✅ The picker is filtered, not a full catalog dump. Without orders it shows nothing and does not error.

### 5.6 Close a deal
1. Open an open B2B deal with product lines → close it as **won**.
2. Expect the deal to lock, a stage event to be written, and — with orders linked — a **real order** to
   be created, numbered and priced by orders.
3. Close another as **lost** with no loss reason → **must be refused**, naming `LossReasonID`. Pick a
   reason flagged as requiring notes and supply none → refused, naming `LossNotes`.
4. On a closed deal: editing the **name** must be refused; editing **Description** must succeed. Fields
   that cannot be edited should render read-only rather than inviting an edit that will fail.
5. Reopen with no reason → refused. With a reason → unlocks, and the close event survives.
6. ✅ Refusals are specific; the lock is real; the reopen is recorded and the history is never rewritten.

### 5.7 Downstream routing
Which downstream a won deal produces is driven by the **pipeline's policy**, never by its name.

| Deal | Result |
|---|---|
| B2B with one-time lines | Order, confirmed and posted to the ledger |
| B2B with recurring lines | Contract *(requires contracts — see §6.2)* |
| D2C with lines | Order in **Draft** — numbered and priced, deliberately not ledger-posted |
| Header-only deal, no lines | **Nothing**, and the stage event records that. Correct, not a failure |

✅ The routing outcome is recorded in the stage-event notes either way.

### 5.8 Regression sweep
- Reload every page — no console errors.
- Check one surface in dark mode; colours are semantic tokens, so nothing should be unreadable.
- Confirm no page shows a raw GUID where a name belongs.

---

## 6. Known limitations — **do not file these as bugs**

1. **A downstream that is not installed does nothing, deliberately.** Sales checks what is present and
   records the reason rather than inventing a record ID or faking success.
2. **Contracts is not currently installable on a fresh database.** Its baseline hardcodes other apps'
   entity UUIDs, which are minted per database (`docs/KNOWN-ISSUES.md` KI-13). Until that is fixed
   upstream, the contract route is inert in any freshly-provisioned environment. Sales' side is built and
   tested; it activates when contracts can be deployed.
3. **These sections do not exist yet, by decision** — a pipeline/kanban board, a forecasting roll-up
   beyond the dashboard tiles, an in-app Setup/configuration section, and Accounts and Contacts list
   sections. Configuration records (pipelines, stages, types, loss reasons) are edited through
   `/app/mjbizappssales`. They are absent rather than stubbed.
4. **No team-editing surface.** A deal's owner is set from Party info; adding and removing other team
   members is not yet exposed in the workspace.
5. **No Activity timeline.** The Activity spine does not exist in bizapps-common or MJ core yet, so the
   close flow deliberately does not write one.
6. **Contract renewal is wired but unproven end-to-end.** The renewal seam is implemented; no renewal
   flow has been exercised against a live contract.
7. **Sales never computes money.** No total is derived, no discount applied, no tax, no proration. Every
   figure is either transcribed from a signed document or returned by orders. **An amount not matching
   the lines is not a bug** — `Deal.Amount` is a cached answer with provenance (`AmountIsComputed`,
   `AmountComputedAt`, `AmountSourceHash`) and may legitimately be stale.
8. **No quota/attainment, no territory routing.** Deferred by decision (`docs/DECISIONS.md` D2, D3).
9. **The deal number is not shown in the workspace after a save.** It exists and is on the record; it is
   rendered only in the **All deals** roster. Do not wait for it to appear on the deal you just saved
   (`docs/KNOWN-ISSUES.md` KI-15).
10. **The dashboard does not re-query when you navigate back to it.** Close a deal, return to Dashboard,
    and the tiles still show the pre-close numbers. **Press refresh (top right)** and they correct
    instantly — the close did happen, only the reading is old (KI-16).
11. **The encryption-key warning at startup** is expected (§2).
12. **`ForecastSnapshot` columns are `*Amount`-suffixed** (`CommitAmount`, not `Commit`) — `COMMIT` is
    reserved in T-SQL and Postgres (D6).
13. **The Playwright demo-tour specs run slowly** against a development-mode Explorer build
    (`docs/KNOWN-ISSUES.md` KI-12). Behaviour is correct; the budgets assume a production build.
14. **An upstream risk, not a sales bug:** `AllowMultipleSubtypes` is `false` on common's `Person` and
    `Organization`. Sales is currently the only app extending them, so it works today; a second app
    doing so would mis-chain. The fix belongs in bizapps-common (`docs/KNOWN-ISSUES.md` KI-1).

---

## 7. Filing a bug

Include:

- branch and commit (`git log --oneline -1`)
- which siblings were linked (orders? contracts?) — it changes what is expected
- whether `pnpm run verify` was green, and the integration counts from §4
- the browser console output
- which application you were in (`/app/sales` vs `/app/mjbizappssales`)

Check §6 first.
