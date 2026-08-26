# Upstream blockers — what BizApps Sales needs from the other apps

**Measured 2026-08-26** against every repo at `origin/next`, in a joined pnpm workspace at `C:\v6`.
Nothing here is a Sales defect. Everything was reproduced, and each reproduction is written down so it
can be checked rather than believed.

## Where Sales stands, for context

| suite | result |
|---|---|
| Integration (132 checks) | **127 passed / 5 failed** |
| Playwright (31 tests) | **26 passed / 2 failed / 3 skipped** |
| Metadata drift (both directions) | **0** |
| Dangling `RelatedEntityID` references | **0** |

**All 5 integration failures and 1 of the 2 Playwright failures are item 1 below.** The other
Playwright failure is ours and is being fixed separately.

---

## 1. contracts — breaks a working Sales feature (highest priority)

The only item here that takes a feature that worked and stops it working.

### 1a. Order Form requires a template that contracts does not ship

Commit `80ac891` ("Enforce the eight backend rules the schema promised and nothing checked") added:

```
A Order Form must reference the agreement version it incorporates.
Choose the template whose standard terms this contract is written against.
```

Nothing can satisfy it on a clean install:

* `metadata/contract-templates/` is **empty**
* `V202608240300__v0.1.x__Metadata_Sync.sql` creates `spCreateContractTemplateType` only — template
  **types**, not templates
* a fresh install therefore has **4 contract types and 0 contract templates**

`Contract.ContractTemplateID` is still **nullable** in the schema, so this is a business rule that
contradicts the column it guards.

**Why Sales does not supply one.** `packages/CoreEntitiesServer/src/LiveContractsSeam.ts` records the
decision against contracts' own documentation:

> line 114 — *"**No ContractTemplateID.** Not merely unimplemented: contracts' own column description
> says a contract created ..."*
>
> line 318 — *"Contracts says so. ContractTemplateID is 'nullable because a contract created ...'"*

Sales read the contract that contracts published, and followed it.

**What we need:** either ship a default template with the seed, or restore the nullable contract for
the close-won path. Either resolves it.

**Fails:** `CT6`, `WT10`, `WT14`.

### 1b. Contract Types cannot be read — ParentStatusRequirement

```
RequestError: Invalid column name 'ParentStatusRequirement'
Field ParentStatusRequirement not found in entity MJ_BizApps_Contracts: Contract Types
```

That column exists in **no table, no view, and no `EntityField` row**. It appears once in
`B202608040001__v0.1.x__Baseline.sql`, and the only source reference is a comment in
`packages/Entities/src/ContractTypeEntity.ts` calling it *"the original"* approach. Something still
reads it at runtime.

**Fails:** `CT1`, `CT5`.

### Already fixed — KI-13 can be closed

Worth saying plainly, because it was open a long time: **contracts now installs on a fresh database.**
4 migrations, exit 0, and the checks KI-13 itself prescribes all come back clean — 6 entities
registered, **0 dangling cross-app `RelatedEntityID` references, 0 column-count drift**. The
hardcoded-entity-UUID defect is gone.

---

## 2. common — blocks every fresh install

`migrations/V202608252150__v5.35.x__CodeGen_Scoped_SQL_Objects.sql`, final statements:

```sql
EXEC sp_refreshview '${mjSchema}_BizAppsOrders.vwOrderHeadersGenerated';   -- UNGUARDED
IF OBJECT_ID('[${mjSchema}_BizAppsOrders].[vwOrderHeaders]', 'V') IS NOT NULL
BEGIN ... END;                                                             -- guarded
```

common's migration refreshes **orders'** views, and common installs **before** orders — it is the base
layer everything depends on. The second refresh is guarded; the one directly above it is not. A
from-empty install dies at common with:

```
Could not find object '__mj_BizAppsOrders.vwOrderHeadersGenerated'
```

**What we need:** one `IF OBJECT_ID(...) IS NOT NULL` guard. The correct form is already on the next
line of the same file.

**Invisible to incremental installs** — anyone whose database already has orders never sees it. Only a
from-empty build does, which is exactly what QA does first.

---

## 3. orders — blocks every fresh install

`migrations/V202608252200__v0.1.x__CodeGen_Scoped_SQL_Objects.sql` fails from empty with:

```
Violation of UNIQUE KEY constraint 'UQ_EntityField_EntityID_Sequence'
duplicate key value is (90a1060f-..., 2)   -- MJ_BizApps_Orders: Event Order Lines
```

The call order inside that one file:

| line | statement |
|---|---|
| 331 | `spUpdateExistingEntityFieldsFromSchema` — renumbers, **collides here** |
| 6951 | `spDeleteUnneededEntityFields` |
| 6954 | `spUpdateExistingEntityFieldsFromSchema` — renumbers again, correctly |

`Event Order Lines` carries stale `EntityField` rows for dropped columns — `AttendeeName` at sequence
2, `AttendeeEmail` at 3. `CheckInAt` needs to move into 2, so the renumber at line 331 violates the
constraint before the delete at 6951 has cleared the way.

**Proven:** running `spDeleteUnneededEntityFields` by hand first makes the renumber succeed, and the
migration then applies cleanly.

**What we need:** drop the line-331 call. The correct delete-then-renumber pair already exists at
6951/6954 in the same file.

### Also worth a look: that emit's scoping

Its header says *"Scoped CodeGen emit for `__mj_BizAppsOrders`"*, but **all five of its `EntityField`
inserts target `MJ_BizApps_Common: Activity Types`** — a common entity. None target an orders entity.

---

## 4. MJ — a tax on every build, for every developer

### 4a. ai-cerebras has not compiled once

```
src/models/cerebras.ts(249,59): error TS2339: Property 'choices' does not exist on type 'ChatCompletion'
src/models/cerebras.ts(270,36): error TS2339: Property 'usage'   does not exist on type 'ChatCompletion'
src/models/cerebras.ts(296,37): error TS2339: Property 'model'   does not exist on type 'ChatCompletion'
```

The build script is `tsc && tsc-alias -f`. `tsc` fails, so **`tsc-alias` never runs**, so `dist` keeps
extension-less ESM imports:

```
export * from './models/cerebras';        -- cerebras, broken
export * from './models/openAI.js';       -- openai, correct
```

Node's ESM resolver rejects the first, and it takes down **the MJ CLI and the test harness**, not just
the AI provider:

```
Cannot find module '...\Cerebras\dist\models\cerebras'
imported from ...\Cerebras\dist\index.js
```

Every `turbo run build` resets it. We have re-run `npx tsc-alias -f` in that package **seven times
today**, and it survived 200+ commits of MJ moving.

### 4b. Published 6.1.0-edge.3 and next are not the same code

MJ has not bumped its version since publishing `edge.3`, so the registry tarball and a local `next`
build **share a version number and differ in content**. pnpm cannot tell them apart, and a package
that does not *declare* a dependency directly resolves it by hoisting — landing on the registry copy,
which is missing exports the newer code imports:

```
error TS2305: Module "@memberjunction/global" has no exported member EscapeSQLString
error TS2305: Module "@memberjunction/core-entities" has no exported member BaseIdentityClaimDriver
```

`linkWorkspacePackages: true` does not prevent this, and neither does `preferWorkspacePackages` — both
were set, both measured. Our workaround is **306 `pnpm.overrides` entries** mapping every
`@memberjunction/*` package to `workspace:*`.

**What we need:** a version bump on `next` after a publish, so the two are distinguishable.

---

## The pattern worth naming

Items 2 and 3 share a shape, and Sales had the identical bug twice this week
(`V202608211200` and `V202608211201`, both fixed here):

> **A migration that touches a generated object — an `Entity` row, a `vw*` view, a CRUD proc — needs a
> guard, because a from-empty install does not have it yet.**

None of these are reachable from an existing developer database. They are reachable only from an empty
one, which is the first thing QA does and the last thing a green build tests.
