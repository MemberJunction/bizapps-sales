# GENERAL RULE
Don't say "You're absolutely right" each time I correct you. Mix it up, that's so boring!

# BizApps Sales Development Guide

Deal pipeline management built on [MemberJunction](https://github.com/MemberJunction/MJ), and the top
layer of the BizApps revenue stack:

```
sales (deal) → contracts (agreement) → orders (order+payment+subscription) → accounting (JE ledger) → ERP
```

**The app's source of truth is `plans/bizapps-sales-master.md`.** It currently lives on the
`an-master-plan` branch, not on `next` — read it with
`git show origin/an-master-plan:plans/bizapps-sales-master.md`. It stays there deliberately
(`docs/DECISIONS.md` D7). Where this file and the master plan disagree, the master plan wins — **except**
where `docs/DECISIONS.md` records a ruling that supersedes it.

**Read these two first:**
- **`docs/DECISIONS.md`** — the rulings that govern this app, each with its reasoning. Includes one
  documented divergence from the master plan (`ForecastSnapshot` column names, D6).
- **`docs/KNOWN-ISSUES.md`** — live risks that cannot be fixed from this repo.

> ## ⚠️ KNOWN ISSUE — read before touching the IsA extensions
>
> **`AllowMultipleSubtypes` is `false` on common's `Person` and `Organization`.** MJ's IsA defaults to
> *disjoint* — one child type per parent. Sales is currently the **first and only** app extending either,
> so it chains correctly **today** and `SalesAccount` / `SalesContact` are verified working.
>
> **The moment a second app (ATS, certification) extends `Person` with the flag still false, that app
> silently mis-chains at runtime** — no error, no failed migration, just wrong records.
>
> The fix belongs in **`bizapps-common`**, not here (`docs/DECISIONS.md` D1). Full detail, including the
> query to check it, is in **`docs/KNOWN-ISSUES.md` KI-1**.

## Repository Structure

```
bizapps-sales/
  mj-app.json          - MJ Open App manifest (schema, deps, ports, startupExports)
  mj.config.cjs        - CodeGen + server config; DB credentials come from .env
  codegen-schema-info.json - the IsA (Table-Per-Type) declarations
  .mj-links.json       - local sibling links (EMPTY today — see the file's own comment)
  migrations/          - B... schema + SchemaInfo, V... tables + the CodeGen half
  metadata/            - type-table seeds, pushed with `mj sync push`
  apps/
    MJAPI/             - GraphQL API server (port 4141)
    MJExplorer/        - Angular UI application (port 4341)
  packages/
    Entities/          - @mj-biz-apps/sales-entities (CodeGen-generated entity subclasses)
    Actions/           - @mj-biz-apps/sales-actions
    Server/            - @mj-biz-apps/sales-server (bootstrap + GraphQL resolvers)
    CoreEntitiesServer/- @mj-biz-apps/sales-core-entities-server (Save() overrides; the close lock)
    Angular/           - @mj-biz-apps/sales-ng (generated forms + future UI)
    IntegrationTests/  - @mj-biz-apps/sales-integration-tests (dispatched by `mj test`)
```

---

## THE THREE RULES THIS APP EXISTS TO UPHOLD

These are not style preferences. Each one is a guarantee the app sells, and each has a specific
failure mode that arrives by accretion if it is not defended.

### 1. Sales NEVER computes money

Every number comes back from `Orders.PreviewOrder`. This app records **intent** — product, quantity,
requested discount, term — and asks.

**Never, in any file:** multiply quantity by price · apply a discount percentage · compute tax ·
prorate a partial period · sum lines into a header total · round anything.

- `DealLine.ResolvedUnitPrice` / `ResolvedExtendedAmount` / `PriceComponentsJSON` / `PricedAt` are
  **write-only** — populated from a PreviewOrder response, never computed locally, never hand-edited.
- `Deal.Amount` is a **cached answer** with provenance: `AmountIsComputed`, `AmountComputedAt`,
  `AmountSourceHash`. The hash fingerprints the line set, so the UI can say *"stale, reprice"*.
- An override price (`DealLine.OverrideUnitPrice`) is an **input** to the engine, never a replacement.
- On close, the same draft goes to `Orders.CreateOrderInState`. The quote and the invoice cannot
  disagree, because they are the same computation run twice.

### 2. Domain vocabulary is DATA, never code

Ten type tables carry the **behaviour flags** the engine branches on. The engine reads
`DealStatusType.IsWon`; it **never** compares a status or stage name.

- **`npm run test:vocabulary-gate` enforces this.** It is green today and must stay green. Read
  `scripts/assert-no-vocabulary-comparisons.mjs` before arguing with it.
- CHECK constraints are for **structural invariants only** — exactly-one-of FKs, date ordering,
  non-negative or bounded numerics. **Never** for domain vocabulary.
- Stages carry no `IsWon`/`IsClosed`; they point at a `DealStatusType` that does. That is what makes
  "Closed Won" a label, so a pipeline can call its winning stage "Signed" with no code aware of it.
- New vocabulary is a **metadata change** — a row under `metadata/<type>/` with a hardcoded UUID.
  **Never a SQL `INSERT` in a migration.**

### 3. Provenance is immutable — "pen, not pencil"

- `DealStageEvent` is **append-only**, never edited, and stamps `AmountAtTransition` /
  `ProbabilityAtTransition`. Without those stamps, "what did we think the forecast was on the 1st" is
  unanswerable once amounts change.
- When a deal enters a status where `DealStatusType.LocksDeal = 1`, the deal, its lines and its team
  become **immutable — enforced in `DealEntityServer.Save()`, never in the UI**, so an Action, an
  agent or a raw `BaseEntity.Save()` all hit the same wall. Reopening goes through
  `Sales.ReopenDeal`, which records a reason.
- The HubSpot importer must **bypass the lock by an explicit, audited path** — historical deals
  arrive already closed — and must preserve **original timestamps** on `DealStageEvent.ChangedAt`.

### Two traps named in the plan, worth knowing before you write a query

- **Attribution double-count.** A deal with an AE, an SE and an SDR has three `DealTeamMember` rows;
  summing `Deal.Amount` across that table **triple-counts the deal**. Every by-rep or by-role rollup
  must either filter to the owner role (`DealRole.IsOwnerRole = 1`) or weight by `AttributionPct`.
  State which, in the report definition. There is no safe default serving both "bookings by AE" and
  "deals I was involved in".
- **Denormalized stamps are server-maintained.** `Deal.OwnerEmployeeID` and `DealLine.CompanyID` are
  written by entity-server code. **Never hand-set them.** `DealTeamMember` is the source of truth for
  membership, including the owner.

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

---

## Environment & Database

- Repo-root `.env` holds this repo's configuration — the CLI (`mj migrate`, `mj codegen`, `mj sync`) and
  `scripts/*.sh` read it from here. Sales no longer ships an MJAPI, so there is no `apps/MJAPI/.env`
  symlink any more: the SERVER's env belongs to the MJ host you link into (`packages/MJAPI/.env` there),
  and the CLI reads it from the host's repo root. See `docs/QA-GUIDE.md`.
- Local dev DB: **`MJ_BizAppsSales`** on SQL Server, MJ core pinned by `MJ_CORE_VERSION` in `.env`.
  That version must satisfy `mj-app.json`'s `mjVersionRange` **and** match what `@memberjunction/*`
  actually resolved to — a DB behind the packages driving it produces "column does not exist" on core
  metadata.
- **Always use the WORKSPACE CLI**, never a global `mj`: every script runs
  `node node_modules/@memberjunction/cli/bin/run.js`. A globally installed CLI ships its own
  published packages and cannot see this repo's private ones. (The global `mj` on this machine is
  behind; it does not matter, and it is not what these scripts call.)

### Ports
- MJAPI GraphQL: **4141** (`GRAPHQL_PORT`) · MJExplorer: **4341**
- Chosen to avoid every other MJ environment: MJ core 4001/4201, common 4101/4301,
  accounting 4102/4302, orders 4103/4303, contracts 4151/4351.

### The migration loop — BASELINE-IN-PLACE (pre-production)
Schema changes **edit the baseline migration in place**; do not stack fix-up migrations. That is only
safe because rebuilding from zero is routine:

```bash
scripts/rebuild-db.sh                    # drop+create, MJ core, bizapps-common, this app's DDL
npm run mj:codegen                       # PASS 1 — entity metadata + SQL objects
scripts/append-codegen.sh                # fold generated SQL below the baseline's banner
pnpm mj sync push --dir metadata    # seed the type tables + remote-operation rows
npm run mj:codegen:files                 # PASS 2 — FILES ONLY (--skipdb). See the warning below.
npm run build
scripts/seed-dev-data.sh && scripts/seed-demo-data.sh   # the rebuild dropped all data
# THEN RESTART MJAPI **AND** MJExplorer — see below.
```

- **RESTART BOTH SERVERS AFTER A REBUILD.** They cache entity metadata at startup, and a rebuild
  re-mints every entity ID and Application row — so a server started before the rebuild is holding IDs
  that no longer exist. The symptom is not an error: MJExplorer pops an **`mj-app-access-dialog`**
  saying *the application doesn't exist*, which reads exactly like a broken permission or a bad
  `DriverClass`. It cost a Playwright debugging cycle in Phase 2 chasing the spec instead of the
  servers. `ng serve`'s watch mode rebuilds the BUNDLE on a package change but does not re-read
  metadata, so a reload is not enough — restart the process.
- **Do not run the seeds twice concurrently.** Both scripts take table locks; two copies deadlock on
  each other and present as a hang, not an error. If it happens, kill the `sqlcmd` processes and then
  clear any session left holding a transaction (`KILL <spid>` for sleeping sessions with
  `open_transaction_count > 0`), or the next provider startup times out at 15s with
  `Cannot read properties of undefined (reading 'find')`.

- **`append-codegen.sh` is NOT optional.** The generated half of the baseline is what makes a fresh
  `mj migrate` produce a *working* database rather than bare tables. It has been lost once in the
  sibling repo and is unrecoverable without another full rebuild.
- `rebuild-db.sh` **trims** the generated half before applying, so CodeGen regenerates it in full.
  Skip the trim and CodeGen emits only a delta, which `append-codegen.sh` rightly refuses.
- **CODEGEN RUNS TWICE, and pass 2 MUST be `--skipdb`.** Remote operations generate *from metadata
  rows*, not from the schema, so pass 1 cannot see an operation `sync push` has not inserted yet —
  `remote_operations.ts` comes out holding only MJ's core operations and every `Sales.*` shell is
  silently missing. The symptom is a compile error naming an operation class that plainly exists in
  metadata. Pass 2 emits them, and `--skipdb` (`npm run mj:codegen:files`) restricts it to TypeScript,
  Angular and GraphQL files.

  > ### ⚠️ A FULL SECOND CODEGEN PASS CORRUPTS THE DATABASE. Measured, not theoretical.
  >
  > Running plain `mj:codegen` a second time regenerated `vwDeals` with **eleven** virtual lookup
  > columns where pass 1 produced ten — it added an `Account` join, derived from the `SalesAccount`
  > IsA child, that pass 1 had not been able to resolve yet. It did **not** add the matching
  > `EntityField` row. The result: `vwDeals`/`spCreateDeal` return 56 columns while `Deal` has 55
  > registered fields, and since `SQLServerDataProvider` builds its `@ResultTable` from *entity
  > metadata* and then does `INSERT INTO @ResultTable EXEC spCreateDeal`, **every Deal insert fails**
  > with *"Column name or number of supplied values does not match table definition"* — inside a
  > transaction that then aborts. It also silently drifts the live DB away from the baseline, because
  > `append-codegen.sh` is (correctly) not re-run.
  >
  > A single pass is self-consistent; two full passes are not. This is an IsA-ordering effect, so it
  > will bite hardest on `SalesAccount`/`SalesContact` and anything else extending a parent entity.

  **Do NOT re-run `append-codegen.sh` after pass 2** either: with the generated half already in place
  a full pass emits only a delta, which the script rightly refuses — and with `--skipdb` there is no
  SQL to fold in at all.
- Never add `__mj_CreatedAt`/`__mj_UpdatedAt` columns or FK indexes — CodeGen does both.
- Switch to **additive-only** migrations at first publish.
- **Author for PostgreSQL from day one.** Production is PG; keep the T-SQL converter-friendly and
  avoid reserved words as column names (this is why `ForecastSnapshot` has `CommitAmount`, not
  `Commit`). Run the conversion once the baseline is stable.

### Integration tests
**`RUN_MUTATION_TESTS=1` is mandatory** or the suites run ZERO checks and pass vacuously.
Integration checks hit a LIVE database with nothing mocked; each check rolls back. None exist yet — the
two the definition of done requires are specified in `packages/IntegrationTests/src/index.ts` and land
with S2.

### Explorer UI harness (`test-harnesses/playwright/`)
Proves create/read/update/delete **through the real Explorer UI**, which no API-level test can: a
generated form can fail to render a field, a lookup can fail to resolve, a save can silently no-op, and
all three look identical to a passing GraphQL test.

```bash
# Sales runs inside an MJ host — start the HOST's MJAPI (4143 in the linking spike) and its
# MJExplorer on 4341, the port the Entra redirect URI is registered for. See docs/QA-GUIDE.md.
pnpm run test:explorer:auth        # ONE TIME: headed, a human logs in. Session is then reused forever
pnpm run test:explorer             # the CRUD run
PW_HEADLESS=1 pnpm run test:explorer   # unattended
```

- **Use `start:explorer:msal` for anything involving a human login.** Plain `ng serve` defaults to
  Angular's `development` configuration, which selects the **Auth0 automation tenant** — service accounts,
  not staff SSO, so your own credentials are rejected there. `local_msal` keeps `environment.ts`'s
  `AUTH_TYPE: 'msal'` active instead.
- Session reuse works because both auth providers cache in `localStorage`. **`.auth/user.json` is a live
  bearer token — it is gitignored and must never be committed.**
- Read `test-harnesses/playwright/README.md` before changing selectors; it records the delete-affordance
  and view-vs-edit-mode traps that cost real time to find.

### CI (`.github/workflows/ci.yml`)
Two hard gates on every PR and every push to `next`:

1. **`npm run test:vocabulary-gate`** — the master plan §3 grep. This is what makes "enforced by a CI
   grep" true rather than aspirational. Audited against injected violations: it catches 7 of 8, and its
   one measured blind spot is documented in the script.
2. **`npm run build`** — all 8 turbo tasks including the Angular Explorer.

The Explorer UI harness is deliberately **not** in CI: it needs a live database, running servers and a
one-time interactive human login. Run it locally before merging.

### Changesets
**A PR that adds or edits anything under `migrations/`, or changes a published package, must carry a
changeset with at least a `minor` bump** — `npx changeset`. CI warns rather than fails, so treat the
warning as a review item. `baseBranch` is `next`.

---

## NPM Workspace Management
- Define dependencies in the individual package's `package.json`, then run **`npm install` at the
  repository root**. **Never** run `npm install` inside a package directory.

## Build Commands
- `pnpm run build` (all, Turborepo) · `build:generated` · `build:packages`
- **No `start:*` scripts.** Sales ships no shells; the MJ host runs MJAPI/MJExplorer (`docs/QA-GUIDE.md`)
- `pnpm run verify` — the vocabulary gate plus a full build

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

## Build Sequence (where we are)

| Phase | Work | State |
|---|---|---|
| **S0** | Repo bootstrap, `mj-app.json`, ports, CI | done |
| **S1** | Baseline migration + CodeGen: type tables, identity, pipelines, deal + lines + team + events | done |
| **S2** | Pricing bridge — `DealLine` ↔ `Orders.PreviewOrder`, provenance stamping, the §6 integration check | next |
| **S3** | Pipeline board + deal workspace + deal team + activity timeline | |
| **S4** | `Sales.CloseDeal` + policy evaluation + close lock + `Contracts.CreateFromDeal`/`RenewTerm` | |
| **S5** | Dashboards: MJ Queries for the §9 measures, forecast snapshots, velocity | |
| **S6** | HubSpot import + reconciliation report | |
| **S7** | Cutover — run parallel for one full sales cycle before turning HubSpot off | |

**S2 is where `.mj-links.json` starts mattering**: `Orders.PreviewOrder` means bizapps-orders and
(transitively) bizapps-accounting must be checked out as peers **and built**, since neither is
published. Sales is three symlink-hops deep at that point; read `.mj-links.json` in full first —
`type-graphql`, `graphql` and `reflect-metadata` must collapse to a single copy or `buildSchema` dies
on a decorator that is perfectly correct.

## Known upstream dependencies
- **`AllowMultipleSubtypes = true` on common's Person and Organization** — see the ⚠️ block at the top of
  this file and `docs/KNOWN-ISSUES.md` KI-1. Fix belongs in `bizapps-common`; **do not edit it from here**.
- **From orders:** `Subscription.BillingMode` (`Self | External`) and the customer×product×time
  pricing-resolver slot. Neither exists yet; contracts' C0 is the orders PR that adds them. **This is the
  critical path for S2** — nothing in the pricing bridge can land until it does.
- **From contracts:** `Contracts.CreateFromDeal` and `Contracts.RenewTerm`. Contracts is README-only.
- **From common:** the Activity spine, for the timeline in S3.

## Deferred by decision (not oversights)
Recorded in full in `docs/DECISIONS.md`; listed here so nobody "fixes" them:
- **Quota / attainment** — v2. No `Quota` table (D2).
- **Territory** — a label on `SalesAccount`, not a routing engine (D3).
- **`Pipeline.CompanyID` stays NOT NULL** — confirm-only with Amith/Johanna, no schema change either
  way (D5).
- **`ForecastSnapshot` columns are `*Amount`-suffixed**, diverging from master plan §9.5's bare
  `Commit`/`BestCase`/`Pipeline`/`Closed`. **The shipped names are authoritative** — `COMMIT` is reserved
  in T-SQL and Postgres, and prod is Postgres (D6).

## GitHub
- Repository: https://github.com/MemberJunction/bizapps-sales
- Default/release branch: `main` · Integration branch: `next` · Feature PRs target `next`.

## Performance
- Batch with `RunViews`; never per-item queries in loops; use denormalized view fields over lookups.

**VERY IMPORTANT** Whenever you need to spin up tasks — if they do not require interaction with the
user and are not interdependent — ALWAYS spin up multiple parallel tasks. **NEVER** process
parallelizable tasks sequentially.
