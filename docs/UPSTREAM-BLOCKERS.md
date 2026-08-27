# Upstream blockers — what BizApps Sales needs from the other apps

**Measured 2026-08-26** against every repo at `origin/next`, in a joined pnpm workspace at `C:\v6`,
and **re-measured 2026-08-27** for items 2 and 3. Everything was reproduced, and each reproduction is
written down so it can be checked rather than believed.

Items 2 and 3 are now **closed**: both were core-version symptoms and both pass at MJ
`v6.1.0-edge.4`. With those gone, the one thing still blocking a from-empty install is in THIS
repo — see "And what the fresh install fails on NOW", under item 3. This doc used to open by
saying nothing here is a Sales defect; that is no longer true, and it would be convenient to
leave it standing.

## Where Sales stands, for context

| suite | result |
|---|---|
| Integration (2026-08-27) | **137 passed / 1 failed of 138** — CD24 only, a tripwire on orders' `OrderHeader.Status` vocabulary. Measured on `feature/issue-32-term-start`, which adds the 6-check `term-start` bundle; `next` itself registers 132. |
| Playwright (31 tests) | **26 passed / 2 failed / 3 skipped** |
| Metadata drift (both directions) | **0** |
| Dangling `RelatedEntityID` references | **0** |

The Playwright row is as of 2026-08-26 and has NOT been re-measured; the integration row has.
**The 5 integration failures that row used to record were item 1 below**, and they are gone.

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

## 2. common — ✅ RESOLVED at MJ core v6.1.0-edge.4 (was: blocks every fresh install)

> **STATUS 2026-08-27 — RESOLVED BY THE CORE VERSION, NOT BY A CHANGE TO COMMON.** Measured against a
> scratch database (`CONFIRM_DROP=MJ_V6_PinCheck scripts/rebuild-db.sh`), twice, changing only the MJ
> core tag:
>
> | MJ core | common |
> |---|---|
> | `v6.1.0-edge.3` | **fails** — `V202608252150` dies at batch 1/110: `Procedure or function spUpdateExistingEntitiesFromSchema has too many arguments specified` |
> | `v6.1.0-edge.4` | **19 migrations applied, clean** |
>
> The original defect below — an unguarded `sp_refreshview` of an ORDERS view inside a COMMON
> migration — is also gone: that file no longer calls `sp_refreshview` at all, and no remaining call in
> common's migrations names `BizAppsOrders`.
>
> So there is nothing left to ask of common. What remains is OURS: this repo pins MJ at `edge.3` in
> `package.json`, `mj-app.json` and the runbooks, and `.env` pins `MJ_CORE_VERSION=v6.1.0-edge.3`.
> Moving that pin to `edge.4` is a repo-wide decision (it touches CI and publishing), which is why it is
> recorded here rather than done quietly.
>
> An earlier note of mine blamed `rebuild-db.sh`'s hardcoded `v5.51.0` default for this failure. That
> was wrong — `.env` overrode the default on every host that ran it, so the v5 default was never
> actually used. The default was still wrong and is fixed separately; it was not this.

<details><summary>The original report, kept because the reasoning is still the record</summary>


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

</details>

---

## 3. orders — ✅ NOT REPRODUCIBLE at MJ core v6.1.0-edge.4 (was: blocks every fresh install)

> **STATUS 2026-08-27 — ALSO PASSES AT `v6.1.0-edge.4`.** In the same scratch rebuild, with common
> through, orders applied **15 migrations clean**, as did tasks (6) and accounting (5). The
> `UQ_EntityField_EntityID_Sequence` collision below did not occur.
>
> Not proof that the line-331 call is harmless — it is proof that on this core, from empty, it does not
> fire. The ask below is still worth making; it is no longer blocking.

<details><summary>The original report</summary>


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

</details>

### And what the fresh install fails on NOW — which is ours

With the core at `edge.4`, steps 2-6 all pass and step 7 fails in **this repo**:

```
7/7  bizapps-sales (hand-authored DDL only)
Failed at batch 1/475 (lines 1-121):
Could not find stored procedure '__mj_BizAppsSales.spCreateDealStatusType'.
Batches applied before the failure: 0
```

The sales baseline seeds its type tables through CodeGen'd stored procedures inside the same migration
that creates them, and on a genuinely empty database the seed runs before the procedure exists. Nothing
upstream is involved. Recorded here rather than in KNOWN-ISSUES because this doc is what a reader
consults to answer "can QA build from empty yet", and the honest answer is now "not because of common
or orders".

---

## 4. MJ — a tax on every build, for every developer

### 4a. ai-cerebras stops `turbo run build` — and the fix is three lines

```
src/models/cerebras.ts(249,59): error TS2339: Property 'choices' does not exist on type 'ChatCompletion'
src/models/cerebras.ts(270,36): error TS2339: Property 'usage'   does not exist on type 'ChatCompletion'
src/models/cerebras.ts(296,37): error TS2339: Property 'model'   does not exist on type 'ChatCompletion'
```

**Root cause, found 2026-08-27.** The SDK's exported `ChatCompletion` is a *union*:

```ts
export type ChatCompletion =
    ChatCompletion.ChatCompletionResponse | ChatCompletion.ChatChunkResponse | ChatCompletion.ErrorChunkResponse
```

Only `ChatCompletionResponse` carries `choices`, `usage` and `model`. `nonStreamingChatCompletion`
declares its local as the bare union, so all three reads fail. The SDK became a union at some version
and this code was never updated.

**The fix is to narrow the declaration**, which is correct by construction — the method is
*non-streaming*, so the non-streaming member is the only reachable one:

```ts
let chatResponse: ChatCompletion.ChatCompletionResponse;
chatResponse = (await this.client.chat.completions.create(...)) as ChatCompletion.ChatCompletionResponse;
```

Applied locally: **`npm run build` exits 0**, and `dist/index.js` now emits `from './models/cerebras.js'`
with the extension. That last part matters — `tsc-alias` only runs because `tsc` finally succeeded, so
this **replaces the `npx tsc-alias -f` ritual permanently** rather than patching around it. We had run
that by hand seven times in one day.

### It is worse than "a tax on every build" — it halts the build

Building `@memberjunction/ng-base-forms` pulls cerebras into the graph. Measured:

```
Packages in scope: 65
Failed: @memberjunction/ai-cerebras#build
run failed: command exited (2)
```

`ng-base-forms#build` **never ran at all** — zero mentions in the log. One unrelated AI provider stops
an Angular form library from building, and `--continue` does not help because the dependency is real.
This is why `accounting-ng` had never been built in our workspace at all.

The same defect class also breaks the **CLI at runtime**, because a failed `tsc` leaves `dist` with
extension-less ESM imports that Node cannot resolve:

```
Cannot find module '...Cerebrasdistmodelscerebras' imported from ...Cerebrasdistindex.js
```

Two further packages shipped the identical unloadable `dist` on 2026-08-27, and each one stopped
`mj codegen` outright:

```
Cannot find module 'C:6MJpackagesAIVectorsMemorydistmodelsSimpleVectorService'
Cannot find module 'C:6MJpackagesAIProvidersOpenRouterdistmodelsopenRouter'
```

Note that **MJAPI hides this** — it starts with `--experimental-specifier-resolution=node`, which
resolves extension-less specifiers. The CLI does not pass that flag, so the same `dist` that a running
server tolerates is fatal to `mj codegen`. That asymmetry is why this can look fine in dev and still
block every code-generation path.

**What we need:** the three-line narrowing above, plus `tsc; tsc-alias -f` (or a hard build failure)
so a package can never ship a `dist` that Node cannot load.

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

## 5. accounting — the GL Account form omits a required field (orders#112)

QA (Andrew) filed **bizapps-orders#112**: creating a GL Account offers *"no place to specify Company"*,
then fails on save with `Company cannot be null`. Root-caused and fixed on 2026-08-27, verified in a
running Explorer against a database with accounting installed.

### The cause: a custom form overrides the generated one

Two components register for the same entity:

```
packages/Angular/src/lib/custom/GLAccount/gl-account-form.component.ts:36
    @RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Accounts')

packages/Angular/src/lib/generated/.../mjbizappsaccountingglaccount.form.component.ts:7
    @RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: GL Accounts')
```

The **custom** one wins. Its editable Details panel renders six fields — `Code`, `Name`,
`AccountType`, `ParentGLAccountID`, `IsActive`, `Description` — and **`CompanyID` is not among
them**. The generated form does include it; it is simply never displayed. `GLAccount.CompanyID` is
`NOT NULL` with no default, so the save cannot succeed.

### What made it worse than a missing field

There *is* a control labelled "Company" on the page — in the Chart-of-Accounts toolbar, beside the Type
and Status filters. It is a tree filter:

```ts
public async OnCompanyChange(companyID: string): Promise<void> {
    this.SelectedCompanyID = companyID;
    await this.loadTree();          // never touches record.CompanyID
}
```

A tester finds "Company", sets it, and believes the record is scoped. It changed a tree view.

### The fix (one file, held local pending review)

`gl-account-form.component.html`:

1. `CompanyID` added to the Details panel with `LinkType="Record"` — a record picker, not a GUID box.
2. Gated `[EditMode]="EditMode && !record.IsSaved"` on `CompanyID`, `Code` and `AccountType`, because
   `GLAccountEntityServer.LOCKED_IDENTITY_FIELDS` refuses changes to them once `IsSaved` is true
   (Amith 2026-07-29: *immutable from the moment the record is created*). Without this gate the form
   offers edits the server always rejects — which `Code` and `AccountType` **already did** before this
   change.
3. `[AllowFKCreate]="false"` — the picker otherwise offers to create a *Company* from the GL Account
   form.
4. The tree filter relabelled **"Filter by Company"** so the two controls cannot be confused.

**Verified:** create renders the field and saves with `CompanyID` persisted (confirmed in the database,
then removed); edit renders the three locked fields read-only while `Name`, `Parent Account`,
`IsActive` and `Description` stay editable.

### A correction worth recording

This was first diagnosed as an MJ CodeGen defect — the form generator suppressing labels on
single-field sections. **That diagnosis was wrong**, and it survived longer than it should have because
it carried a real measurement: regenerating accounting's forms genuinely does flip
`[ShowLabel]="false"` to `"true"` on `CompanyID`. It described a form the application never loads.
What disproved it was rendering the actual screen, which required item 6 below.

The label defect is real but unrelated, and is recorded separately:

> **MJ CodeGen, latent.** `packages/CodeGenLib/src/Angular/angular-codegen.ts:793` emits
> `[ShowLabel]="${section.Fields.length > 1 ? 'true' : 'false'}"`, so any section holding exactly one
> field renders it with no label. Measured 2026-08-27: **107** such fields in MJ's own core forms, 26
> across the BizApps repos, **0** in Sales. Not urgent, and not the cause of #112.

---

## 6. `mj dev workspace` links resolution without ensuring anything is built

Not a code defect — a gap in the linking story. Reproducing QA's host on 2026-08-27 meant wiring all six
Open App clients into MJExplorer. Every single obstacle was a stale or absent build artifact, and none
of them announced itself:

| package | symptom | actual cause |
|---|---|---|
| `@memberjunction/ng-base-forms` | `TS4113` on `OnRecordRefreshed` | `dist` 11 minutes behind `src` |
| `accounting-ng` | never built at all | cerebras halted `turbo run build` (item 4a) |
| `common-ng` | `does not provide an export named 'OrganizationIdentityComponent'` | `dist` **12 days** stale (Aug 13 vs Aug 25) |
| `contracts-ng` | — | 15 `src` files newer than `dist` |
| `orders-ng`, `tasks-ng` | no `dist` | never built |

### The one worth understanding

`orders-ng` **compiled cleanly** against the 12-day-stale `common-ng`. Its build resolves `common-ng`
through tsconfig paths to *source*, so type-checking saw `OrganizationIdentityComponent`. The dev
server resolves the *built bundle*, which did not have it. So the package type-checks, ships, and then
dies at load:

```
SyntaxError: The requested module '@mj-biz-apps_common-ng.js'
  does not provide an export named 'OrganizationIdentityComponent'
```

Same shape as item 4a: **invisible at build time, fatal at load time.** A green build is not evidence
that the linked packages agree with each other.

### Why it matters beyond our machine

`entity-form-host` does **not** render a generic form when a client package is unwired or unloadable —
it fails with `No form is registered for "<entity>"`. So an app that was never built is
indistinguishable from an app that is broken. Any QA report of the form "the X form doesn't work" could
mean either, and there is no way to tell from the UI.

**What would help:** have `mj dev workspace` (or a `mj dev doctor`) report, per linked package, whether
`dist` exists and whether any `src` file is newer than it. That single check would have turned four of
the five rows above into a one-line diagnosis.

---

## The pattern worth naming

Items 2 and 3 share a shape, and Sales had the identical bug twice this week
(`V202608211200` and `V202608211201`, both fixed here):

> **A migration that touches a generated object — an `Entity` row, a `vw*` view, a CRUD proc — needs a
> guard, because a from-empty install does not have it yet.**

None of these are reachable from an existing developer database. They are reachable only from an empty
one, which is the first thing QA does and the last thing a green build tests.
