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
for r in bizapps-common bizapps-accounting bizapps-orders bizapps-contracts bizapps-sales bizapps-tasks; do
  git clone --branch next https://github.com/MemberJunction/$r.git
done
```

> #### ⚠ EVERY REPO COMES FROM `next` NOW — and two of these lines used to say otherwise
>
> * **bizapps-sales** used to require `feature/embed-order-on-deal`, because `next` trailed the current
>   line by 272 commits and predated the embedded-order redesign entirely. **PR #25 merged that branch
>   into `next` on 2026-08-25**, so the special case is gone. The commit count in this warning had
>   already been corrected from 222 to 242 as the branch moved; a branch name pinned in a document goes
>   stale on every push, which is the reason for landing it rather than documenting around it.
> * **bizapps-tasks** must come from **`next`**, and the line that used to sit here said the opposite.
>   It read: *"one commit AHEAD of `next` on `feature/closewon-task-types`, and that commit is what
>   close-won task creation needs."* One commit ahead was true. It was also **11 commits BEHIND**, and
>   those eleven carry `V202608200800__v1.2.x_TaskType_Code_Statuses_Workflow_Hooks.sql`, which creates
>   `TaskType.Code`. Sales' own `metadata/task-types` keys on `Code`, so cloning tasks the way this
>   document used to say makes sales' metadata push fail outright:
>
>   ```
>   Field "Code" does not exist on entity "MJ_BizApps_Tasks: Task Types"   x2
>   ✗ Validation failed with 2 error(s)
>   ```
>
>   Measured 2026-08-25 on a fresh install, then measured again after applying tasks@`next`: the column
>   appears and `metadata/task-types — 2 created` succeeds. The one commit `feature/closewon-task-types`
>   is ahead by (`cddd76b`) changes a single file, adding those two task types to **tasks'** metadata --
>   rows that `metadata/task-types/.task-types.json` here says tasks *"deliberately does not carry"*,
>   because sales owns them under Amith's 2026-08-20 ruling. So the branch is not merely stale, its one
>   contribution duplicates rows this app is responsible for.
>
> Branch names are recorded here rather than left as "use the current branch", because a tester has no
> way to know which that is. But a recorded branch name goes stale silently, which is exactly what
> happened above -- so check a claim like this against the migration that actually creates the column
> you need, not against the note. `git log --all --oneline -S "<column>" -- migrations/` settles it.

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

## 3b. ALTERNATIVE — installing from PUBLISHED packages

> ## ✅ VERIFIED 2026-08-25 — rehearsed against the live registry
>
> This section was written before the packages existed, as a hypothesis. It has now been **executed**
> against the real registry, in a clean directory outside any workspace, with all five packages live at
> `5.1.0`. Two of the four risks it named turned out to be non-issues; the other two are recorded
> honestly below as still-untested. The measured results are inlined throughout — where a claim below
> says *measured*, it was.
>
> One correction to the reasoning above: the sequence is right, but step 2 is **not sufficient on its
> own** and step 3 is not optional. That was already stated; the run confirms it.

### THE APP SHIPS THROUGH TWO CHANNELS, AND ONLY ONE OF THEM IS NPM

This is the thing to understand before deciding whether publishing removes the need for a clone. It
does not. `mj-app.json` declares the two halves separately:

| Half | Where it comes from | Declared as |
|---|---|---|
| Database schema | **the repository** | `"migrations": { "directory": "migrations", "engine": "skyway" }` |
| Entity metadata, type tables, actions | **the repository** | `"metadata": { "directory": "metadata" }` |
| Demo and dev data | **the repository** | `scripts/seed-dev-data.sh`, `scripts/seed-demo-data.sh` |
| Runtime code | **npm** | `@mj-biz-apps/sales-server`, `-ng`, `-entities`, `-actions` |

The npm packages carry `files: ["/dist"]`. Verified with `npm pack --dry-run`: the tarballs contain
compiled JavaScript, type declarations, `package.json` and `LICENSE` — **no migrations, no metadata, no
seed scripts**. The manifest references those by DIRECTORY PATH, which only resolves against a
checkout.

**So a tester still needs this repository.** What publishing removes is the need to BUILD it.

### What actually changes

Sections 2 and 3 — the chicken-and-egg CLI bootstrap, the borrowed `turbo.json`, the
`strict-peer-dependencies` edit, `linkWorkspacePackages` — exist only because you are compiling MJ and
six apps from source. Installing published packages into an existing MJ host removes all of it.

Sections 4, 5 and 6 do not change. They are the repository half, and they are the same either way.

### The sequence, as reasoned

```bash
# 1. An MJ host at a version satisfying mj-app.json's mjVersionRange (>=6.1.0-edge.2 <7.0.0).
#    NOTE: MJ core's `latest` on npm is still 5.51.1 -- the v6 line is a PRERELEASE, so THE HOST must
#    be installed explicitly by version, not by tag. This does NOT apply to the step-2 install below:
#    sales' own `^6.1.0-edge.3` ranges resolve to 6.1.0-edge.3 unaided (measured 2026-08-25).

# 2. The four runtime packages into that host:
npm install @mj-biz-apps/sales-server @mj-biz-apps/sales-ng             @mj-biz-apps/sales-entities @mj-biz-apps/sales-actions

# 3. Clone THIS repository anyway, for the database half:
git clone --branch next https://github.com/MemberJunction/bizapps-sales.git
```

Then run **sections 4, 5 and 6 exactly as written**, from the clone — migrate in the documented order,
seed, build and verify. Section 6's build step becomes unnecessary for
sales itself, since its code arrives compiled.

The server and client packages carry `"role": "bootstrap"` with `startupExport`
`LoadBizAppsSalesServer` / `LoadBizAppsSalesClient`, so the host must load them at startup the way it
does for the other apps — MJAPI's startup log lists them as *"Loaded Open App server package"*.

### What was actually wrong — measured, not reasoned

The four risks this section originally named, each with the result of running it. Rehearsed
2026-08-25 in an empty directory (`npm init -y`, then the step-2 install verbatim), with **no
workspace, no symlinks and no `node_modules` inherited from anywhere**.

* **Version resolution — NOT A PROBLEM. The worry was unfounded.** The concern was that MJ's `latest`
  being `5.51.1` would make `^6.1.0-edge.3` pull the wrong major. It does not: npm resolved every MJ
  package to `6.1.0-edge.3` exactly. A caret range whose base is a prerelease still only matches
  within that major, and the prerelease comparator sits on the same `6.1.0` tuple, so `5.51.1` is
  never a candidate. Measured:

  ```
  @memberjunction/core                    6.1.0-edge.3
  @memberjunction/global                  6.1.0-edge.3
  @memberjunction/core-entities           6.1.0-edge.3
  @memberjunction/sqlserver-dataprovider  6.1.0-edge.3
  @memberjunction/actions-base            6.1.0-edge.3
  ```

  843 packages installed, exit 0. npm prints a run of `ERESOLVE overriding peer dependency` **warnings**
  — they are warnings, the install succeeds, and no `--legacy-peer-deps` or `--force` was needed.
  Siblings arrive transitively: `orders-entities@5.1.0`, `common-entities@5.35.1`, `tasks-*@1.3.0`.

* **Which repository revision — NOT A PROBLEM, and now provable.** The original worry was that
  installing `5.1.0` while cloning a newer `next` would pair code with mismatched schema. It does not
  today: every published file was compared byte-for-byte against a local build of `origin/next`
  @ `e40c460`, and **all 178 files in all five packages are identical** —
  `sales-ng` 90, `sales-core-entities-server` 52, `sales-entities` 20, `sales-server` 12,
  `sales-actions` 4. Zero differing, zero extra.

  ⚠️ **This is a fact about today, not a guarantee.** `npm publish` recorded **no `gitHead`** in any of
  the five packages, so provenance cannot be read back out of the registry — the only way to check the
  pairing is the byte comparison above. Re-run it whenever `next` moves without a republish:

  ```bash
  # from a directory where the published packages are installed
  cmp -s node_modules/@mj-biz-apps/sales-entities/dist/index.js          /path/to/bizapps-sales/packages/Entities/dist/index.js && echo MATCH || echo DIVERGED
  ```

* **`mjVersionRange` enforcement — STILL UNTESTED.** Nothing in this rehearsal exercised it, because
  nothing installed the app *as an Open App* — the packages were installed as plain npm dependencies.
  The range is `>=6.1.0-edge.2 <7.0.0` and it does admit the `6.1.0-edge.3` that npm actually
  resolves, so the two are at least consistent. Whether a host rejects or ignores a mismatch is
  unknown.

* **Startup registration — PARTIALLY TESTED.** The bootstrap exports exist and are importable from the
  published artifacts, which is the half that can be checked without a host:
  `LoadBizAppsSalesServer` is exported by `sales-server`; `sales-entities` exposes 104 exports and
  `sales-core-entities-server` 144. What is **not** tested is whether an MJ host actually calls them at
  startup. If it does not, the KI-21 failure shape applies and deals fail looking like a permissions
  problem.

### One thing to know before you smoke-test

`@mj-biz-apps/sales-server` **reads MJ configuration at import time**, so importing it with no config
present throws before any of your code runs:

```
No config file found, using DEFAULT_SERVER_CONFIG
Error parsing config file [ dbDatabase / dbUsername / dbPassword — "Required" ]
Configuration validation failed
```

This is MJ core's config loader, **not a sales defect** — the other three packages import cleanly with
no config at all. A real host always has a config, so this only bites a bare `node -e "import(...)"`
smoke test. Drop an `mj.config.cjs` next to it and the import succeeds (9 exports). Worth knowing
because the error names database fields and reads like a connectivity failure, which it is not.

### What this rehearsal did NOT cover

Stated so nobody reads the green banner as broader than it is:

* No MJ host was started, so nothing exercised Open App discovery, `mjVersionRange`, or startup
  bootstrap invocation.
* No UI was loaded from the published `sales-ng`; only its bundle contents were compared.
* The database half was built the normal way, from this repository — **section 3b changes nothing
  about sections 4–6**, and those remain the tested path.

---

## 3c. EVERY REPO MOVES TOGETHER, OR THE FAILURES LOOK LIKE PRODUCT BUGS

Measured 2026-08-25, after a session lost hours to it. If your workspace has been sitting for more
than a few days, read this before believing any failure.

### The symptom does not name the cause

Checkouts trailing the database produce failures that read exactly like Sales bugs:

```
the deal "PW-LIFE-... lifecycle" must exist in the database after saving -- no row appeared
fixture: "Close CL-... won" reported saved but no row exists
Cannot query field "Origin" on type "mjBizAppsOrdersOrderHeader_"
```

**A save that reports success and writes nothing is the signature.** It is the same
`INSERT INTO @ResultTable EXEC sp...` column-count mismatch as KI-28 arriving from the other side:
the database knows a column the compiled entity class does not, the counts differ, and the
transaction aborts under a UI that has already said "saved".

When this bit, the checkouts were **59** (orders), **47** (accounting), **17** (tasks) and
**204** (MJ) commits behind a database built from `origin/next`. Nothing was wrong with Sales.

### Check alignment first

```bash
for r in MJ bizapps-common bizapps-tasks bizapps-accounting bizapps-orders bizapps-sales; do
  cd /c/v6/$r || continue
  git fetch -q origin
  echo "$r behind=$(git rev-list --count HEAD..origin/next) dirty=$(git status --porcelain | wc -l) branch=$(git rev-parse --abbrev-ref HEAD)"
done
```

Everything should read `behind=0`. If it does not, fix that before filing anything.

### MJ published 6.1.0-edge.3 and MJ next are NOT the same code

The nastiest one. MJ has not bumped its version since publishing `edge.3`, so the registry tarball
and the local `next` build **share a version number and differ in content**. pnpm cannot tell them
apart. A package that does not *declare* `@memberjunction/global` directly --
`orders-core-entities-server`, for one -- resolves it by hoisting and can get the registry copy,
which lacks exports its code imports:

```
error TS2305: Module "@memberjunction/global" has no exported member EscapeSQLString
error TS2305: Module "@memberjunction/core-entities" has no exported member BaseIdentityClaimDriver
```

**`linkWorkspacePackages: true` does not prevent this, and neither does `preferWorkspacePackages`.**
Both were set and both were measured; neither applies when the version literally matches and the
package is not a declared dependency.

Make local-wins unconditional in the generated root `/c/v6/package.json` -- an override per
`@memberjunction/*` package (306 here, so generate it):

```json
{ "pnpm": { "overrides": { "@memberjunction/global": "workspace:*" } } }
```

**Use `workspace:*`, never `link:`.** `link:` symlinks a package without installing its own
dependencies, which produced `Cannot find package axios imported from MJServer/dist/...` and a
server that would not boot. That was tried first. It is a dead end.

### Three more that cost time

* **A stale `dist` outlives its source.** After MJ moved, `MJServer/dist` still imported `axios`,
  which its current source does not import at all. Clear it with `turbo run build --force` on the
  affected filter. A build that succeeds from cache proves nothing after a large upstream jump.
* **The database has to catch up too.** With MJ updated, the API refused to start with
  `Entity MJ: Identity Claim Types not found in metadata` -- code ahead of schema. Run `mj migrate`
  from MJ against your database (5 migrations here, 510 to 512 entities).
* **Orphaned servers squat on ports.** A failed API start can leave a child holding 4143 and the
  next attempt dies with `EADDRINUSE`. Check the listener PID and its start time before assuming
  the port is yours.

---
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
| 7 | sales | `… migrate --schema __mj_BizAppsSales --dir ./migrations` | **4** — see below |

> ⚠️ **Contracts migrates LAST, and does not currently install on a fresh database.** It FKs into
> common, tasks, orders AND accounting — the full stack — so nothing else may follow it. More
> importantly its baseline hardcodes other apps' entity UUIDs and fails on any machine but the one its
> CodeGen ran on. Read `docs/KNOWN-ISSUES.md` **KI-13** before attempting it: the first error names the
> wrong table, and three of the six broken references fail *silently* as a column-count mismatch that
> breaks every insert. Always column-diff contracts' ten entities after installing.

> ⚠️ **Sales applies FOUR migrations, not two.** The baseline pair (`B…Schema`, `V…Tables_and_Objects`)
> was joined on 2026-08-21 by `V202608211200__…DealStageEvent_Amount_Provenance` and
> `V202608211201__…Refresh_DealStageEvent_View`. This table said 2 until it was measured against a
> genuinely empty database.
>
> That staleness has the same cause as a known issue worth reading: **an applied migration in this repo
> can be silently rewritten.** `V202608042101` has been edited four times since it applied on 2026-08-13
> at checksum 666373835, and those two Aug 21 migrations went on applying cleanly without Flyway ever
> objecting to the changed checksum. So the file on disk and the file that built a long-lived database
> are different artefacts, and nothing detects the divergence — which is exactly why `MJ_V6_Host` worked
> while a fresh install did not.

> **Sales' `mj:migrate` now passes `--schema` itself**, so `npm run mj:migrate` is safe. It did not until
> this pass: the bare form wrote flyway history into `__mj` — where MJ core's newer migrations already sit
> — and died with *"Detected resolved migration not applied to database"*, an error that names a migration
> and tells you nothing about the schema. Fixed to match the other four apps.

**No CodeGen run is needed to register ENTITIES.** Each app's baseline carries its generated half, so
after step 6 the database already has all ~500 entities registered (20 sales, 49 orders, 23 accounting, 19
tasks, 10 common). If you find yourself about to run CodeGen to "register entities", stop — something else
is wrong.

> ### ⚠ BUT SOME FIELDS ARE NOT REGISTERED, AND THIS SENTENCE USED TO CLAIM OTHERWISE
>
> This paragraph read *"No CodeGen run is needed"* without qualification. **That is false for FIELDS**, and
> the way it fails is expensive to diagnose, so it is worth the detail.
>
> Several orders migrations add a column and deliberately leave its `EntityField` row to CodeGen.
> `bizapps-orders/migrations/V202608101200__v0.1.x__Pricing_driver_class.sql` says so in its own header:
>
> > *"registering them as `EntityField` rows is CodeGen's job. The generated SQL is deliberately NOT
> > shipped alongside … Migrate, then generate."*
>
> So a database built from migrations alone ends up with `__mj.EntityField` **short of what the views
> actually expose**. Measured 2026-08-25 on a fresh all-`next` install (`MJ_Sales_Latest`): **10 columns
> across 6 orders entities**, four of them on entities **sales writes** —
>
> | Entity | Missing from `EntityField` |
> |---|---|
> | `Order Headers` | `Origin`, `SourceCheckoutWidgetID`, `SourceCheckoutWidget` |
> | `Order Lines` | `RootReversesOrderLineID` |
> | `Products` | `RootSuccessorProductID` |
> | `Product Types` | `PricingDriverClass` |
> | `Subscriptions` | `RootMigratesFromSubscriptionID`, `RootMigratesToSubscriptionID` |
> | `Payment Headers` | `RootReversesPaymentHeaderID` |
> | `Checkout Sessions` | `Distribution` |
>
> **The failure does not mention metadata.** Saving any affected entity builds `@ResultTable` from
> `EntityField` and then does `INSERT INTO @ResultTable EXEC sp<Create|Update><Entity>`. The proc returns
> the *view's* columns, so the counts differ and SQL Server says:
>
> ```
> Column name or number of supplied values does not match table definition.
> ```
>
> …followed by several hundred lines of generated SQL. Nothing in it points at `EntityField`. If you are
> reading that error, run the query below before anything else.
>
> **Why the demo host never showed this:** `MJ_V6_Host` has had CodeGen run on it and measures **0 drift**.
> Only a *fresh* install exhibits it — which is exactly what QA does.
>
> **Detect it** (returns nothing when clean):
>
> ```sql
> SELECT e.Name, c.name AS MissingField
> FROM __mj.Entity e
> JOIN sys.views v ON v.name = e.BaseView
> JOIN sys.schemas s ON s.schema_id = v.schema_id AND s.name = e.SchemaName
> JOIN sys.columns c ON c.object_id = v.object_id
> WHERE NOT EXISTS (SELECT 1 FROM __mj.EntityField ef WHERE ef.EntityID = e.ID AND ef.Name = c.name)
> ORDER BY e.Name, c.column_id;
> ```
>
> **Fixing it requires running CodeGen. No SQL shortcut exists — this was tested.**
>
> The obvious-looking fix does **not** work:
>
> ```sql
> -- Run on MJ_Sales_Latest 2026-08-25. Drift stayed at exactly 10.
> EXEC __mj.spUpdateExistingEntitiesFromSchema      @ExcludedSchemaNames = 'sys,staging';
> EXEC __mj.spUpdateExistingEntityFieldsFromSchema  @ExcludedSchemaNames = 'sys,staging', @EntityIDs = NULL;
> ```
>
> `spUpdateExistingEntityFieldsFromSchema` filters on `AND ef.ID IS NOT NULL` — it updates existing rows
> and cannot create missing ones. Neither can `MJ/migrations/R__RefreshMetadata.sql`, which runs those two
> plus `spUpdateSchemaInfoFromDatabase` and `spDeleteUnneededEntityFields` — all update-or-delete.
>
> New `EntityField` rows are created only by CodeGen's `createNewEntityFieldsFromSchema()` in
> `CodeGenLib/src/Database/manage-metadata.ts`. See **KI-28** for the full detail and for why this needs
> Amith rather than a local decision.
>
> Pushing orders' `metadata/entity-fields` does **not** fix this — checked on `origin/next`, that directory
> holds only the two embedded-field overrides and none of the ten.

## 5. Seed, in this order

> ### ⚠ THE ORDER IS LOAD-BEARING, AND THE FAILURE IT PREVENTS NAMES THE WRONG THING
>
> Push metadata FIRST, then seed. Both `metadata/pipelines/.sales-pipelines.json` and
> `scripts/seed-demo-data.sh` set `Pipeline.CompanyID`, and they disagree: the metadata says
> **Default Company** (correct on a fresh database, where nothing else exists), the seed splits the two
> pipelines across **Blue Cypress** and **BC Education Group** so the demo can show that every rollup
> slices by company.
>
> In this order the seed lands last and everything is right. **Push again after seeding and the
> metadata wins**, both pipelines collapse onto a company that owns no products, and every product
> picker in the app goes empty. What you see is `locator.selectOption` timeouts and *"the orders
> catalogue did not load"* -- nine failures in one run, none of which mentions a company or a pipeline.
> Measured 2026-08-25. See **KI-26** for the repair, which is to re-run `seed-demo-data.sh`.
>
> This matters because the push is also the remedy for other things -- a missing action, a stale remote
> operation -- so there is a real reason to run it later in a host's life. When you do, re-seed after.


> ### ⚠️ NONE OF THE COMMANDS BELOW NAME A DATABASE. They hit whatever `.env` says.
>
> On a machine with one database this is fine and you can ignore it. On **this** machine it is a live
> trap, and it has already cost us once: `.env` in **both** `bizapps-sales` and `bizapps-orders`
> reads `DB_DATABASE=MJ_V6_Host` — the **recording host**. A bare `mj sync push` from either repo
> therefore rewrites the demo stack, not your workspace database. That is the exact mechanism behind
> KI-26, where a push repointed both pipelines at a company owning no products and emptied every
> product picker.
>
> Prefix every push and every seed with the database you actually mean:
>
> ```bash
> DB_DATABASE=MJ_Sales_Latest node ../MJ/packages/MJCLI/bin/run.js sync push --dir <dirs>
> ```
>
> The prefix is safe and it does win — `mj.config.cjs` calls `dotenv.config()`, which by design does
> **not** overwrite a variable already present in the environment. Verified 2026-08-25:
> `DB_DATABASE=MJ_Sales_Latest node -e "console.log(require('./mj.config.cjs').dbDatabase)"` prints
> `MJ_Sales_Latest`, not the `.env` value. Note this is the **opposite** of the bug fixed in this
> repo's shell scripts, where `set -a; source .env` clobbered the caller's override — same symptom,
> reversed cause, so do not assume one from the other.

```bash
# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE ORDER BELOW IS THE ONE THAT WORKS -- with one caveat, stated up front.
#
# Every step here was executed on 2026-08-25 and every claim about what breaks was measured by
# hitting it. What has NOT been done is running this sequence start to finish in one clean pass --
# it was reconstructed from a session that arrived at a working database by a messier route. The
# steps and their order are right; treat the SEQUENCE as reasoned until someone rebuilds from empty
# and confirms it, then delete this paragraph.
# Three things changed from the version this file used to carry, and each was a hard failure:
#   1. CodeGen now runs FIRST. Without it the orders push in (b) fails outright -- see KI-28.
#   2. bizapps-common is pushed. It was missing entirely, costing the six ActivityType codes.
#   3. The catalogue is seeded BEFORE the demo data, not after. Reversed, every deal is
#      provisioned with no product to embed and comes up with no order.
# ══════════════════════════════════════════════════════════════════════════════════════════════

# a. CODEGEN, for orders and common. Migrate, then generate.
#
#    Several orders migrations add a column and leave its EntityField row to CodeGen; common's
#    activity tables are not registered as entities at all. Skip this and step (b) dies with
#    "Column name or number of supplied values does not match table definition" -- several hundred
#    lines of generated SQL naming neither EntityField nor the column. KI-28 has the full detail.
#
#    Each app's mj.config.cjs excludes every schema but its own, so these are scoped, not global.
cd C:\ws\bizapps-orders && DB_DATABASE=<your-db> node ../MJ/packages/MJCLI/bin/run.js codegen
cd C:\ws\bizapps-common && DB_DATABASE=<your-db> node ../MJ/packages/MJCLI/bin/run.js codegen

#    Verify before continuing -- this must return NOTHING:
#      SELECT e.Name, c.name FROM __mj.Entity e
#        JOIN sys.views v ON v.name = e.BaseView
#        JOIN sys.schemas s ON s.schema_id = v.schema_id AND s.name = e.SchemaName
#        JOIN sys.columns c ON c.object_id = v.object_id
#       WHERE NOT EXISTS (SELECT 1 FROM __mj.EntityField ef
#                          WHERE ef.EntityID = e.ID AND ef.Name = c.name);
#
#    ⚠ CodeGen also REWRITES that repo's generated TypeScript, against the database you point it at.
#    Point it at an under-provisioned one and it will happily replace good generated code with worse
#    (it dropped OrderHeader.Lines here and broke the workspace build). Discard those file changes
#    afterwards -- `git checkout -- .` in that repo -- which is what Amith means by "discard CodeGen
#    output". The DATABASE rows are what you came for; the files are a side effect.

# b. app metadata — type tables, remote operations, and (for sales) the form chrome
#
#    --exclude queries USED TO BE REQUIRED here and no longer is (KI-25, fixed 2026-08-25). If you are
#    reading an older copy of this file, drop that flag: the queries seed with everything else now, and
#    excluding them costs you the dashboard.
cd C:\ws\bizapps-sales      && node ../MJ/packages/MJCLI/bin/run.js sync push --dir metadata
cd C:\ws\bizapps-accounting && node ../MJ/packages/MJCLI/bin/run.js sync push --dir <currencies, gl-account-roles, journal-entry-types>
cd C:\ws\bizapps-orders     && node ../MJ/packages/MJCLI/bin/run.js sync push --dir <product/revrec/subscription types, remote-operations + categories, journal-entry-types, payment & charge types>
cd C:\ws\bizapps-common     && node ../MJ/packages/MJCLI/bin/run.js sync push --dir <activity-types, address-types, contact-types, organization-types, relationship-types>

#    bizapps-common is the line that used to be missing. activity-types carries the six codes
#    (Call, Email, Meeting, Note, ...) that every Activity is resolved BY CODE against; without them
#    15 activity checks fail with "No ActivityType with Code 'Email' exists".
#
#    Do NOT include common's application-roles here: it looks up an Applications record named
#    'Common' that this sequence never creates, and the whole push rolls back on it.

# c. sales dev data — companies, pipelines, accounts, contacts
cd C:\ws\bizapps-sales && bash scripts/seed-dev-data.sh

# d. orders catalogue, then the six accounting/pricing layers. BEFORE the demo data.
sqlcmd … -i scripts/dev/seed-orders-catalog.sql
sqlcmd … -i scripts/dev/seed-revenue-stack.sql
```

> ### e. THEN the demo data — last, because it embeds what the catalogue provides
>
> ```bash
> cd C:\ws\bizapps-sales && bash scripts/seed-demo-data.sh
> ```
>
> This used to sit in step (b), ahead of the catalogue. Run in that order it still "succeeds" — it
> reports seven deals — but every one of them is provisioned with **no order**, because there was no
> sellable product to embed. Nothing warns you. It surfaces later as fifteen integration failures
> reading `setup: no order on this host`, which name neither the seed nor its ordering.
>
> The seed tears its own `DEAL-9%` rows down first and is idempotent, so if you have already run it
> in the wrong order, just run it again after the catalogue. Confirm with the line it prints:
> **`deals w/ order   7`**. If that reads 0, the catalogue was not there when it ran.


> ### Narrow pushes: assemble a temp parent, and copy `.mj-sync.json` into it
>
> `mj sync push` discovers entity directories **beneath** `--dir`. Pointing it at a single leaf directory
> fails with *"No entity directories found"*, so assemble a temp parent holding just the dirs you want.
>
> **Copy the metadata root's `.mj-sync.json` in alongside them.** Without it the push refuses:
>
> ```
> No .mj-sync.json configuration file found in directory
> ✗ Validation failed with 1 error(s)
> ```
>
> That file is not a formality — it carries `directoryOrder`, and for these directories the order is
> load-bearing: `remote-operation-categories` must precede `remote-operations`, or every operation
> fails its `CategoryID` lookup. Copy it, do not hand-write it.
>
> **A temp parent is also how you keep the source repo clean, which matters more than the discovery
> rule.** `sync push` **writes back into the files you point it at** — `PushService` assigns
> `record.primaryKey = newPrimaryKey` after creating a record and writes it to the source file via
> `JsonWriteHelper.writeOrderedRecordData`. Point it at another app's `metadata/` and you dirty that
> repo's working tree with generated IDs; point it at a copy and the writeback lands in the copy. This is
> what Amith means by *"discard CodeGen or mj sync output"*.
>
> **`--dry-run` will report lookup failures that a real push does not have.** Dry run does not create
> records, so any cross-directory reference — `remote-operations` → `remote-operation-categories` here —
> fails to resolve against a database where the target does not yet exist:
>
> ```
> ❌ LOOKUP FAILURE in MJ: Remote Operations
>    Error: Lookup failed: No record found in 'MJ: Remote Operation Categories' where Name='Order Pricing'
> ```
>
> That is an artifact of dry run, not a defect in the metadata. Read it as *"this record depends on one
> that would have been created a moment earlier"*, and check `directoryOrder` rather than the record.

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
# RUN_MUTATION_TESTS=1 node test-harnesses/smoke-close-won.mjs               # ⚠ SEE BELOW -- 5/11
```

> ### ⚠ `smoke-close-won.mjs` IS ROTTED. It is commented out above, and 11/11 was never re-measured.
>
> Measured 2026-08-25: **5/11**, and before repair it did not run at all. It had accumulated three
> dead references from changes that landed without it being re-run — which is why the number in this
> document went stale silently rather than going red.
>
> | Dead reference | Left by |
> |---|---|
> | `MJ_BizApps_Sales: Deal Line Types` | the `DealLine` retirement — **the entity exists on no host**, so this threw `Entity ... not found in metadata` at step 2 |
> | `deal.Lines.Create()` | same retirement — lines live on the embedded order now |
> | `preview.Amount` | the `PreviewOrderMoney` removal — a `ReferenceError` on a variable whose assignment had already been deleted |
>
> The first two and the third are fixed. What remains is **not** a stale reference and is not a quick
> repair: `ClassFactory` falls back to `BaseEntity` inside this harness, so `DealEntityServer` never
> provisions the embedded order (`deal.OrderID` stays `undefined`) and `OrderLineEntityServer` never
> stamps `UnitPrice`/`LineNumber`. That is a harness bootstrap problem in the same family as KI-17.
>
> **Nothing is uncovered by leaving it.** Every behaviour it asserts is also asserted by
> `integration.mjs`, which is green at **126/6** on this same database — the 6 being contracts checks
> on a host without contracts. Use that as the gate; treat this harness as needing repair before it is
> quoted again.

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
