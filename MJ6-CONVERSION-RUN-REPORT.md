# MJ v6 + pnpm conversion (issue #86) — run report

**Branch:** `feature/mj6-pnpm-conversion`, cut from `s0-s1-bootstrap-and-baseline-schema`. Three commits,
all local, authored as Josue. **Never pushed.**

## The headline

**Sales' own conversion is complete and green.** Build 8/8, vocabulary gate clean, 12/12 integration
checks — all against MJ **6.1.0-edge.2** on a fresh, separate `MJ_BizAppsSales_V6` database.
**No application source file needed changing for v6.**

**But MJAPI cannot start**, and the cause is outside this repo: the published
`@mj-biz-apps/common-core-entities-server@5.33.2` still contains
`import { UserCache } from '@memberjunction/sqlserver-dataprovider'`, an export that **no longer exists in
v6**. bizapps-common already fixed this (PR #54, merged to `next` **2026-08-11**) but last published on
**2026-08-10** — so the published package predates its own fix.

> **The one thing to action: bizapps-common needs a release off `next` — but `next` does not build yet.**
> Until then no sales server can start on v6, and nothing in sales can work around it, because the broken
> import is inside a published dependency.

**I attempted to unblock it locally and found why it is stuck.** Building common's `next` (you said I
could use the other workspaces) fails on the *very import the fix introduced*:

```
packages/CoreEntitiesServer/src/PersonEntityServer.ts(4,10):
error TS2305: Module '"@memberjunction/generic-database-provider"' has no exported member 'UserCache'.
```

Because common's `CoreEntitiesServer` declares `@memberjunction/generic-database-provider: ^6.1.0-edge.1`,
and **edge.1 does not export `UserCache` at all** — verified both ways in common's own tree
(`typeof UserCache === 'undefined'` at runtime, 0 hits in `index.d.ts`). The symbol only lands in
**edge.2**, which is what sales resolves and where I confirmed `typeof UserCache === 'function'`.

**So common's fix went in one edge release too early.** To unblock: bump common's floor to
`^6.1.0-edge.2`, build, publish. That is a one-line change in someone else's repo, so I have not made it —
but it is the precise next step, and it is why "just publish `next`" would not have worked either.

I therefore could **not** demonstrate a running v6 MJAPI. Causality is nonetheless established exactly:
the failing import is in a published third-party package, the export genuinely moved in v6, and sales'
own code compiles and tests clean against v6.

## Answers to the four questions asked

| Question | Answer |
|---|---|
| Does Sales **build**? | **Yes — 8/8** turbo tasks, plus vocabulary gate clean |
| Does Sales **run** on v6? | **Explorer yes, MJAPI no.** MJExplorer compiled and served on v6 (`Application bundle generation complete`, watch mode, zero compile errors). MJAPI is **blocked** on the unpublished bizapps-common fix. Sales' own code is not the cause of either |
| Do the **integration suites** pass? | **Yes — 12/12**, `RUN_MUTATION_TESTS=1`, live v6 DB, each rolled back |
| Is the **#89 composition feature** there? | **The metadata column exists in v6; the generated entity does not use it yet.** Detail below |

---

## The #89 question, answered precisely

This was the critical unknown, so here is exactly what is and isn't there.

**1. `EntityRelationship.RelatedRecordCollection` — EXISTS in v6, ABSENT in v5.** Verified by querying
both databases side by side. It is `nvarchar(max)`, nullable, and holds a **JSON config**, e.g.

```json
{ "Name": "Actions", "Source": "cache", "Load": "lazy" }
```

**2. MJ core populates it for 8 of its own relationships** — of 858 `EntityRelationship` rows in the v6
database, 8 carry a value (Actions, Libraries, Models, Params, Prompts, ResultCodes, Scopes, SubAgents —
all AI-agent/action surfaces). So the feature is live in v6, not merely scaffolded.

**3. The runtime API is present in `@memberjunction/core@6.1.0-edge.2`:**

- `BaseEntity.DeclareRelatedRecords<TChild>(options: RelatedRecordCollectionOptions): RelatedRecordCollection<TChild>` — protected
- a dedicated `relatedRecordCollection` module exporting `RelatedRecordCollection`,
  `RelatedRecordCollectionConfig`, `RelatedRecordCollectionOptions`, `RelatedRecordCollectionWire`,
  `RelatedRecordCollectionWireItem`
- `EntityInfo.RelatedRecordCollection: string`, documented as `IRelatedRecordCollectionConfig` with
  `Name` = "the generated property name, e.g. `Lines`"

**4. `mjBizAppsSalesDealEntity` does NOT yet support it — zero occurrences** of `RelatedRecordCollection`
anywhere in the regenerated `entity_subclasses.ts`.

**That is the expected result, not a miss.** The feature is **opt-in per relationship**: CodeGen emits a
collection only where the `EntityRelationship` row carries the JSON config, and none of sales' own
relationship rows do.

**So the #89 enablement path is a metadata change, not an upgrade blocker.** Populating
`RelatedRecordCollection` on the Deal → DealLine relationship (name it `Lines`) and re-running CodeGen
should generate the collection on the Deal entity. That is a `metadata/` edit plus `pnpm mj sync push` —
no schema change, no MJ change. **Not attempted in this run**, because it is design work for #89 rather
than part of the mechanical conversion, and it wants a deliberate decision about which relationships
become collections and whether they load lazily or from cache.

---

## The full v6 delta

**Source changes required by v6: exactly one, and it is in a test harness, not the app.**

| # | Change | Why |
|---|---|---|
| 1 | `test-harnesses/integration.mjs` — import `UserCache` from `@memberjunction/generic-database-provider` instead of `@memberjunction/sqlserver-dataprovider` | v6 moved it. Destructuring from the old package yields `undefined` **silently**; the visible failure is `Cannot read properties of undefined (reading 'Instance')` several lines later, which reads like a broken cache rather than a moved import. bizapps-common made the identical fix in `302ea92` |

Nothing in `packages/*/src` or `apps/*/src` changed. The `Deal` entity server, the remote operations, the
workspace component, the draft model and every check compiled against v6 untouched.

### Phantom dependencies pnpm surfaced (4)

Every one is a **pre-existing defect** npm's hoisting concealed — none is caused by v6.

| Package | Used by | Consequence under pnpm |
|---|---|---|
| `@memberjunction/cli` | root scripts (`node node_modules/@memberjunction/cli/bin/run.js`) | every `mj:*` script had worked purely by hoisting accident |
| `dotenv` | `mj.config.cjs` line 1 | **broke the rebuild outright** — `mj migrate` died with `Cannot find module 'dotenv'` |
| `@memberjunction/ng-shared-generic` | 2 files in `sales-ng` | build failure `TS2307: Cannot find module` |
| `mssql` | `test-harnesses/integration.mjs` | integration suite could not start |

Plus two workspace packages (`@mj-biz-apps/sales-server`, `sales-integration-tests`) that npm
auto-symlinked at root and pnpm links only where declared, and
`@memberjunction/generic-database-provider`, newly needed by the `UserCache` fix.

A repo-wide audit of every bare import against every package's declared dependencies found
`ng-shared-generic` and **only** that one across `packages/` and `apps/` — the rest live in
`test-harnesses/` and root config.

### Other conversion fixes

- **`pnpm.overrides.zod ^3.25.76`** — CodeGen died on `zod-to-json-schema` importing `zod/v3`, a subpath
  that only exists from 3.25, while something pinned 3.24.4 (which also left `@lmstudio/sdk`'s own peer
  range unmet). Same version bizapps-common settled on.
- **`npm run mj -- <cmd>` does not survive the switch.** pnpm passes `--` through as a literal argument,
  and the CLI dies with `Error: command -- not found`. Four call sites fixed (`CLAUDE.md`, `docs/DEMO.md`,
  two in `scripts/rebuild-db.sh`) — otherwise the documented rebuild loop cannot complete.
- **16 MJ packages anchored** in root `devDependencies` at exact `6.1.0-edge.2`, derived from this repo's
  own peer declarations — the same fix orders applied in `29da480`.
- **`@mj-biz-apps/common-*` → `^5.33.2`.** The 5.x version number is misleading: that build's published
  `peerDependencies` already require `@memberjunction/core ^6.1.0-edge.0`, so it is the v6-targeted
  release.

---

## What CodeGen changed under v6

Both passes ran per the two-pass rule (pass 2 `--skipdb`). **406 entities**, and `append-codegen.sh`
folded the generated SQL back into the baseline (now 35241 lines).

Delta: **28 files, +4777 / −4465**. It is v6 core's own surface moving, not sales changing shape:

- **`remote_operations.ts` +312 lines** — MJ v6 ships new `Workflow*` (Draft/Save/Validate) and
  `TaskGraphSubmit` operation contracts that CodeGen emits for every app.
- **`Server/generated.ts` ±160** — eight new `@FieldResolver` / `@PubSub` subscription resolvers.
- **The 19 sales entities regenerate essentially unchanged** — field-level diffs only.

**Note for a future run:** CodeGen's AI-assisted steps (check-constraint parsing, form-layout suggestion)
failed repeatedly here with `No suitable model found` / `AI credential circuit is open`, because this
machine has no AI credentials. CodeGen completed successfully regardless. Running v6 CodeGen on a
credentialed machine may therefore produce *additional* generated content — diff it deliberately rather
than assuming parity with this run.

---

## Commits on `feature/mj6-pnpm-conversion`

```
f90a64e  chore(codegen): regenerate against MJ v6 core
aaede99  fix(v6): the four things pnpm and MJ v6 actually broke
17c7a17  build(deps): convert to pnpm and MJ v6 (6.1.0-edge.2)
```

Decisions queued in `MJ6-DECISIONS.md` (D-V6-1 … D-V6-14). The two most worth reading are **D-V6-1**
(the sibling `pnpm-workspace.yaml` could *not* be copied verbatim — sales is the only app with `apps/`)
and **D-V6-13** (the whole v6 API delta is one moved import).

## What blocked me

**The bizapps-common publish gap**, described at the top. Everything else in the brief completed.

---

## Machine state

- **The working v5 database `MJ_BizAppsSales` is untouched** — never dropped, never migrated, still holding
  its 6 demo deals. The v6 work went into a **separate `MJ_BizAppsSales_V6`**, created by the rebuild
  script from the worktree's own `.env`. Both databases exist side by side.
- **The main checkout is untouched**: still on `feature/deal-line-product-ref`, still carrying exactly the
  pre-existing 40-file drift I found it with. Its `.env` still points at the v5 DB and
  `../bizapps-common`. All conversion work happened in an isolated worktree.
- **`plans/`, `docs/` and every `*-REPORT.md` / `*-DECISIONS.md` are intact**, plus the two new files from
  this run.
- **All branches intact**, with `feature/mj6-pnpm-conversion` added. **Nothing pushed** — it has no
  upstream.
- **bizapps-common was never modified.** Its migrations were read via `git archive` into a temp directory,
  and the build attempt used a detached worktree. `git status` in that repo is clean and it is still on
  `main`.
- **Josue's v5 servers restored** on 4141/4341 from the main checkout.

### Two leftovers, both harmless and deliberate

1. **`C:\Dev\wtv6` is kept**, not deleted. It is the working v6 environment, already installed, built and
   paired with `MJ_BizAppsSales_V6` — so you can pick up #86/#89 without a 7-minute reinstall. The branch
   itself holds every commit, so deleting the worktree loses nothing if you prefer the disk back:
   `git worktree remove --force C:\Dev\wtv6` (long paths may need
   `Remove-Item -LiteralPath '\?\C:\Dev\wtv6' -Recurse -Force`).
2. **`C:\Dev\cmn6` could not be deleted** — a `rollup.win32-x64-msvc.node` is still locked by a node
   process I could not attribute. I deliberately did **not** kill unidentified node processes on a shared
   machine to reclaim a scratch directory. It is a throwaway common worktree (already de-registered from
   git); delete it after a reboot.

## Next steps

1. **Unblock the publish:** bump bizapps-common's `generic-database-provider` floor to `^6.1.0-edge.2`,
   build, release. Then re-point sales at the new `@mj-biz-apps/common-*` and MJAPI should start.
2. **Verify the server** once that lands — the only unverified item in this conversion.
3. **For #89:** the composition feature is available. Populate `RelatedRecordCollection` on the
   Deal → DealLine `EntityRelationship` row and re-run CodeGen; decide deliberately which relationships
   become collections and their `Source`/`Load` modes.
4. Review `MJ6-DECISIONS.md` — **D-V6-3** (is common `5.33.2` really the v6 pairing?) is the one that
   wants a second opinion.
