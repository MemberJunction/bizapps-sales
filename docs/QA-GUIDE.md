# BizApps Sales — QA guide

How to stand up bizapps-sales and test it. Written for a tester who has not run this app before.

**Read §6 "Known limitations" before filing anything.** Several behaviours that look like bugs are
deliberate — an absent section, or a downstream that does nothing because its app is not installed, is
this app working correctly.

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
| MJ core | **6.1.5** (the 6.1 LTS release) | `mj-app.json`'s `mjVersionRange` is `>=6.1.5 <7.0.0`; all seven manifests ask for `^6.1.5`, and the lockfile resolves 6.1.5 |

### Sibling apps

`mj-app.json` declares five sibling apps:

| App | Range | What sales needs it for |
|---|---|---|
| bizapps-common | `>=5.51.0 <6.0.0` | Accounts and contacts are IS-A children of common's Organization and Person; activities live in common's tables |
| bizapps-tasks | `>=1.7.0 <2.0.0` | A won close raises the order-review and contract-processing tasks |
| bizapps-accounting | `>=0.2.0 <1.0.0` | Orders books orders through accounting's engine |
| bizapps-orders | `>=5.30.0 <6.0.0` | **A deal cannot be saved without it.** The save provisions the deal's embedded `OrderHeader`, and the deal's lines live on that order |
| bizapps-contracts | `>=0.1.1 <1.0.0` | A won close on a pipeline whose policy creates a contract (B2B) creates one. Without contracts the close still succeeds and records why no contract was made |

### The workspace CLI rule

Always invoke the MJ CLI through the repo, never a globally installed `mj` — a global CLI ships its own
packages and cannot see this workspace.

```bash
pnpm run mj -- <command>
```

---

## 2. Configuration

Sales' repo-root `.env` is read by migrations, the seeds and the test harnesses. The MJ host has its own
`.env` for the API. Copy [`.env.example`](../.env.example) to `.env` and fill in the database block;
it lists every variable the repo reads, with what each is for. For QA, also set
`MJ_CORE_VERSION=v6.1.5`.

`MJ_CORE_VERSION` pins the MJ core the migrations expect. It must match what `@memberjunction/*`
resolved to in the workspace — a database behind the packages driving it fails with "column does not
exist" on core metadata, which reads like a broken migration rather than a version skew.
`scripts/rebuild-db.sh` reads it from the installed MJ CLI when it is unset.

If sales' `.env` carries `GRAPHQL_PORT=4141`, ignore it: sales ships no API, and the API you connect to
is the host's.

Set `MJ_BASE_ENCRYPTION_KEY` in `.env` (`openssl rand -base64 32`; see `.env.example`). Without it you
see a boxed `ENCRYPTION KEY VALIDATION FAILED` warning at API and test startup. It is non-fatal:
nothing in sales uses an encrypted field.

### Servers, ports and login

Both servers belong to the MJ host. Start them, and set up their login, as the host's own docs describe
(in MJ, `packages/MJExplorer/README.md` covers Explorer). The ports this repo assumes:

| Service | Port | Notes |
|---|---|---|
| MJAPI (GraphQL) | **4143** | MJAPI reads its port from `GRAPHQL_PORT` in the host's `.env` |
| MJExplorer | **4341** | Not MJ's default: MJ's own `npm start` for Explorer serves on 4201 |

The Playwright harness uses the same defaults (`test-harnesses/playwright/lib/env.ts`) and takes
overrides; see its README.

**Which identity provider you get.** `ng serve` uses Explorer's `development` configuration
(`packages/MJExplorer/angular.json` in MJ), which replaces `environment.ts` with
`environment.development.ts`. Both files are gitignored in MJ and written per developer, so the provider
is whatever `AUTH_TYPE` says in your `environment.development.ts`. For a human login it must name a
provider your account can sign in to.

**The redirect origin.** MJ's MSAL and Auth0 providers redirect to `window.location.origin`, so the
identity provider must accept the origin Explorer serves on (`http://localhost:4341` here) as a redirect
URI. Which origins it accepts is set in the identity provider, not in this repo.

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
  whose amount is typed directly).
  **`RequiresDealLines` no longer means what its name says.** `DealLine` is retired (D-DL1); the column
  survived the table. It now means "this pipeline's deals leave the EMBEDDED ORDER empty" — a D2C deal
  still provisions an `OrderHeader`, it just carries no lines, and its `Amount` is typed rather than
  returned by orders. **A D2C deal showing no product lines is correct, not a bug.**
- **9 pipeline stages**, 3 sales accounts, 4 sales contacts
- **7 deals** — one won, one lost with a loss reason, five open — across both pipelines and two selling
  companies, with product lines, a payment schedule, deal team members, a buying committee, stage
  history and a forecast snapshot

Five deals carry order lines priced by orders — `DEAL-9001`, `-9002`, `-9003`, `-9005` and `-9006`, all
on B2B (`scripts/seed-demo-lines.mjs`, which `seed-demo-data.sh` runs at the end). The two D2C deals,
`DEAL-9004` and `DEAL-9007`, carry a stated amount and no lines.

---

## 4. Automated checks (run these before manual testing)

```bash
pnpm run verify               # 10 steps: six static gates, the build, unit tests, two gates on the built modules
pnpm run test:coverage-gate   # runs the live-DB integration suite, then checks every expected check ran
```

**`test:coverage-gate` runs the suite itself**, so there is no need to run `test:integration` first. It
fails if fewer checks ran than this host should have run — the failure a green "0 failed" hides. To
judge a run you already have, pass its log; the gate refuses a log older than the source it would judge:

```bash
node scripts/assert-check-count.mjs test-harnesses/.integration-log.txt
```

The bundles, their check counts and the sibling app each needs are in
`scripts/expected-check-counts.json`. The runner and the gate both read that file.

`pnpm run test:integration` runs the suite on its own: every bundle whose sibling app is linked, with
every check — it passes `--mutations` itself, so the command is the same on every shell. A run that
skips checks exits non-zero; for a deliberately narrow run use
`MJ_ALLOW_SKIPPED=1 node test-harnesses/integration.mjs`. To narrow something down, run one bundle or
one check:

```bash
pnpm run test:integration close-won-contract
pnpm run test:integration save-deal.SD9
```

A bundle run on a host where its app is absent **fails with a named precondition**. That is the bundle
refusing to report a pass it cannot back up, not a product failure.

There is also a Playwright harness driving the real Explorer UI
(`test-harnesses/playwright/README.md`). It needs a one-time interactive login and is deliberately not
in CI:

```bash
pnpm run test:explorer:auth   # opens a browser; complete the login
pnpm run test:explorer
```

---

## 5. Test scenarios

Log in at `http://localhost:4341`. Two applications exist and this confuses people:

- **`/app/sales`** — the hand-authored, job-shaped app. **This is what you are testing.**
- **`/app/mjbizappssales`** — the CodeGen entity browser, one generated CRUD form per table. Useful for
  checking raw data, not the product.

Each scenario names the Playwright spec it mirrors (`test-harnesses/playwright/specs/`). When a step and
the screen disagree, the spec is the reference.

### 5.1 The Sales section — `50-sales-shell`
1. Open `/app/sales`. The **Deals** section opens with a left rail: **Dashboard · All deals · Board**.
   There is no Workspace item.
2. The header carries a refresh button and **New deal**.
3. ✅ The section renders (an unregistered section mounts a blank tab with no error), and the console
   is clean.

### 5.2 Dashboard — `75-dashboard`
1. Open **Dashboard**. Four tiles: Open pipeline, Open deals, Past expected close, Won.
2. The period selector starts on **This quarter**, and the Won tile's footnote names the dates it counted.
3. Switch to **All time**. Won becomes the count of every won deal; the three open-deal tiles do not
   change.
4. Below the tiles: Forecast stack, Stage mix, Needs a person, Close-date buckets, Commit by owner, Win
   rate, and an **Inspect** grid. Clicking a tile, a queue or a bucket filters Inspect; **Clear** resets it.
5. **Amounts are stored values, summed.** Sales computes nothing — Open pipeline is a `SUM` of
   `Deal.Amount` as recorded. Do not expect it to recompute from lines.
6. ✅ The tiles match the database (the spec computes them from the `IsOpen` / `IsWon` flags); no console
   errors.

### 5.3 All deals — `50-sales-shell`
1. Open **All deals**. The grid lists the seeded deals.
2. Double-click a row: the deal opens in its own Explorer tab on the **Deal form**. A single click only
   selects the row.
3. Return to the Sales tab: the section is still there.
4. ✅ Rows render their values; a double-click opens the Deal form.

### 5.4 Create a deal — `40-deal-form`, `50-sales-shell`
1. **New deal** opens an unsaved Deal form in a new Explorer tab.
2. Set Name, Pipeline, Account and an open status, then save. The first save gives the deal its
   embedded order.
3. Edit again and fill the rest of the header across the Pipeline, Commercial, Motion and Close panels:
   deal type, term in months, execution date, contract variances, annual increase override. Save.
4. Reopen the deal: every value is still there, dates included, and Pipeline and Account show names,
   not GUIDs.
5. ✅ Each typed value reaches its column (the spec reads the database, not the form).

### 5.5 Product lines — `40-deal-form`, `41-deal-roundtrip`, `78-line-removal-tripwire`, `79-embedded-order-refresh`, `80-cross-company-products`, `82-term-start`
1. On a saved B2B deal open **What's being sold** → **Add a product**. The line editor opens.
2. Pick a product and a quantity, then save the line. Unit price and line total come back from orders as
   read-only figures, not inputs.
3. On a deal created moments ago, without reloading, add its first line: it lands on the deal's own
   order, and no second order appears (79).
4. The product picker also offers active products owned by another company; a line for one books to the
   product's company, not the deal's (80-cross).
5. Double-click a saved line → **Remove** → confirm. Reopen the deal: that line is gone from the order,
   the other line remains with its quantity, and it is renumbered to line 1 (41, 78).
6. A subscription product's line shows a **term start** that defaults to the order date and says so;
   set a date and the hint goes; empty it and the order date returns. A one-time line shows no term
   start (82). The seed makes Platform — Standard Seat a subscription product only when orders'
   subscription types have been pushed (`scripts/dev/seed-orders-catalog.sql`); Premium Seat is one-time.
7. On a closed deal, Add a product is replaced by a sentence saying why lines cannot change.
8. ✅ Lines carry engine prices; removals and the order survive a reopen.

### 5.6 Stage and pipeline — `74-stage-belongs-to-pipeline`, `70-lifecycle`
1. The **Stage** control offers only the stages of the deal's own pipeline.
2. Change the pipeline: a stage from the old pipeline is cleared, and it stays cleared after the save.
3. Move an open deal into a stage that declares an order status — on B2B, Proposal, Negotiation and
   Signed declare `Quoted`. The deal's order takes that status.
4. ✅ The stage list follows the pipeline; the order follows the stage.

### 5.7 Close and reopen — `60-close-deal`, `71-lost-and-reopen`, `70-lifecycle`
1. Open a saved, open B2B deal with a line → **Close** panel → **Close this deal**. Choose a won status →
   **Close deal**.
2. The header shows a **Locked** chip, and Name and Pipeline stay read-only in edit mode. A stage event
   is appended with the amount and probability the deal held on the way out.
3. The panel reports the outcome, including any downstream step that did not happen. On B2B a won close
   creates a contract numbered by contracts (with contracts installed) and the finance tasks; the order
   is left unchanged and editable. The order is created at the deal's first save, not at close.
4. Close another deal as lost: **Close deal** stays disabled until a loss reason is chosen, and a reason
   that requires notes also asks for loss notes. The deal's order becomes `Voided` (71).
5. On a closed deal, **Reopen this deal** (the reason is optional) → **Reopen deal**. The deal unlocks,
   a reopen event is appended, and the close event remains. The order takes the status its restored
   stage declares, or the reopen says why it could not (71).
6. ✅ Refusals happen before the round trip; the lock is real; history is appended, never rewritten.

### 5.8 The lock, per record tab — `73-lock-across-tabs`
1. Open a closed deal and an open deal in two Explorer tabs and switch between them.
2. ✅ The closed deal shows the Locked chip and a frozen Name; the open one shows no chip and stays
   editable.

### 5.9 Board — `80-board-drag`
1. Open **Board** and pick a pipeline from the switcher. Columns are the pipeline's stages, closing
   stages included.
2. Drag an open deal's card to another non-closing stage. Each drag appends a permanent stage event, so
   use a deal you created.
3. ✅ The stage changes, exactly one stage event is appended carrying the probability and amount the
   deal held before the move, and the order takes the new stage's declared status.
4. A closing column carries a lock icon titled "Deals cannot be moved here. Close a deal from the deal
   form."
5. ✅ A drop onto a closing column is refused, and no stage event records a move into it.

### 5.10 Activity — `70-activity-timeline`
1. Open an open deal that has an account and a primary contact → **Activity** → **Log activity**.
2. Choose a type (Call, Meeting, Note or Email), enter a subject and notes → **Log it**.
3. ✅ The form closes without an error and the activity appears in the list beneath. One `Activity` row
   is written, with `LoggedByUserID` set, linked to the deal and to the deal's account and primary
   contact.
4. On a closed deal the Activity panel still renders, and logging works as on an open one.

### 5.11 Deal team and owner — `76-team-roster-owner-stamp`
1. A deal's owner comes from its **Internal team** row with the Owner role. With none, the Overview
   says "No owner assigned".
2. Save the Owner team row (from the Internal team grid or its own record): the deal's owner is
   stamped from it.
3. With the deal already open while the owner changes elsewhere, open its Internal team section: the
   Overview stops saying "No owner assigned".
4. ✅ The owner follows the roster without a hand edit.

### 5.12 Account and contact search (bc-aidp-next-golive#372)
1. On a new deal, click into **Account** and type one character. ✅ Nothing is listed.
2. Type the start of an account's name, legal name or website domain (`acme.com`). ✅ Matches appear
   within a second; an organization with no Sales Account is never offered.
3. In **Primary Contact**, type a last name, an email, or `@` plus an email domain. ✅ Sales contacts
   whose last name, name or email starts with it appear. A word in the middle of a name does not match.
4. Pick one of each, save, reopen. ✅ The names show, not IDs. Inline create is not offered on these
   three fields.

### 5.13 Regression sweep
- Reload every page — no console errors.
- At a short window (1100 × 617), the deal's header card shows all of its content after a save and in
  edit mode (`42-hero-short-window`).
- Confirm no page shows a raw GUID where a name belongs.

---

## 6. Known limitations — **do not file these as bugs**

1. **A downstream that is not installed does nothing, deliberately.** Sales checks what is present and
   records the reason rather than inventing a record ID or faking success.
2. **Sections not built, by decision.** The app has one section, Deals (`sales-nav.model.ts`); Accounts,
   Forecasting and Setup sections do not exist. Configuration records (pipelines, stages, types, loss
   reasons) are edited through `/app/mjbizappssales`.
3. **Closing a deal writes no Activity.** The close is recorded as a stage event; activities are logged
   from the Activity panel (§5.10).
4. **A won renewal creates no contract.** For a deal type flagged `RequiresRenewalSource`, the close
   reports the contract route as not executed and gives the reason (`LiveContractsSeam.ts`).
5. **Sales never computes money.** No total is derived, no discount applied, no tax, no proration. Every
   figure is either transcribed from a signed document or returned by orders. **An amount not matching
   the lines is not a bug** — `Deal.Amount` is a cached answer with provenance (`AmountIsComputed`,
   `AmountComputedAt`, `AmountSourceHash`) and may legitimately be stale.
6. **No quota/attainment, no territory routing.** Deferred by decision (`docs/DECISIONS.md` D2, D3).
7. **The dashboard does not re-query when you navigate back to it.** Close a deal, return to Dashboard,
   and the tiles still show the pre-close numbers. **Press refresh (top right)** and they correct — the
   close did happen, only the reading is old.
8. **The encryption-key warning at startup** means `MJ_BASE_ENCRYPTION_KEY` is unset (§2).
9. **`ForecastSnapshot` columns are `*Amount`-suffixed** (`CommitAmount`, not `Commit`) — `COMMIT` is
   reserved in T-SQL and Postgres (D6).
10. **The Playwright specs run slowly** against a development-mode Explorer: the suite takes about 34
    minutes at one worker (`test-harnesses/playwright/run-suite.sh`).

---

## 7. Filing a bug

Use the repository's **Bug report** issue form, and include:

- branch and commit (`git log --oneline -1`)
- which siblings were linked (common, tasks, accounting, orders, contracts) — it changes what is expected
- whether `pnpm run verify` was green, and the integration counts from §4
- the browser console output
- which application you were in (`/app/sales` vs `/app/mjbizappssales`)

Check §6 first.
