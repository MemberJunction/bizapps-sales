# Known issues — bizapps-sales

Live risks that are **not** bugs in this repo and cannot be fixed from here. Each one is something a
future developer will otherwise rediscover the hard way.

---

## 🔴 KI-1 — `AllowMultipleSubtypes` is `false` on common's `Person` and `Organization`

**This is fine today and becomes a silent data-corruption bug the moment a second app extends either
entity. It cannot be fixed in this repository.**

### The mechanism

MJ's IsA (Table-Per-Type) inheritance defaults to **disjoint** — *one child type per parent record* —
governed by `__mj.Entity.AllowMultipleSubtypes`. On common's two shared identity entities that flag is
currently `0`:

```
MJ_BizApps_Common: People          AllowMultipleSubtypes = 0
MJ_BizApps_Common: Organizations   AllowMultipleSubtypes = 0
```

*(Verified against a live `MJ_BizAppsSales` database on 2026-08-04, MJ core 5.51.0.)*

### Why sales is safe right now

Sales is the **first and only** app to extend either entity:

| App | Extends | Not a conflict because |
|---|---|---|
| **bizapps-sales** | `Person` → `SalesContact`, `Organization` → `SalesAccount` | it holds the only slot |
| bizapps-accounting | `MJ: Companies` → `AccountingCompanyProfile` | different parent entity |
| bizapps-orders | its own `Product` → `EventProduct`, `OrderLine` → `EventOrderLine` | own-schema parents |

With exactly one child type per parent, the disjoint default chains **correctly**. `SalesAccount` and
`SalesContact` resolve properly, their base views JOIN the parent, and parent fields mirror as expected —
all verified.

### What breaks, and how badly

The moment a **second** app extends `Person` or `Organization` while the flag is still `false`, the first
app claims the only slot and **the second gets wrong auto-chaining — silently**. No exception, no
migration failure, no log line. Wrong records at runtime.

This is not hypothetical. Both **ATS** and **certification** intend to extend `Person`, and the same
human is routinely a sales contact, an applicant *and* a member — that overlap is the normal case, not an
edge case.

### The fix — and where it must happen

Flip `AllowMultipleSubtypes` to `true` on both entities **in `bizapps-common`**, before any second app
ships an extension of them.

**Deliberately NOT done from this repo.** Ruled by Josue 2026-08-04 (see
[`DECISIONS.md`](./DECISIONS.md) D1): sales does not edit a dependency's metadata. Josue is raising the
change with the team separately.

### If you are the second app to extend `Person` — read this first

Do not ship your IsA extension until the flag is `true` in the database you are targeting. Check it:

```sql
SELECT Name, AllowMultipleSubtypes
FROM __mj.Entity
WHERE SchemaName = '__mj_BizAppsCommon' AND BaseTable IN ('Person', 'Organization');
```

If it returns `0`, stop and get the common change landed. A green build proves nothing here — the failure
is at runtime and it is quiet.

**Also referenced in:** `codegen-schema-info.json` (the `SalesContact` entry), the §4 header of
`migrations/V202608042101__v0.1.x__Tables_and_Objects.sql`, and `CLAUDE.md`.

---

## 🟠 KI-2 — `bizapps-orders/scripts/rebuild-db.sh` mis-substitutes common's schema placeholder

**A bug in the sibling repo, found while porting that script. Sales' copy is fixed; orders' is not.**

Orders' rebuild script applies `bizapps-common`'s migrations with:

```bash
sed 's/${flyway:defaultSchema}/__mj/g; ...'
```

and its comment asserts that common "extends core". **That is wrong.** Common's `Person`, `AddressType`
and `vwAddressLinks` all live in `__mj_BizAppsCommon`, and its versioned migrations reference
`[${flyway:defaultSchema}].[Person]` meaning *that* schema.

**Why it stayed invisible:** common's **baseline** hardcodes `__mj_BizAppsCommon`, so the tables land
correctly and the database looks healthy. Only the five **versioned** migrations fail —

- `V202605131500__v5.28.x__Tolerant_SP_Regen`
- `V202605131929__v5.29.x__Add_Person_DisplayName_Computed_Column`
- `V202605141121__v5.29.x__Person_DisplayName_Wireup`
- `V202605141122__v5.29.x__Metadata_Sync`
- `V202605201354__v5.30.x__Add_Person_LinkedUserID_Unique_Constraint`

— each dying on `Invalid object name '__mj.Person'`. And because the loop never checked `sqlcmd`'s exit
status, **the rebuild reported success over a half-applied dependency.**

**Fixed here** in `scripts/rebuild-db.sh`: substitute `__mj_BizAppsCommon` for `${flyway:defaultSchema}`
(keeping `__mj` for `${mjSchema}`), and pass `sqlcmd -b` so a SQL error sets a non-zero exit and `set -e`
actually stops the run.

**Action:** someone should carry this to `bizapps-orders`. Anyone who ran orders' `rebuild-db.sh` has a
local database whose `bizapps-common` is missing all five patches — most visibly
`Person.DisplayName`.

---

## 🟠 KI-6 — One CHECK constraint does not survive the PostgreSQL conversion

**The baseline converts and applies to PostgreSQL 16 in full, with exactly one exception.** Production
is PostgreSQL, so this is worth knowing precisely rather than vaguely.

### What was actually tested

The hand-authored half of `migrations/V202608042101__v0.1.x__Tables_and_Objects.sql` was converted with
`mj sql-convert --from tsql --to postgres` and the result **applied to a real PostgreSQL 16 instance**
(dependency tables stubbed, since `__mj` and `__mj_BizAppsCommon` do not exist there yet). Result:

| | SQL Server | PostgreSQL |
|---|---|---|
| Tables | 19 | **19** |
| Foreign keys | 47 | **47** |
| Unique constraints | — | 15 |

Type mapping is clean: `UNIQUEIDENTIFIER → UUID DEFAULT gen_random_uuid()`, `BIT → BOOLEAN`,
`NVARCHAR(MAX) → TEXT`, `NEWSEQUENTIALID() → gen_random_uuid()`. All 54 extended-property comments carry
through into `COMMENT ON` statements, so the reasoning survives into the PG artifact too.

### The one failure

`CK_DealStatusType_NotWonAndLost` — `CHECK (NOT (IsWon = 1 AND IsLost = 1))`.

The converter maps the `BIT` column to `BOOLEAN` but leaves the `= 1` comparison untouched, emitting
`"IsWon" = 1`. PostgreSQL has no implicit integer-to-boolean cast and refuses it:

```
ERROR:  operator does not exist: boolean = integer
```

**There is no portable rewrite**, which is the part worth recording:

- `CAST(IsWon AS int) + CAST(IsLost AS int) <= 1` is valid in *both* dialects — but the converter's
  identifier-quoting pass mangles it to `"CAST"("IsWon" "AS" INTEGER)`, quoting the keywords as
  identifiers. Syntax error.
- `IsWon + IsLost <= 1` is not an option: T-SQL refuses arithmetic on `BIT` outright.

So the constraint stays idiomatic T-SQL, and the PG path is a **documented one-line post-edit**:

```sql
-- after conversion, replace:
CHECK (NOT ("IsWon" = 1 AND "IsLost" = 1))
-- with:
CHECK (NOT ("IsWon" AND "IsLost"))
```

With that single edit applied, **every other statement applies cleanly**.

### The wider lesson — "0 errors" is not "it works"

`mj sql-convert` reported **`Errors: 0`** for every one of these runs, including the ones whose output
PostgreSQL rejected outright. That count means *"statements I was able to transform"*, not *"output that
applies"*. **Converting is not verifying.** The only thing that caught this was applying the result to a
real PostgreSQL instance, and any future claim that the schema is PG-ready should be backed by an apply,
not by a conversion summary.

Two converter defects worth reporting upstream: (1) `BIT` comparisons inside `CHECK` are not rewritten
when the column becomes `BOOLEAN`; (2) the identifier-quoting pass quotes `CAST`/`AS` as identifiers
inside `CHECK` expressions.

---

## 🟡 KI-3 — CodeGen's AI enrichment is skipped locally

`npm run mj:codegen` logs a wall of:

```
AdvancedGeneration: opening AI circuit after 3 consecutive credential/authentication failures
No suitable model found for prompt CodeGen: Smart Field Identification
```

**Harmless.** No AI provider credentials are configured in this environment, so "smart field
identification" and generated form-layout hints are skipped. CodeGen still completes — 412 entities,
post-CodeGen CRUD validation passing — and the **schema, entity metadata, base views, CRUD procedures and
permissions are all unaffected**. Only generated *descriptions* and *layout hints* are poorer.

**To silence it:** set `advancedGeneration.enableAdvancedGeneration = false` in `mj.config.cjs`, or
configure AI credentials. Left noisy on purpose for now — it is a true statement about the environment,
and suppressing it would also suppress a real credential problem later.

---

## 🟢 KI-4 — No HAND-AUTHORED Application yet *(corrected — the generated one exists and works)*

**This entry originally claimed sales had no MJ Application registered and was reachable only through a
generic entity browser. That was wrong**, and the Playwright harness disproved it on 2026-08-04.

**CodeGen auto-creates one MJ Application per schema.** Sales' is `__mj_BizAppsSalesGenerated`, live at:

```
/app/mjbizappssales
```

It is a working application: it lists all 19 entities, opens a full generated CRUD form per record with
Save Changes / Discard, resolves foreign keys to display names, renders child-relationship sections
(Deal Lines, Deal Team Members, Deal Stage Events, Deal Contact Roles), and supports create, read,
update and delete. All of that is verified end-to-end by
`test-harnesses/playwright/specs/10-deal-crud.spec.ts`.

**What is genuinely still absent** is a *hand-authored* Application with job-shaped
`DefaultNavItems` — the pipeline board and deal workspace of master plan §8. Orders' nav items are
`ResourceType: 'Custom'` pointing at `*SectionResource` components in its Angular package; sales has no
such components until **S3**, so there is nothing for custom nav items to point at yet. That is planned
work, not a defect.

**Lesson worth keeping:** "no custom UI was written" is not the same as "there is no UI". CodeGen's
generated application was doing more than the S1 status doc credited it with.

---

## 🟡 KI-5 — Deleting a record with its tab still open logs a load error

Deleting a record through the UI succeeds — the row leaves the grid — but MJ Explorer's tab manager then
re-Loads the now-deleted record and logs:

```
Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=…)
```

Reproducible for every entity (observed on Deals and Pipelines). **The delete itself is fine**; this is
an MJ-core tab-lifecycle concern, not a schema or form problem in this app.

Also worth knowing while looking at this: **MJ delete is a SOFT delete.** The grid gains a
`Recycle Bin · N deleted records` chip afterwards, so a test asserting "gone from the database" would be
asserting the wrong thing — "gone from the grid" is correct.

Scoped in the harness as `KNOWN_POST_DELETE_ERRORS` (`lib/explorer.ts`) so it is tolerated **only**
during the delete steps and still fails the console-error keystone anywhere else. Deliberately not added
to the global allowlist, which would hide it forever and everywhere.

---

## 🟠 KI-7 — A second FULL CodeGen pass corrupts the database (IsA lookup drift)

**Found the hard way in Phase 1, and it presents as a total inability to create a Deal.**

Running `mj codegen` a second time against an already-generated database regenerated `vwDeals` with
**eleven** virtual lookup columns where the first pass produced **ten**. The extra one was `Account`, a
name-lookup join derived from `SalesAccount` — an **IsA child** — that pass 1 had not been able to resolve
yet. Pass 2 added the column to the VIEW but did **not** add the matching `EntityField` row.

The consequence is not cosmetic. `SQLServerDataProvider` builds its `@ResultTable` from **entity
metadata** and then runs `INSERT INTO @ResultTable EXEC spCreateDeal`. With 55 registered fields and a
56-column result set, every insert fails:

```
Column name or number of supplied values does not match table definition.
```

…inside a transaction that then aborts, so the rollback also errors. Nothing about the message points at
CodeGen.

**Why a second pass happens at all:** remote operations generate from *metadata rows*, so a pass before
`mj sync push` cannot see them and every `Sales.*` operation shell is silently missing from
`remote_operations.ts`.

**The fix, now in the documented loop:** pass 2 must be `npm run mj:codegen:files` (`codegen --skipdb`),
which regenerates TypeScript/Angular/GraphQL only and provably leaves the database untouched — verified by
re-counting fields and view columns before and after.

A single pass is self-consistent. Two full passes are not. Expect this to bite hardest around
`SalesAccount` / `SalesContact` and anything else extending a parent entity.

---

## 🟠 KI-8 — FKs to IsA CHILD entities get no virtual name column

`vwDeals` resolves ten FKs to a display name (`Pipeline`, `DealType`, `Company`, `OwnerEmployee`, …) but
**not** `AccountID`, `PrimaryContactID` or `BillingContactID`. All three point at IsA children
(`SalesAccount` IS-A `Organization`, `SalesContact` IS-A `Person`) whose `Name` lives on the **parent**
table, and CodeGen does not generate the lookup join through the IsA edge.

Consequences to design around rather than fight:

- A `Deal` row read on its own **cannot** display its customer's name. Any surface that needs it — the
  deal workspace's persistent customer-context header, a grid column, a report — must read
  `MJ_BizApps_Sales: Sales Accounts` separately. Batch it with `RunViews`, never per row.
- This is also why requesting `Fields: ['Account']` on the Deals entity logs
  `Field Account not found in entity MJ_BizApps_Sales: Deals` rather than returning null.

Not a bug in this app's schema, and not worth working around with a hand-authored view: the baseline's
view is CodeGen output, so any edit is overwritten on the next run. Related to KI-7 — the same unresolved
IsA edge is what pass 2 partially "fixed" into an inconsistent state.

---

## 🔴 KI-9 — `DealStageEvent` stamping WILL be lost or doubled when the sibling branches converge

**This is a merge hazard, not a defect in any branch. Each branch is internally correct; the damage
happens at the point they meet, and in both directions it is silent.**

`feature/deal-rrc-conversion` **deleted `SaveDealOperation.ts`** — the file that, on one sibling branch,
is where the stage-event append lives. Nothing on `next` appends a stage event today (verified
2026-08-14: the only mentions on this lineage are TODO comments in `DealEntityServer.ts` and
`CoreEntitiesServer/src/index.ts`), so nothing here is broken. The exposure is entirely in what happens
next.

### Where the append lives, per branch

| Branch | Site | What convergence has to do |
|---|---|---|
| `next` (post-RRC) | — nothing | — |
| `feature/pipeline-board` | `SaveDealOperation.ts:283`, gated by a `stageChanged` comparison against a `priorStageID` captured before the field is assigned | **RE-HOME IT.** Its host file no longer exists |
| `feature/close-flow` | `CloseDealOperation.ts` — two append sites | **DELETE ITS APPEND**, once the append below exists |

### The two failure modes

**Losing it.** `feature/pipeline-board` puts the append inside a file this branch deleted. Git resolves a
delete-versus-modify conflict in favour of the delete readily, and the board's own checks
(`board-move.checks.ts`) are what would catch it — *if* they are run. Merged carelessly, stage transitions
stop being recorded, and nothing errors. The provenance trail is append-only precisely because it cannot
be reconstructed afterwards, so this is unrecoverable rather than inconvenient.

**Doubling it.** The append's correct home is `DealEntityServer.Save()`, because a stage change can arrive
from any caller — a board drag, a workspace save, an Action, an agent. Once it is there,
`CloseDealOperation`'s own appends become a **second** stamp for the same transition. Two events for one
move corrupts every velocity and stage-duration measure computed from the table.

### Where it must go, and why the location is specific

Inside `DealEntityServer.Save()`, in the **`IsGraphNodeSave` branch** — not the outer one. Read the
comment on that method first: it is called twice per composite save, and only the flagged call runs inside
the save graph's transaction. An append on the outer call would survive a rolled-back save, leaving an
event that claims a transition which never happened.

### Convergence checklist

1. Move the append into `DealEntityServer.Save()`'s `IsGraphNodeSave` branch, keeping the
   `AmountAtTransition` / `ProbabilityAtTransition` stamps and the prior-stage capture.
2. Delete `CloseDealOperation`'s two appends in the same change — never as a follow-up.
3. Add a check asserting **exactly one** event per transition. There is none today, and its absence is
   why this issue is red rather than orange.

Until step 3 exists, the doubling failure has no automated witness at all.

---

## 🟠 KI-10 — The shared v6 host cannot hold orders' schema, and app CodeGen must exclude Sales

**Two separate hazards on `MJ_V6_Host`, both found the hard way and both cheap to avoid once known.**

### Orders cannot be applied here — the FK chain runs three apps deep

Applying orders' migrations to a host that has only `__mj`, `__mj_BizAppsCommon` and
`__mj_BizAppsSales` fails with `Msg 1767 — foreign key references invalid table`:

```
REFERENCES __mj_BizAppsAccounting.Dimension
REFERENCES __mj_BizAppsAccounting.DimensionValue
REFERENCES __mj_BizAppsAccounting.JournalEntry
```

…and accounting has its own hard FK one level deeper —
`FOREIGN KEY (ApprovalTaskID) REFERENCES __mj_BizAppsTasks.Task(ID)`. **The real order is
tasks → accounting → orders.** Orders' *own* reference to tasks is only a comment ("FK the moment tasks
and common are verified"), so that link is soft; accounting's is not.

The same chain exists at the npm level: orders' `package.json` declares
`@mj-biz-apps/accounting-engine-base` and `accounting-ng`, and its lockfile is currently stale against
that, so `pnpm install --frozen-lockfile` refuses.

**Consequence:** `MJ_BizApps_Orders: Products` is a **DEV-ONLY STAND-IN** here — orders' real `Product`
DDL plus its four lookup tables, transcribed verbatim, with a hand-written `vwProducts`. Everything the
picker touches is orders' own definition; what is absent is orders' other 44 tables.

### Hand-registering an entity does NOT make it resolvable

Inserting `Entity` + `EntityField` + `EntityPermission` rows by hand is **not sufficient**. Measured on
this host: `__mj.Entity` and `vwEntities` both return **407**, the metadata dataset item has no
`WhereClause`, and a fresh process still loads **406** — the hand-registered row is the only one missing.

Ruled out: permissions (all 407 have rows, matching the acting user's roles), `ApplicationEntity` (37
other entities lack one and load fine), caching (`InMemoryLocalStorageProvider` is per-process),
field shape, and `DisplayName`. A full column diff against a generated entity shows no remaining
difference. **CodeGen does something further that is not visible in the schema.** Registering an entity
for real means running that app's CodeGen.

### ⚠️ STANDING RULE — any app CodeGen run against a shared host MUST exclude the other apps

`bizapps-orders/mj.config.cjs` excludes `__mj`, common, accounting and tasks — but **not**
`__mj_BizAppsSales`, because orders has never shared a database with Sales. Running it here as-is would
regenerate Sales' entities, which is the KI-7 corruption case with a second app holding the pen.

**Before running any sibling's CodeGen against `MJ_V6_Host`, add every other app's schema to its
`excludeSchemas`,** and snapshot the other apps' entity rows before and after — entity ID, base
table/view, parent, and a checksum over every field — then confirm byte-identical before proceeding.
