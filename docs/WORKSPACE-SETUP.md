# Standing up the revenue stack — a turnkey guide

**Who this is for:** anyone who needs a working sales → orders → accounting stack to test against, without
re-deriving how it fits together.

**What it gets you:** six repos joined into one pnpm workspace, one database carrying all six schemas, and
a close-won deal that produces a real, priced, ledger-posted order.

Every step below was executed end to end on **2026-08-16** against a fresh clone set and an empty
database. Where a step needed a manual touch, that is called out rather than smoothed over — those are the
parts that will cost you time otherwise.

Verified result: **38/38 integration checks and an 11/11 end-to-end smoke, on a stack built from nothing.**

---

## Which database is which — read this before running an ad-hoc query

There are four similarly-named databases on this machine and **two of them differ by a `_V6` suffix**.
Nothing in a `sqlcmd` or `mssql` session tells you which one you reached, so a query that returns
plausible-looking rows from the wrong database is the default failure, not an unlikely one.

**It has already happened.** A roster check during demo prep read `MJ_BizAppsSales_V6` believing it was
the demo host, found six deals where there should be seven and a NULL `ProductID` on every line, and
concluded the demo data was broken. Nothing was broken — that database is *supposed* to look like that.
The real host was fine. Cost: a wrong diagnosis and a needless re-seed.

| Database | Tree that owns its `.env` | Serves | Contents |
|---|---|---|---|
| **`MJ_V6_Host`** | `/c/v6/MJ` | **API 4143**, Explorer **4341** | The **demo/recording** stack. Orders installed (~50 tables). Contracts **present as of 2026-08-25** — a contract was created here during close-won testing; this line previously said absent. Seven `DEAL-900x` deals, all lines carrying real catalogue `ProductID`s. |
| **`MJ_V6_Repro`** | `/c/v6repro/*` (7 members) | nothing running by default | The **isolated schema/CodeGen** stack, and the **only** one with contracts (~10 tables) as well as orders. The only place the contract-gated bundles can prove anything. |
| **`MJ_BizAppsSales_V6`** | `/c/v6/bizapps-sales` | API 4141 *(configured)* | **Sales-only** — no orders schema, no contracts. Which makes it the honest test of a standalone host: the default gate must be green here, and the downstream-gated bundles must refuse *loudly*. |
| **`MJ_BizAppsSales`** | `/c/Dev/MJ/bizapps-sales` | API 4141 *(configured)* | The **original pre-workspace** dev database. Predates the product-picker work, so its demo lines carry names with no `ProductID`. Nothing current depends on it. |

Also present and easy to mistake for the above: **`MJ_V6_QA`** (orders, no contracts), `MJ_E2E_Combined`,
`MJ_Equiv_SS`, `mj_sqlserver_fresh`. None are part of this stack.

### Two traps in that table

**`GRAPHQL_PORT=4141` appears in two trees, against two different databases.** `/c/v6/bizapps-sales` and
`/c/Dev/MJ/bizapps-sales` both claim it. Whichever starts first wins the port, so "the API on 4141" does
not identify a database — and a stale process from the other tree answering on 4141 looks exactly like the
one you meant to start. Resolve a listener to its tree before trusting it:

```bash
netstat -ano | grep LISTENING | grep ':4141'      # -> PID
powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=<PID>').CommandLine"
```

**The demo API is on 4143, not 4141.** `/c/v6/MJ/.env` sets `GRAPHQL_PORT=4143`, and
`MJExplorer/src/environments/environment.ts` points `GRAPHQL_URI` at `http://localhost:4143/`. A guide
that says "MJAPI: 4141" is describing the *sales-standalone* convention, not this stack.

### Announce the target

`test-harnesses/playwright/lib/db.ts` prints the database it connected to, which is why the harness has
never been the thing that got confused. Ad-hoc queries have no such habit — so give them one. Read the
target from the `.env` of the tree you mean, rather than typing a name:

```bash
cd /c/v6/MJ && grep -E '^DB_DATABASE=' .env      # say out loud which tree you are in
```

and when connecting by hand, print it back before reading anything:

```js
require('dotenv').config();
console.log('connected to', process.env.DB_DATABASE);   // cheap, and it ends the whole class of error
```

---

## After removing a generated symbol, rebuild before you trust an error count

**Especially a count of zero.** This has now misreported the state of this repo three times, each time
in the reassuring direction, and each time the number looked like evidence.

| Occasion | What the build said | What was true |
|---|---|---|
| `ng-ui-components` after the 324-commit MJ pull | `MJCard*` "has no exported member" | the source had them; the `dist` was pre-pull |
| `base-forms` / `NewRecordValues` arity | four repos failing on a 2-arg call | MJ's source took 2 args; four repos read a stale `dist` |
| Retiring `DealLine` | **0 errors across all six packages** | the generated class still existed, and consumers read `sales-entities`' old `.d.ts` |

The third is the dangerous one. Deleting `DealLine` reported **zero** errors; regenerating raised it to
**3**; rebuilding `sales-entities`' `dist` raised it to **67**. Had the first number been believed, the
demolition would have looked nearly free and the real work would have surfaced somewhere much worse.

So after removing or renaming anything a consumer imports:

```bash
# 1. regenerate, so the symbol actually leaves the source
npm run mj:codegen:files
# 2. rebuild the PRODUCING package, so its .d.ts stops advertising the old shape
(cd packages/Entities && npx tsc -p tsconfig.json && npx tsc-alias -f)
# 3. only now is a per-package count meaningful
for d in packages/*/; do (cd "$d" && npx tsc -p tsconfig.json --noEmit); done
```

A per-package `--noEmit` sweep beats `turbo build`, which stops at the first failing package and so
reports the first problem rather than all of them.

---
## 0. What you need first

- SQL Server reachable, and credentials that can `CREATE DATABASE`
- Node 24 and pnpm 10.33
- **~6 GB of free disk.** The clones are ~2 GB; pnpm hardlinks the rest from its global store
- GitHub access to the six repos

## 1. Clone all six as siblings under ONE parent

The parent must **not** itself be a git repo. Everything after this assumes `C:\ws` as the parent — use
whatever you like, but keep the six repos as direct children.

```bash
mkdir C:\ws && cd C:\ws
git clone --branch next https://github.com/MemberJunction/MJ.git
for r in bizapps-common bizapps-accounting bizapps-orders bizapps-contracts; do
  git clone --branch next https://github.com/MemberJunction/$r.git
done

# NOT next for these two — see the warning below.
git clone --branch feature/embed-order-on-deal https://github.com/MemberJunction/bizapps-sales.git
git clone --branch feature/closewon-task-types https://github.com/MemberJunction/bizapps-tasks.git
```

> #### ⚠ TWO OF THESE MUST NOT COME FROM `next`, and cloning them from it wastes the whole setup
>
> * **bizapps-sales** `next` is **242 commits behind** the current line. It predates the embedded-order
>   redesign entirely — `DealLine` still exists there — so a workspace built from it cannot reproduce
>   anything in this document and fails in ways that look like environment problems.
> * **bizapps-tasks** is one commit AHEAD of `next` on `feature/closewon-task-types`, and that commit is
>   what close-won task creation needs.
>
> Both branch names are recorded here rather than left as "use the current branch", because a tester has
> no way to know which that is. If they have moved on, the truth is `git branch -vv` in a working
> checkout — not `next`.

`bizapps-tasks` is **not optional**, even though nothing you test touches tasks directly: accounting has a
hard foreign key into it, and orders has one into accounting. Leave it out and orders' migration fails on a
foreign key three apps away from where you are looking.

## 2. Bootstrap the CLI — the one genuinely awkward step

> ⚠️ **MJ's `next` cannot `pnpm install` on its own.** `MJ/packages/MJAPI` declares
> `@mj-biz-apps/accounting-server: workspace:*`, so MJ now assumes it is *inside* the joined workspace. But
> the tool that creates the joined workspace is MJ's own CLI. That is a genuine chicken-and-egg, and it is
> the single step you cannot copy-paste your way through.

Write a minimal parent workspace by hand, install, and build the CLI:

```yaml
# C:\ws\pnpm-workspace.yaml  — TEMPORARY, replaced in step 3
linkWorkspacePackages: true
packages:
  - 'MJ'
  - 'MJ/packages/*'          # plus every nested glob from MJ/pnpm-workspace.yaml
  - 'bizapps-common'
  - 'bizapps-common/packages/*'
  - 'bizapps-tasks'
  - 'bizapps-tasks/packages/*'
  - 'bizapps-accounting'
  - 'bizapps-accounting/packages/*'
  - 'bizapps-orders'
  - 'bizapps-orders/packages/*'
  - 'bizapps-sales'
  - 'bizapps-sales/packages/*'
  - 'bizapps-contracts'          # ⚠ was MISSING here; step 6 cannot run without it
  - 'bizapps-contracts/packages/*'
```

**Every member is listed explicitly, and contracts is the reason.** This block used to end with
*"…and so on for tasks, accounting, orders, sales"* — which omitted **contracts entirely**. A literal
reading built a workspace that installs and builds fine and then cannot perform step 6, with a failure
that points at contracts rather than at this list. Elisions are fine in prose and not in a block someone
copies.

```json
// C:\ws\package.json — TEMPORARY. devDependencies are LOAD-BEARING: without
// typescript and tsc-alias at the parent, member builds fail with
// "tsc-alias: command not found". Copy MJ's devDependencies wholesale.
{ "name": "bootstrap", "private": true, "packageManager": "pnpm@10.33.0", "devDependencies": { /* MJ's */ } }
```

```bash
# turbo refuses to run without a config at the parent, and the bootstrap has none yet.
# Borrow a member's — which is exactly what the generator does in step 3
# ("turbo.json copied from bizapps-accounting"). Without this you get:
#   x Could not find turbo.json or turbo.jsonc.
cp bizapps-accounting/turbo.json turbo.json

cd C:\ws && pnpm install
pnpm exec turbo run build --filter "@memberjunction/cli..." --continue
```

> **Build with `--filter`, not bare `turbo run build`.** An unfiltered whole-workspace build reads MJ's
> own `turbo.json`, which uses `globalDependencies` — a key turbo 2.10.x rejects outright
> (`Found an unknown key`). Every build in this guide is filtered for that reason.

> ### ⚠️ A `--filter` build can report clean while the full build FAILS. Verify with `pnpm run build`.
>
> This has bitten more than once, in both directions, and it is worth the paragraph.
>
> `pnpm --filter <pkg> run build` consults turbo's cache. A package whose inputs turbo considers
> unchanged is reported as a cache hit and its compiler never runs — so a file you just edited can be
> declared clean by a build that did not look at it. The failure then surfaces later, from an unrelated
> command, pointing at the wrong cause.
>
> Measured instances in this repo: a filtered `sales-ng` build passed while four TypeScript errors sat
> in `deal-workspace.component.ts`; and a filtered build passed on a rebase whose merge resolution had
> broken a doc comment into eight syntax errors, which only `pnpm run build` surfaced.
>
> **The rule: use `--filter` to iterate, and `pnpm run build` (all 6 tasks) before you trust a result,
> commit, or report a package as green.** Filtered builds are for speed, not for evidence.

`--continue` is required, not defensive: **MJ `next` does not currently build clean.** Four packages fail
(see §7). The CLI's own output is still emitted and runs fine.

## 3. Generate the real workspace

```bash
cd C:\ws\MJ
node packages/MJCLI/bin/run.js dev workspace --dir C:\ws --force --no-install --no-clean-members
```

This **replaces** your bootstrap files with the real ones — nested globs for every member, ~80 hoisted
devDependencies, and ~855 pnpm overrides. Then:

```bash
# ONE manual touch, still required:
#   the generator writes strict-peer-dependencies=true, and the install fails on six
#   pre-existing upstream peer mismatches (stryker/vitest, date-fns-tz, MCP-sdk/zod,
#   databricks/ws) that have nothing to do with your workspace.
#   Set strict-peer-dependencies=false in C:\ws\.npmrc, then:
cd C:\ws && pnpm install
node MJ/packages/MJCLI/bin/run.js dev workspace doctor --dir C:\ws
```

Doctor should report **8 passed, 1 warned, 0 failed**. The warning is a pnpm-not-on-PATH-at-the-parent
notice and is harmless.

## 4. Create the database and migrate — order matters

```bash
sqlcmd -S localhost,1433 -U sa -P "$PW" -C -Q "CREATE DATABASE MJ_QA;"
```

Give **every** repo a `.env` pointing at it (`DB_DATABASE=MJ_QA`, plus host/port/credentials). Then migrate
in this order — it is the dependency order, and it is not negotiable:

| # | Repo | Command | Expect |
|---|---|---|---|
| 1 | MJ | `node packages/MJCLI/bin/run.js migrate` | ~52 applied |
| 2 | common | `… migrate --schema __mj_BizAppsCommon --dir ./migrations` | 11 |
| 3 | tasks | `… migrate --schema __mj_BizAppsTasks --dir ./migrations` | 4 |
| 4 | accounting | `… migrate --schema __mj_BizAppsAccounting --dir ./migrations` | 2 |
| 5 | orders | `… migrate --schema __mj_BizAppsOrders --dir ./migrations` | 9 |
| 6 | **contracts** | `… migrate --schema __mj_BizAppsContracts --dir ./migrations` | 1 — **see the warning below** |
| 7 | sales | `… migrate --schema __mj_BizAppsSales --dir ./migrations` | 2 |

> ⚠️ **Contracts migrates LAST, and does not currently install on a fresh database.** It FKs into
> common, tasks, orders AND accounting — the full stack — so nothing else may follow it. More
> importantly its baseline hardcodes other apps' entity UUIDs and fails on any machine but the one its
> CodeGen ran on. Read `docs/KNOWN-ISSUES.md` **KI-13** before attempting it: the first error names the
> wrong table, and three of the six broken references fail *silently* as a column-count mismatch that
> breaks every insert. Always column-diff contracts' ten entities after installing.

> **Sales' `mj:migrate` now passes `--schema` itself**, so `npm run mj:migrate` is safe. It did not until
> this pass: the bare form wrote flyway history into `__mj` — where MJ core's newer migrations already sit
> — and died with *"Detected resolved migration not applied to database"*, an error that names a migration
> and tells you nothing about the schema. Fixed to match the other four apps.

**No CodeGen run is needed.** Each app's baseline carries its generated half, so after step 6 the database
already has all ~500 entities registered (22 sales, 49 orders, 23 accounting, 19 tasks, 10 common). If you
find yourself about to run CodeGen to "register entities", stop — something else is wrong.

## 5. Seed, in this order

```bash
# a. app metadata — type tables, remote operations, and (for sales) the form chrome
cd C:\ws\bizapps-sales     && node ../MJ/packages/MJCLI/bin/run.js sync push --dir metadata
cd C:\ws\bizapps-accounting && node ../MJ/packages/MJCLI/bin/run.js sync push --dir <currencies, gl-account-roles, journal-entry-types>
cd C:\ws\bizapps-orders     && node ../MJ/packages/MJCLI/bin/run.js sync push --dir <product/revrec/subscription types, remote-operations + categories, journal-entry-types, payment & charge types>

# b. sales dev + demo data (companies, pipelines, accounts, contacts)
cd C:\ws\bizapps-sales && bash scripts/seed-dev-data.sh && bash scripts/seed-demo-data.sh

# c. orders catalogue, then the six accounting/pricing layers
sqlcmd … -i scripts/dev/seed-orders-catalog.sql
sqlcmd … -i scripts/dev/seed-revenue-stack.sql
```

> `mj sync push` discovers entity directories **beneath** `--dir`. Pointing it at a single leaf directory
> fails with *"No entity directories found"* — assemble a temp parent holding just the dirs you want when
> you need a narrow push.

`seed-revenue-stack.sql` does the six layers a booking crosses and **refuses with a pointed message** if the
metadata pushes have not run. It is idempotent, so re-run it freely. What it covers, and the error you get
without each, is in `docs/KNOWN-ISSUES.md` KI-11.

## 6. Build and verify

```bash
cd C:\ws
pnpm exec turbo run build --filter "@mj-biz-apps/sales-integration-tests..." --continue
pnpm exec turbo run build --filter "@mj-biz-apps/orders-core-entities-server..." \
                          --filter "@mj-biz-apps/accounting-core-entities-server..." --continue

cd C:\ws\bizapps-sales
RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs                     # 30/30
RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs product-picker      #  4/4
RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs close-won-handoff   #  4/4
RUN_MUTATION_TESTS=1 node test-harnesses/smoke-close-won.mjs                 # 11/11
```

**`RUN_MUTATION_TESTS=1` is mandatory.** Without it the suites run ZERO checks and report success — a
vacuous pass, which is the failure mode `assert-check-count.mjs` exists to catch.

`turbo` must be run **from the parent**, not from inside MJ: MJ's own turbo scope cannot see the sibling
repos and reports *"No package found with name '@mj-biz-apps/sales-integration-tests'"*.

The smoke **commits** what it creates — a `SMOKE-`prefixed deal and a real order — so you can open them
afterwards. The suite bundles roll everything back.

## 7. Known rough edges, so you can recognise them

**MJ `next` does not build clean.** Four packages fail: `ai-cerebras` and `actions-bizapps-formbuilders`
(TypeScript errors against SDK types), `graphql-dataprovider` and `server` (an esbuild host/binary version
mismatch, 0.26.0 vs 0.24.0, from multiple esbuild copies in the store). None is caused by the bizapps apps.

Two of them break things downstream in a way whose error message points nowhere useful:

- A package whose `tsc` failed never runs `tsc-alias`, so its `dist` keeps **extensionless ESM imports**.
  You then get `ERR_UNSUPPORTED_DIR_IMPORT` or `ERR_MODULE_NOT_FOUND` at runtime, naming a file that exists.
  Fix: `cd <package> && ../../node_modules/.bin/tsc-alias -f`.
- This bit `core-actions` and `actions-bizapps-formbuilders`, and it blocked the integration suite from
  starting at all.

**Load accounting BEFORE orders.** Orders books through accounting's engine, which serves GL account links
from a cache it fills on load. Without accounting loaded, every booking reports *"No GL account is linked
for role 'Accounts Receivable'"* **while the links sit visibly in the table** — the resolver is reading an
empty cache, not an empty database, and the message cannot tell you which. The smoke script hit exactly
this on its first run against a database where the suite was already green.

**Sibling packages are not resolvable by name across repos.** pnpm links only what a `package.json`
declares, and the workspace does not hoist `@mj-biz-apps/*` to the parent. Both the integration harness and
the smoke script resolve siblings by scanning neighbouring repos for a matching package name; if you write
new tooling, do the same, and **never swallow the failure** — a sibling that is present but fails to load
must not read as "not installed".

**A regenerated class manifest can want a package the host has not linked.** MJAPI's and MJExplorer's
`prestart` run `mj codegen manifest`, which walks whatever is linked in the workspace *at that moment* and
emits imports for it. Link a new app into `/c/v6` and the next `npm start` in MJ begins importing it — and
if `MJ/packages/<app>/node_modules/@mj-biz-apps/<pkg>` is absent or half-populated, the API dies before it
logs anything useful:

```
node:internal/modules/run_main:107
[Object: null prototype] { Symbol(nodejs.util.inspect.custom): [Function ...] }
```

No message, no stack, nothing naming the cause. It is a **`TS2307` from ts-node** thrown as a non-Error, so
`--trace-uncaught` adds nothing. To read it, import the entry point yourself and inspect what was thrown:

```bash
cd C:/v6/MJ/packages/MJAPI
cat > probe.mjs <<'EOF'
import util from 'node:util';
try { await import('./src/index.ts'); }
catch (e) { console.error(util.inspect(e, { depth: 3 })); }
EOF
node --experimental-specifier-resolution=node --import ./register.js -r dotenv/config ./probe.mjs
```

The manifest also **writes the missing dependency into MJ's `package.json`** and tells you to install at the
repo root. On Windows, `ln -s` under Git Bash may COPY a directory instead of linking it, which produces a
real directory with no `package.json` — resolvable-looking and unresolvable. Use a junction:

```powershell
New-Item -ItemType Junction -Path 'C:\v6\MJ\packages\MJAPI\node_modules\@mj-biz-apps\common-entities' `
         -Target 'C:\v6\bizapps-common\packages\Entities'
```

Hit on 2026-08-20: `bizapps-common` appeared in the workspace, the manifest started importing
`@mj-biz-apps/common-entities`, and both MJAPI and MJExplorer refused to start.

**Do not call every exported `Load*`.** Orders exports `LoadPaymentProviderConfig`, which is a real
configuration loader that throws when no provider is configured. It will take your run down before a single
check executes. Call named anchors only.

## 8. Sales does NOT run standalone any more

**This section used to say the opposite, and the change is deliberate.** It read: *"Sales runs standalone
against its own database — `DealLine.ProductID` is a soft reference with no foreign key into orders …
`save-deal` and `close-deal` (30 checks) pass on a Sales-only host."* All three claims are now false, and
leaving them would send someone down a setup path that cannot work.

`DealLine` is retired. A deal carries an **embedded `OrderHeader`**, provisioned inside
`DealEntityServer.Save()` (S-US4), and the lines live on that order in orders' schema. So:

* **A deal cannot be SAVED without bizapps-orders.** Not "features degrade" — the save reaches for
  `MJ_BizApps_Orders: Order Headers` and there is nothing to resolve.
* **`mj-app.json` declares `mj-bizapps-orders` a hard dependency**, so a host without it is misconfigured
  rather than minimal.
* **Every check bundle requires orders**, including `save-deal` and `close-deal`. See
  `scripts/expected-check-counts.json`; `save-deal`'s `Setup` refuses such a host with an explanation rather
  than letting sixteen checks fail one at a time. Because nothing is unconditional any more,
  `assert-check-count.mjs` treats an EMPTY expectation as a failure — otherwise a host with nothing linked
  would pass while running zero checks.

What is still true: **no foreign key crosses the schema boundary for the PRODUCT reference** (D-SW3), and
`Deal.OrderID` is a real FK to orders' `OrderHeader` — the one place sales does depend structurally.

`close-won-contract` remains the only bundle needing bizapps-contracts.
