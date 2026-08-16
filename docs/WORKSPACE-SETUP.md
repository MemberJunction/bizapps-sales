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
for r in bizapps-common bizapps-tasks bizapps-accounting bizapps-orders bizapps-sales; do
  git clone --branch next https://github.com/MemberJunction/$r.git
done
```

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
  # …and so on for tasks, accounting, orders, sales
```

```json
// C:\ws\package.json — TEMPORARY. devDependencies are LOAD-BEARING: without
// typescript and tsc-alias at the parent, member builds fail with
// "tsc-alias: command not found". Copy MJ's devDependencies wholesale.
{ "name": "bootstrap", "private": true, "packageManager": "pnpm@10.33.0", "devDependencies": { /* MJ's */ } }
```

```bash
cd C:\ws && pnpm install
pnpm exec turbo run build --filter "@memberjunction/cli..." --continue
```

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
| 6 | sales | `… migrate --schema __mj_BizAppsSales --dir ./migrations` | 2 |

> **Pass `--schema` explicitly for sales.** Its own `npm run mj:migrate` omits it, and on a shared host the
> bare form writes flyway history into `__mj` — where MJ core's newer migrations already sit — and dies
> with *"Detected resolved migration not applied to database"*. The other four apps pass it already.

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

**Do not call every exported `Load*`.** Orders exports `LoadPaymentProviderConfig`, which is a real
configuration loader that throws when no provider is configured. It will take your run down before a single
check executes. Call named anchors only.

## 8. If you only need Sales

None of the above is required. Sales runs standalone against its own database — `DealLine.ProductID` is a
soft reference with no foreign key into orders, the product picker hides itself when orders is absent, and
the close-won handoff falls back to a stub that reports `Executed: false` with a reason rather than
pretending. `save-deal` and `close-deal` (30 checks) pass on a Sales-only host; `product-picker` and
`close-won-handoff` need orders and are held out of the default gate for exactly that reason.
