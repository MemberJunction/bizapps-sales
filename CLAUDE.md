# GENERAL RULE
Don't say "You're absolutely right" each time I correct you. Mix it up, that's so boring!

# BizApps Sales Development Guide

Deal pipeline management built on [MemberJunction](https://github.com/MemberJunction/MJ), and the top
layer of the BizApps revenue stack:

```
sales (deal) → contracts (agreement) → orders (order+payment+subscription) → accounting (JE ledger) → ERP
```

**The app's source of truth is `plans/bizapps-sales-master.md`.** It stays on the `an-master-plan`
branch (`docs/DECISIONS.md` D7); read it with
`git show origin/an-master-plan:plans/bizapps-sales-master.md`. Where this file and the master plan
disagree, the master plan wins — **except** where `docs/DECISIONS.md` records a ruling that supersedes
it.

**Read first:**
- **`docs/DECISIONS.md`** — the rulings that govern this app, each with its reasoning.
- **`docs/KNOWN-ISSUES.md`** — live risks that cannot be fixed from this repo.
- **`docs/PUBLISHING.md`** — how a release is cut. Read it before touching `metadata/`.
- **`docs/README.md`** — every doc in the repo, and whether it is current or history.

**Metadata PRs contribute declarative JSON only:** fields, `@lookup`/`@file`/`@parent`, a `uuidgen`
primaryKey, no `sync` block, no `*__Metadata_Sync.sql`. The build engineer generates ONE consolidated
Metadata_Sync per release from a clean DB; the model is MJ's
[Release Metadata Migrations Guide](https://github.com/MemberJunction/MJ/blob/next/guides/RELEASE_METADATA_MIGRATIONS_GUIDE.md).
`pnpm run lint:distribution` checks only that shipped SQL uses placeholders `mj app install` can
resolve. `check:release-seed` is the metadata↔seed currency gate; `repo: release seed` (`repo-checks.yml`)
runs it on the Version Packages PR, so a release can't merge while `metadata/` is ahead of its
Metadata_Sync.

## Repository Structure

```
bizapps-sales/
  mj-app.json          - MJ Open App manifest (schema, dependencies, packages, mjVersionRange)
  mj.config.cjs        - CodeGen + CLI config; DB credentials come from .env
  codegen-schema-info.json - the IsA (Table-Per-Type) declarations
  .env.example         - every environment variable the repo reads, with placeholders
  .mj-links.json       - local sibling links (empty: every dependency is published to npm)
  migrations/          - B... schema, V... changes; the baseline carries its CodeGen half below a banner
  migrations-teardown/ - retires this app's rows from __mj on `mj app remove`
  metadata/            - type-table seeds and app metadata, pushed with `mj sync push`
  packages/
    Entities/          - @mj-biz-apps/sales-entities (generated entities, remote-operation contracts, shared rules)
    Actions/           - @mj-biz-apps/sales-actions
    Server/            - @mj-biz-apps/sales-server (bootstrap + GraphQL resolvers)
    CoreEntitiesServer/- @mj-biz-apps/sales-core-entities-server (Save() overrides, the close lock, Sales.CloseDeal)
    Angular/           - @mj-biz-apps/sales-ng (generated forms, the Deals section)
    IntegrationTests/  - @mj-biz-apps/sales-integration-tests (private; the integration check bundles)
  scripts/             - CI gates, rebuild-db.sh, seeds, release checks
  test-harnesses/      - integration runner, mutation driver, Playwright Explorer harness
```

---

## THE THREE RULES THIS APP EXISTS TO UPHOLD

These are not style preferences. Each one is a guarantee the app sells, and each has a specific
failure mode that arrives by accretion if it is not defended.

### 1. Sales NEVER computes money
Orders computes every number. A deal's lines are `OrderLine` rows on the `OrderHeader` that
`DealEntityServer` provisions for the deal (`Deal.OrderID`). Sales records **intent** on them —
product, quantity, requested discount, term — and orders prices them.

**Never, in any file:** multiply quantity by price · apply a discount percentage · compute tax ·
prorate a partial period · sum lines into a header total · round anything. `pnpm run test:money-gate`
watches for this; it is a heuristic, not a proof.

- `UnitPrice`, `PriceComponentsJSON`, the line's `CompanyID` and every total are **orders' fields** —
  never computed in sales, never hand-edited.
- `Deal.Amount` is a **cached copy of `OrderHeader.TotalGross`** with provenance: `AmountIsComputed`,
  `AmountComputedAt`, `AmountSourceHash` (`DealEntityServer.refreshAmountFromOrder`). Lined deals always
  take the order total (sales never sums lines). A typed figure survives only on a header-only deal.
- An override price on a line is an **input** to orders' pricing, never a replacement for the totals
  orders computes on top of it.
- A rep enters a discount as a **percent**; `OrderLine.DiscountPct` stores a **fraction**. Convert only
  in `packages/Entities/src/discount-conversion.ts` (`pnpm run test:discount-gate`), never at a call
  site (D-DL2).
- Closing does not create or price a second order. The deal's own order changes status when the deal
  enters a stage that names one (`PipelineStage.OrderStatusOnEntry`).

### 2. Domain vocabulary is DATA, never code
Type tables carry the **behaviour flags** the engine branches on. The engine reads
`DealStatusType.IsWon`; it **never** compares a status or stage name.

- **`pnpm run test:vocabulary-gate` enforces this.** It is green today and must stay green. Read
  `scripts/assert-no-vocabulary-comparisons.mjs` before arguing with it.
- CHECK constraints are for **structural invariants only** — exactly-one-of FKs, date ordering,
  non-negative or bounded numerics. **Never** for domain vocabulary.
- Stages carry no `IsWon`/`IsClosed`; they point at a `DealStatusType` that does. That is what makes
  "Closed Won" a label, so a pipeline can call its winning stage "Signed" with no code aware of it.
- New vocabulary is a **metadata change** — a row under `metadata/<type>/` with a hardcoded UUID.
  **Never a SQL `INSERT` in a migration.**

### 3. Provenance is immutable — "pen, not pencil"
- `DealStageEvent` is **append-only**, never edited, and stamps `AmountAtTransition` /
  `ProbabilityAtTransition`. `DealEntityServer` appends it inside the save's transaction. Without those
  stamps, "what did we think the forecast was on the 1st" is unanswerable once amounts change.
- When a deal enters a status where `DealStatusType.LocksDeal = 1`, the deal, its order's lines, its
  payment schedule and its team become **immutable — enforced on the server, never in the UI**
  (`DealEntityServer.Save()`, and `DealLockOrderLineVeto` for saves made through orders), so an Action,
  an agent or a raw `BaseEntity.Save()` all hit the same wall. Reopening goes through
  `Sales.ReopenDeal`, which records a reason.
- The HubSpot importer (not built yet) must **bypass the lock by an explicit, audited path** —
  historical deals arrive already closed — and must preserve **original timestamps** on
  `DealStageEvent.ChangedAt`.

### Two traps worth knowing before you write a query
- **Attribution double-count.** A deal with an AE, an SE and an SDR has three `DealTeamMember` rows;
  summing `Deal.Amount` across that table **triple-counts the deal**. Every by-rep or by-role rollup
  must either filter to the owner role (`DealRole.IsOwnerRole = 1`) or weight by `AttributionPct`.
  State which, in the report definition. There is no safe default serving both "bookings by AE" and
  "deals I was involved in".
- **Denormalized stamps are server-maintained.** `DealEntityServer` writes `Deal.OwnerEmployeeID` from
  the owner-role team member; orders stamps `OrderLine.CompanyID` from the product. **Never hand-set
  them.** `DealTeamMember` is the source of truth for membership, including the owner.

---

## CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE

### 1. NO COMMITS WITHOUT EXPLICIT APPROVAL
- **NEVER run `git commit` without the user explicitly asking you to**
- **Each commit requires ONE-TIME explicit approval** — don't assume ongoing permission
- **NEVER ask to commit** — wait for the user to request it
- **ONLY commit what is staged** — never modify or add to staged changes

### 2. NO `any` TYPES - EVER
- No `as any`, no `: any`, no `<any>`, no `unknown` as a lazy alternative
- **ALWAYS ask** if you think you need one. MJ has strong typing throughout.

### 3. FEATURE BRANCHES CUT FROM `next`
- `next` is the integration branch; `main` is the release branch (publishes on push).
- `git checkout next && git pull && git checkout -b <feature-name>`, then `git push -u origin <same-name>`.
- Verify with `git branch -vv` before every push: it must track `origin/<same-branch-name>`.
- **Never commit directly to `main`.**

### 4. NEVER EDIT GENERATED CODE
`packages/*/src/generated/`, `packages/Angular/src/lib/generated/` — CodeGen overwrites it.

### 5. ON A MERGE FROM A FAR-BEHIND BRANCH, BUILD BEFORE YOU TRUST A CLEAN AUTO-MERGE
The damage hides in the hunks git merged cleanly: "no conflict" means "no textual overlap", not
"correct". Run `pnpm run build` immediately after a stale merge, BEFORE the suite; if turbo reports
`FULL TURBO` on a merge that changed source, force it. Review `git diff <pre-merge-sha> --stat`, not the
conflict list. When merging feature branches together, record the head you actually merged
(`git rev-parse`), not the branch name: a green suite cannot detect work that never arrived.

### 6. NEVER KILL A PROCESS YOU CANNOT PROVE YOU OWN
- **The test is your OWN `claude.exe` PID, not the existence of one:** the candidate's parent chain must
  reach the `claude.exe` that is your own parent. Anything else belongs to another session.
- **`ps -W` prints no command-line arguments**, so it can never find a run by script name. Use
  `Get-CimInstance Win32_Process` (it has `CommandLine` and `ParentProcessId`).
- If you cannot establish ownership, **do not kill it.** Say what you see and ask.
- **A Bash call that hits its ten-minute ceiling DETACHES the process; it does not kill it.** A run that
  seems stuck is most likely queued on the suite lock behind your own orphan.
- The stranded-mutation recovery (`git checkout --` plus a rebuild) is **destructive against a live
  run**: it compiles and tests unmutated code out from under it.

### 7. WHILE A MUTATION RUN IS LIVE, THE TREE IS NOT EVIDENCE
The mutation driver **edits source in place**, builds, runs the suite, then restores. While any mutation
run is live, **do not stage or commit** (you would commit a mutant), and **do not treat `git status`, a
grep or an anchor check as truth**: the driver restores source, but `dist/` can still hold the mutation.
Wait for the run to report, then re-read. If you did not start the run, see rule 6.

### 8. THE DEFENCE IS NOT CARE. IT IS ARRANGING FOR THE CLAIM TO BE RE-CHECKED WHEN IT IS USED
Most defects here were **a claim that was true when somebody checked it, and stayed asserted after it
stopped being true.** Make the check happen where the claim is USED, not where it was made:

* Do not index a collection and then assert which row it is — **find the row, then assert about it.**
* Run the anchor validator **after** an edit, not before. Before tells you the state you are leaving.
* **Filter, do not count.** `exactly one link` is a statement about today's data; `the link to the ORDER`
  is a statement about the requirement.
* A guard keyed on a **cause** survives a new code path; one keyed on a **threshold** does not.
* Prefer `try/finally` to a clear at each exit. The bug is always the exit somebody adds later.
* Scope a check to **its own fixtures**. A check that requires a globally empty table is asserting
  something about the world, not about the code.
* **Measure the number rather than relaying it.**

The tell is **a green result nobody investigates.** Ask of any check: **"what would make it pass while
the thing it names is broken?"** The incidents behind rules 5–8: `docs/history/agent-working-rules.md`.

---

## Environment & Database

- Repo-root `.env` (gitignored; copy `.env.example`) configures the CLI (`mj migrate`, `mj codegen`,
  `mj sync`, `mj test`), `scripts/*.sh` and the test harnesses. Sales ships no server: the MJ host's
  MJAPI reads the host's own `.env` (`docs/QA-GUIDE.md`).
- `MJ_CORE_VERSION` pins the MJ core `scripts/rebuild-db.sh` installs; unset, it uses the installed
  `@memberjunction/cli` version. It must satisfy `mj-app.json`'s `mjVersionRange` **and** match what
  `@memberjunction/*` actually resolved to — a DB behind the packages driving it produces "column does
  not exist" on core metadata.
- **Always use the WORKSPACE CLI**, never a global `mj`: `pnpm run mj -- <command>`, or
  `node node_modules/@memberjunction/cli/bin/run.js` as every script does. A globally installed CLI
  ships its own published packages and cannot see this repo's private ones.

### Migrations — additive only
- A schema change is a **new** `V<YYYYMMDDHHMM>__v<X.Y>.x__<Name>.sql`. **Never edit an applied
  migration, the baseline included:** its content is part of its checksum, and Flyway refuses the whole
  run on every host that already has it.
- Migrations run once, in order, so a V migration has **no `IF` guards**: add new columns in **one**
  `ALTER TABLE` with their constraints inline. Guards are noise and make the PostgreSQL conversion
  harder.
- Never add `__mj_CreatedAt`/`__mj_UpdatedAt` columns or FK indexes — CodeGen does both.
- **Author for PostgreSQL from day one.** Production is PG; keep the T-SQL converter-friendly and
  avoid reserved words as column names (this is why `ForecastSnapshot` has `CommitAmount`, not
  `Commit`). No migration has a PostgreSQL counterpart yet (#197).
- `CONFIRM_DROP=<database> scripts/rebuild-db.sh` drops and rebuilds a local database from migrations:
  MJ core, then common, tasks, accounting, orders and contracts from sibling checkouts, then sales.
  It names the database to DESTROY; there is no default. It applies every migration as shipped and
  leaves the working tree untouched. Run `pnpm run mj:codegen` after it as a drift check: SQL it writes to
  `migrations/codegen/` is a change no migration carries, and ships in a new `V…` file.
- **Restart the host's MJAPI AND MJExplorer after a rebuild.** They cache entity metadata at startup,
  and a rebuild re-mints every entity ID and Application row. The symptom is not an error: MJExplorer
  pops an **`mj-app-access-dialog`** saying the application doesn't exist. A reload is not enough.
- **Seed with `scripts/seed-dev-data.sh`, then `scripts/seed-demo-data.sh`, never concurrently.** Both
  take table locks; two copies deadlock and present as a hang. If it happens, kill your `sqlcmd`
  processes and any sleeping session with `open_transaction_count > 0`, or the next provider startup
  times out.

### Integration tests
Check bundles live in `packages/IntegrationTests/src/checks/`; `scripts/expected-check-counts.json` is
the single source for each bundle's check count and the sibling app it requires. Checks hit a LIVE
database with nothing mocked, each in a transaction that rolls back, and discover their fixture from the
seeds.
- `pnpm run test:coverage-gate` runs the suite and fails if fewer checks ran than the JSON declares.
- `pnpm run test:integration` runs the suite on its own.
- **`RUN_MUTATION_TESTS=1` is mandatory** when you call `node test-harnesses/integration.mjs` directly:
  without it every check that writes is skipped, and the run fails. The two scripts above set it for you.

### Explorer UI harness (`test-harnesses/playwright/`)
Proves create/read/update/delete **through the real Explorer UI**: a form that fails to render a field,
a lookup that fails to resolve and a save that silently no-ops all look like a passing GraphQL test.

```bash
# Sales runs inside an MJ host: start the HOST's MJAPI and MJExplorer first (docs/QA-GUIDE.md).
# The harness defaults to MJAPI on 4143 and MJExplorer on 4341; MJAPI_PORT / MJEXPLORER_PORT override.
pnpm run test:explorer:auth        # ONE TIME: headed, a human logs in. Session is then reused
pnpm run test:explorer             # the CRUD run
PW_HEADLESS=1 pnpm run test:explorer   # unattended
```

- Session reuse works because both auth providers cache in `localStorage`. **`.auth/user.json` is a live
  bearer token — it is gitignored and must never be committed.**
- Read `test-harnesses/playwright/README.md` before changing selectors; it records the delete-affordance
  and view-vs-edit-mode traps that cost real time to find.

### CI (`.github/workflows/ci.yml`)
**ELEVEN gates on every PR and every push to `next`, not two.** This section said "two hard gates" and
listed the first and third; five more have been added since and went unrecorded. That understatement is
not harmless — a reviewer who believes CI only greps and builds will reason that a template change, a
copy change or a query comment cannot be caught by it, and will hand-check things CI already covers
while trusting things it does not:

1. **`pnpm run test:vocabulary-gate`** — the master plan §3 grep. This is what makes "enforced by a CI
   grep" true rather than aspirational. Audited against injected violations: it catches 7 of 8, and its
   one measured blind spot is documented in the script.
2. **`pnpm run test:money-gate`** — sales records intent; orders computes the number.
3. **`pnpm run build`** — all turbo tasks including the Angular Explorer.
4. **`pnpm run test:discount-gate`** — percent vs fraction, both directions.
5. **`pnpm run test:validation-gate`** — pane attribution, and what blocks a save.
6. **`python3 scripts/assert-no-comment-drift.py`** — a documented column that is not returned.
7. **`npm run test:spec-gate`** — Playwright specs typecheck (it does NOT run them).
8. **Unit tests**, guarded on any existing.
9. **`npm run test:selector-gate`** — every selector the Playwright harness names is in a mounted template.
10. **`node .github/scripts/check-dependency-model.mjs`** — runs first, before install: `@memberjunction/*` and other apps' `@mj-biz-apps/*` packages are caret peers (exact `devDependencies` anchors), never `dependencies`.
11. **`npm run test:mutate-harness`** — an interrupted mutation run leaves no mutant in the tree or `dist/`.

Plus a non-blocking changeset presence check.

**What CI still does NOT cover**, and the distinction matters more than the count: `test:spec-gate`
COMPILES the Playwright specs, it does not execute them. A spec asserting a string the app no longer
renders typechecks perfectly and passes this gate. That is not hypothetical — sales#79 shipped exactly
that, and only a local harness run would have caught it.

The Explorer UI harness is deliberately **not** in CI: it needs a live database, running servers and a
one-time interactive human login. Run it locally before merging.

### Changesets
Every PR that changes a published package or anything under `migrations/` carries a changeset
(`pnpm run change`). The bump rules are in
**`.changeset/README.md`**. `fixed: [["@mj-biz-apps/*"]]` in `.changeset/config.json` versions the whole
family together: every package moves on every release, so the level you pick sets the version and the
CHANGELOG entry, not which packages move.

---

## MemberJunction versions — the LTS line AIDP Next runs

AIDP Next runs MemberJunction's 6.1 LTS line, pinned exactly in `aidp-next/package.json`. This repo builds, tests and runs CodeGen against that same version, so what passes here is what runs there (bc-aidp-next-golive#298).

- **Declared ranges.** A published package lists `@memberjunction/*` only in `peerDependencies`, as `^6.1.N`, where 6.1.N is the LTS release AIDP Next runs: a floor, not a cap. Its `devDependencies` anchor the same 6.1.N exactly for local builds; nothing goes in `dependencies` (CI's dependency model gate). Never an edge or prerelease range (`6.1.0-edge.x` sorts *before* 6.1.0 and has none of the LTS fixes). Packages MJ versions separately (`@memberjunction/connector-*`, `@memberjunction/skyway-*`) keep their own ranges.
- **Overrides (`overrides:` in `pnpm-workspace.yaml`).** `@memberjunction/core` and `@memberjunction/global` carry the same floor (for example `"^6.1.5"`), so every request in the graph resolves to one copy. Two copies of `core` split the ClassFactory: registrations land in one factory while the resolver reads the other, and nothing errors. Overrides are workspace-local and never published. They do not go under `package.json`'s `pnpm` field: pnpm 10.33 warns that it no longer reads that field, and the field is deprecated. Do not exact-pin sibling `@mj-biz-apps/*` packages here; how the apps declare each other is bc-aidp-next-golive#265.
- **One copy of each.** After any install, `pnpm why @memberjunction/core` must show a single version. A sibling app package that exact-pins an old MJ build brings a second copy in (for example `@mj-biz-apps/common-ng@5.37.0` pinned edge.3 packages); fix it by raising that package's floor, not with more overrides.
- **Bumping to a new 6.1.N**, when AIDP Next moves: raise every `^6.1.N` floor, every exact `6.1.N` devDependencies anchor and both overrides; `pnpm install`; confirm one copy; set `mjVersionRange` in `mj-app.json` to `>=6.1.N <7.0.0` (the Version Packages PR re-derives it from `packages/Entities`' `@memberjunction/core` peer via `ci/sync-mj-app-version.mjs`, so the two must agree); rebuild the database from migrations on MJ core `v6.1.N` and regenerate (below); run the full test suite; add a `patch` changeset; commit the lockfile. If CI then fails on the lockfile although a clean local install works, GitHub is testing the merge with `next`: merge `next` in, run `pnpm install --no-frozen-lockfile`, and commit the lockfile.
- **Never patch MemberJunction.** No `pnpm patch`, `patchedDependencies`, patch-package or `sed` against `@memberjunction/*` `dist/`. That is AIDP Next's hard rule (`.github/workflows/MJ_PATCH_REGISTER.md` in aidp-next). Fix MJ on its `next` branch and bring the fix to the line with the `backport lts/6.1` label, or with a hand-port PR against `lts/6.1` when the fix can't be isolated; then wait for the patch release.

### CodeGen output must be reproducible from this repo

Generated files are committed, and AIDP Next ships them as they are: it excludes every `__mj_BizApps*` schema from its own CodeGen and installs the published packages. So the committed output has to be what this repo's toolchain produces from its migrations.

- Run CodeGen only with this repo's pinned MJ version, against a database built from migrations (MJ core `v6.1.N`, then the apps this one depends on, then this repo), after `mj sync push` of `metadata/`. Remote operations generate from metadata rows, so an operation not yet pushed is silently missing from `remote_operations.ts`.
- Set an AI key in your gitignored `.env`: `AI_VENDOR_API_KEY__GeminiLLM` (every CodeGen prompt ranks Gemini first), or `AI_VENDOR_API_KEY__OpenRouterLLM`. Without one, CodeGen silently drops AI-written output: check-constraint `Validate*()` methods, display names, descriptions and form layouts.
- Never hand-edit generated files, and never paste in generated output from another toolchain or another database. That is how OrderLine lost `OrderHeader`'s `@Field` (bc-aidp-next-golive#295).
- Review what AI wrote. Validators, names and descriptions are not deterministic between runs.
- If CodeGen has to create metadata in the database that the generated code depends on (fields, value lists, relationships, validator code), ship it in a migration in the same PR. Otherwise every host installed from migrations drifts from the code.
- **Run CodeGen until it reports `success: true` AND per-entity parity is clean.** A pass that creates a view column registers its `EntityField` only on the next pass, and a view wider than its entity's fields fails every insert. `entityFieldsSequenceCheck` can name the wrong entity, so check parity yourself — every row must match:

  ```sql
  SELECT e.Name, e.BaseView,
    (SELECT COUNT(*) FROM __mj.EntityField f WHERE f.EntityID = e.ID) AS Fields,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = e.SchemaName AND c.TABLE_NAME = e.BaseView) AS ViewCols
  FROM __mj.Entity e WHERE e.SchemaName = '__mj_BizAppsSales';
  ```
- **`git checkout` is not an undo.** A CodeGen pass writes views, procedures and `EntityField` rows. On a database you care about, take a `BACKUP DATABASE` first and `RESTORE VERIFYONLY` it. The measurements: `docs/history/codegen-one-pass-lag.md`.
- `pnpm run mj:codegen:files` (`--skipdb`) regenerates the TypeScript, Angular and GraphQL files without touching the database.

## pnpm Workspace and Build Commands
- Define dependencies in the individual package's `package.json`, then run **`pnpm install` at the
  repository root**. **Never** run an install inside a package directory.
- `pnpm run build` (all, Turborepo) · `build:generated` · `build:packages`
- **No `start:*` scripts.** Sales ships no shells; the MJ host runs MJAPI/MJExplorer (`docs/QA-GUIDE.md`)
- `pnpm run verify` — the vocabulary, money, comment-drift, distribution, spec-typecheck and selector
  gates, then the build and unit tests, then the discount and validation gates (they read `dist/`).

---

## MemberJunction Entity and Data Access Patterns

### Entity objects — never `new`
```typescript
// WRONG
const deal = new DealEntity();
// CORRECT — and on the server, ALWAYS pass contextUser
const md = new Metadata();
const deal = await md.GetEntityObject<DealEntity>('MJ_BizApps_Sales: Deals', contextUser);
```

### Never spread a BaseEntity
```typescript
const data = { ...myEntity.GetAll(), extra: 'value' };   // CORRECT — not { ...myEntity }
```

### RunView does NOT throw — check `.Success`
```typescript
const result = await rv.RunView<DealEntity>({ EntityName: 'MJ_BizApps_Sales: Deals', ExtraFilter: '...' });
if (result.Success) { const items = result.Results || []; }
else { console.error('Failed:', result.ErrorMessage); }
```
- `ResultType: 'entity_object'` to mutate and save; `'simple'` + `Fields` to read/display.
  Do NOT pass `Fields` with `entity_object` — it is ignored.
- Use **`RunViews`** (plural) for multiple independent queries. **Never** call `RunView` in a loop.
- Prefer denormalized view fields over a separate lookup query.

### Other MJ patterns
- **`@RegisterClass` + ClassFactory.** Registration is a side effect of import; last registration
  under a key wins. Anti-tree-shaking `Load*()` anchors keep the imports alive — that is what the
  otherwise-empty functions in `sales-core-entities-server` are for.
- **`BaseSingleton`** from `@memberjunction/global` for all singletons — never manual `static _instance`.
- **No re-exports between packages.** Import from the source package.
- **Remote operations are atomic units of work** — `Sales.CloseDeal` is one transactional server
  call, all-or-none. Plain `BaseEntity` saves are for single-record edits only.
- **Everything stored is UTC.** Use `getUTC*`, never local-time getters, for anything persisted.

---

## Angular / UI

**UI layering: follow MJ PR 3403 — the L0–L3 UX layering guide.** Read it before building any surface
in `packages/Angular`; it is the house standard for how much an app-level component may assume.

Built on MJ's Angular Generic components — `kanban`, `timeline`, `filter-builder`, `entity-card`,
`join-grid`, `record-merge`, `entity-communication`, the page-chrome trio.

- Standalone components with `inject()`; `@if`/`@for`/`@switch`, not `*ngIf`/`*ngFor`
- **PascalCase for public members** (properties, methods, `@Input()`, `@Output()`); camelCase private
- **Semantic `--mj-*` tokens, no hardcoded colors.** Verify in dark mode.
- `<mj-loading>` only — never a custom spinner
- **Confirm/submit LEFT, cancel RIGHT**
- Font Awesome for icons
- Every `BaseResourceComponent` subclass must call `NotifyLoadComplete()`
- Add `ChangeDetectorRef` and `cdr.detectChanges()` after programmatic changes; prefer
  `Promise.resolve().then()` over `setTimeout`

---

## Code Style
- TypeScript strict mode, explicit typing; prefer union types over enums for better package exports
- PascalCase classes/interfaces; camelCase locals and parameters; descriptive names, no abbreviations
- **Functional decomposition is mandatory** — max ~30–40 lines per function. If it grows, refactor now.
- **No dynamic `require()`/`import()`** — static imports at the top, unless explicitly requested
- Group imports by type (external, internal, relative); meaningful error messages in try/catch

---

## Deferred by decision (not oversights)
Recorded in full in `docs/DECISIONS.md`; listed here so nobody "fixes" them:
- **Quota / attainment** — v2. No `Quota` table (D2).
- **Territory** — a label on `SalesAccount`, not a routing engine (D3).
- **`Pipeline.CompanyID` stays NOT NULL**; each line takes its company from its product, so a deal can
  still span companies (D5, ratified 2026-08-26).
- **`ForecastSnapshot` columns are `*Amount`-suffixed**, diverging from master plan §9.5's bare
  `Commit`/`BestCase`/`Pipeline`/`Closed`. **The shipped names are authoritative** — `COMMIT` is reserved
  in T-SQL and Postgres, and prod is Postgres (D6).

## GitHub
- Repository: https://github.com/MemberJunction/bizapps-sales
- Default/release branch: `main` · Integration branch: `next` · Feature PRs target `next`.

### Filing issues (pilot of the BizApps issue system)
- **Never work around a bug in this repo or in MJ silently.** File it with the `/report-issue` skill
  (`.claude/skills/report-issue/`), which picks the repo where the fix lives, captures the
  environment, searches for duplicates, and writes the same headings as the web form
  (`.github/ISSUE_TEMPLATE/bug.yml`). If the bug already exists, it posts an occurrence comment on
  the original instead of a new issue.
- Filing from the web: **New issue → Bug report**. Every bug lands as `needs-triage`; a second
  person reproduces it before it is `confirmed`. Confidence is a field, not a gate — say what you
  actually did.
- Not filed during the pilot: nits (cosmetic, no user impact) go in a local `BUGS.md`, not GitHub.
  An agent files only with a minimal repro or after seeing the same failure twice, at most five
  per session, and never closes, relabels, transfers or assigns anything.
- MJ-core bugs go to `MemberJunction/MJ` (always pass `--repo`); mjdev-tool bugs to
  `MemberJunction/MJDev`. Say which repo you chose and why under "Duplicate search".

## Performance
- Batch with `RunViews`; never per-item queries in loops; use denormalized view fields over lookups.

**VERY IMPORTANT** Whenever you need to spin up tasks — if they do not require interaction with the
user and are not interdependent — ALWAYS spin up multiple parallel tasks. **NEVER** process
parallelizable tasks sequentially.
