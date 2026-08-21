# Known issues — bizapps-sales

Live risks that are **not** bugs in this repo and cannot be fixed from here. Each one is something a
future developer will otherwise rediscover the hard way.

---

## 🛑 KI-22 — BLOCKING THE FOUNDATION: no deal that has an order can be READ, and every new deal has one

**Severity raised 2026-08-20 (Andrew).** This was filed as a known issue and it is not one. Every deal
created since `DealEntityServer` began provisioning an embedded order (S-US4) has an order, so
"anything that must read a deal before writing it" now means **every deal**. It looks narrow only
because six of the seven story deals predate provisioning. Nothing in the deal workspace or on the
pipeline board can open, move or edit a deal created from now on.

### ROOT CAUSE FOUND — and it is one line of JSON in orders

`bizapps-orders/metadata/.mj-sync.json` listed **7 of its 23** metadata directories in `directoryOrder`.
Everything unlisted falls to default alphabetical ordering — which is harmless until an alphabetical
neighbour is also a dependency:

```
"queries"          →  q u e r i e s
"query-categories" →  q u e r y - c a t e g o r i e s
                              ↑ 'i' < 'y', so queries sorts FIRST
```

So every query was pushed ahead of the category it references, and `mj sync push --dir metadata` halted:

```
✖ Push failed  Failed to process field 'CategoryID' in MJ: Queries:
  Lookup failed: No record found in 'MJ: Query Categories' where Name='Orders'
```

**The halt is the bug, not the queries.** `sync push` stops there, so the NINE directories after it never
ran — including `entity-fields` (16 of 23) and `entity-relationships` (17 of 23), which carry exactly the
metadata KI-22 was about. The earlier observation that a push reported `entity-fields — 5 updated` while
the values stayed NULL was the whole push being rolled back.

Hypothesis credited to Andrew; measured here.

### The fix, and what it unblocked

Adding `query-categories` before `queries` to `directoryOrder`:

| | before | after |
|---|---|---|
| directories processed | 14 of 23, then halt | **23 of 23, exit 0, 0 errors** |
| `MJ: Query Categories` named `Orders` | 0 | 1 |
| `EntityField.EmbeddedRecord` rows | **0** | **5** — the exact five orders ships |
| `EntityRelationship.RelatedRecordCollection` rows | 18 | **23**, including `OrderHeader → OrderLines` with its full `Lines` declaration |

`62 created, 98 updated, 0 errors.` This is the same class of problem as KI-21: orders' schema was
migrated to this host and its metadata never was — because it *could* not be.

### One line still stands between that and a working reopen

With the metadata complete, orders' CodeGen file pass now produces code that keeps everything my earlier
attempt broke — `InitialPaymentDetailID_Object` survives, `OrderHeader.Lines` survives — **and** gains
the missing `RootReversesOrderHeaderID`. It fails to compile on exactly one line:

```ts
// packages/Entities/src/generated/entity_subclasses.ts:10
import { mjBizAppsCommonAddressEntity } from '@mj-biz-apps/orders-entities';   // ← itself
//                                            should be '@mj-biz-apps/common-entities'
```

That is the **`entityPackageName`** limitation this repo already documents at length in
`packages/Entities/src/deal-entity.ts`: with a plain string, every non-core schema resolves to the
generating package, so common's `Address` comes out as orders' own. It appeared only now because the
completed push added the `BillToAddressID` / `ShipToAddressID` embeds that make CodeGen emit the import
at all. **Do not "fix" it with a schema map** — that variant makes CodeGen exclude those schemas from
generation entirely, measured both ways and recorded in `deal-entity.ts`.

Corrected by hand as a DIAGNOSTIC (then reverted — generated code is not the place for it), all four
orders packages build.

### AND WITH THAT ONE LINE CORRECTED, EVERYTHING WORKS — verified end to end

The whole chain, on `MJ_V6_Host`, with the API restarted:

* **`DEAL-9001` opens in the deal workspace.** The deal that could not be read at all — name, pipeline,
  stage, customer, primary contact, term all present.
* **Its order lines render, priced by orders:** `Platform — Premium Seat (PLAT-PRM)`, Qty 3, Unit price
  229, Line total 687, Discount % 0.
* **The screen matches the database exactly** — `LineNumber 1, Quantity 3, UnitPrice 229,
  LineTotalNet 687, DiscountPct 0, SKU PLAT-PRM`. Sales set the product and the quantity; every figure
  came back from orders.
* **Zero console errors.**

That closes the half of the Explorer pass that has been blocked since the redesign: create → provision →
add a line was already proven; reopen → resolve the embedded order → render its priced lines is now
proven too.

### The state this host is in right now, so nobody is surprised

| Change | Where | Status |
|---|---|---|
| `query-categories` before `queries` in `directoryOrder` | `bizapps-orders/metadata/.mj-sync.json` | **the real fix.** Uncommitted in the orders working tree, ready to land — Josue has push access |
| orders' metadata, fully pushed | `MJ_V6_Host` | 62 created, 98 updated, 0 errors |
| orders' regenerated `src/generated` | orders working tree | uncommitted; correct except the one import |
| that one import, hand-corrected | `packages/Entities/src/generated/entity_subclasses.ts:10` | **a DIAGNOSTIC, not a fix.** Generated code — the next CodeGen run wipes it |

The hand-correction is deliberately left in place so the working environment can demonstrate the fix,
and is called out here because it is exactly the kind of edit that must not be mistaken for generated
output. **The durable fix is in MJ's CodeGen `entityPackageName` resolution**, and until it lands orders
cannot be regenerated cleanly on any host that carries common's schema. `DECISIONS-NEEDED.md` DN-14.

---

## ✅ KI-23 — RESOLVED: `spCreateOrganization` and `spUpdateOrganization` were missing from `MJ_V6_Host` (host damage, not a common defect)

**Found by clicking, not by reading**, while verifying #33's inline create-and-return in the Explorer.
Creating a customer from the deal workspace fails with:

```
Failed to save parent entity 'MJ_BizApps_Common: Organizations': Error executing SQL
  Could not find stored procedure '__mj_BizAppsCommon.spCreateOrganization'.
```

**The IsA chain did its job.** `SalesAccount` IS an Organization (same UUID), so the save reached for the
parent first — exactly as designed — and the parent's insert procedure is absent.

### It is a PARTIAL CodeGen application, which is why nobody noticed

`__mj_BizAppsCommon` holds 46 procedures and 18 views. What it has, and what it does not:

| Entity | Create | Update | Delete |
|---|---|---|---|
| `Person` | ✅ | ✅ | ✅ |
| `OrganizationType` | ✅ | ✅ | ✅ |
| **`Organization`** | ❌ | ❌ | ✅ |

An Organization can be **deleted** but not created or updated. One entity, two of three procedures, on a
schema that is otherwise complete — so nothing looks broken until something tries to write one.

### Why it stayed invisible

* **The demo seed writes Organizations with raw SQL `INSERT`**, not through the entity layer, so seeding
  succeeds and every screen that only READS accounts is fine. All 92→93 integration checks pass, because
  none of them creates an account — they resolve the seeded ones.
* **It was visible earlier and I mis-triaged it.** My own CodeGen run reported
  `Error executing permissions file ... spCreateOrganization ... Cannot find the object` and the same for
  `spUpdateOrganization`, and I recorded it as "cross-app permission noise" because it named another app's
  objects. It was not noise; it was this. A permissions step failing because the OBJECT is missing is a
  different fact from a permissions step failing.

### What it blocks

* **#33's inline create-and-return cannot be demonstrated**, though the code is correct: the slide-in
  opens over the workspace, the title renders, Save/Cancel are in the right places, and the picker
  correctly does NOT change — because my code returns early when `AfterSaved()` yields nothing rather than
  inventing a selection. The blank-picker question the click-through was meant to settle is therefore
  still **unobserved**, not answered.
* **Any path that creates or edits an account**: the UI, an Action, an agent, a script. Not UI-specific.
* The HubSpot importer in S6, which will create accounts by definition.

### RESOLVED — host damage, repaired additively

**It was not a defect in bizapps-common.** Common's baseline creates all three procedures; two were lost
from this host. The likely moment is the CodeGen run that reported them as permissions failures — which is
what my own note that "a permissions step failing because the object is missing is a different fact" was
pointing at without following through.

**Enumerated before repairing, rather than assuming it was only those two.** All 16 tables in
`__mj_BizAppsCommon` were checked for a complete create/update/delete trio:

| Result | |
|---|---|
| Tables checked | 16 |
| Complete trios | 15 |
| Incomplete | **1 — `Organization` (create and update missing, delete present)** |
| Procedures found | 46, against 48 expected for 16 tables — consistent with exactly two lost |
| Triggers | all 16 present, including `trgUpdateOrganization` |

One correction to my own first pass: I reported `Person` as missing its view. It is not —
the view is `vwPeople`, and my check had guessed `vwPersons`. A naming guess of mine, not a gap.

**Repaired the same way contracts was**, additively and with no CodeGen: the last definitions of both
procedures were extracted from `V202608132239__v5.34.x__Layered_Base_Views_Metadata.sql` — the newest
migration that defines them, and the one whose output matches the current columns — the
`${flyway:defaultSchema}` placeholder substituted for `__mj_BizAppsCommon`, and the eight resulting
batches run. No drops of anything else; `trgUpdateOrganization` is recreated from the same generated
definition it already had. The three existing Organization rows were untouched, and the procedure count is
now 48 with no incomplete trios.

**The extracted SQL is deliberately NOT committed to this repo.** Sales carrying another app's schema
fragment is the thing the IsA chain exists to avoid; it was run as a one-off host repair and is described
here so it can be reproduced.

**Verified by using it**, not by inspecting it: creating a customer from the deal workspace now writes both
the `Organization` and the `SalesAccount` IsA child, `IsActive = 1`, visible in `vwSalesAccounts`. The
three test records created while verifying were removed afterwards; the demo is back to its three accounts.

**Contacts were never blocked** — `spCreatePerson` was present throughout.

---

## 🔴 KI-22 (as originally recorded) — Orders' generated GraphQL resolvers are behind the database

**The second half of KI-21, and it is a DIFFERENT problem with the same symptom.** With orders'
server package registered, the schema gained the type — and the load still failed:

```
Error: Cannot query field "RootReversesOrderHeaderID" on type "mjBizAppsOrdersOrderHeader_".
        Did you mean "ReversesOrderHeaderID" or "ReversesOrderHeader"?
Error in BaseEntity.Load(MJ_BizApps_Orders: Order Headers, Key: ID=8ADF440B-…)
```

### What is skewed against what

| Where | `RootReversesOrderHeaderID` |
|---|---|
| `__mj_BizAppsOrders.vwOrderHeaders` (MJ_V6_Host) | **present** |
| `__mj.EntityField` for *Order Headers* | **present**, `IsVirtual = 1` |
| orders' `packages/Server/src/generated/generated.ts` | **absent** |
| orders' `packages/Server/dist/…` | **absent** |

The client builds its GraphQL selection set from **entity metadata**, so it asks for every registered
field. The server's type comes from orders' **generated resolvers**. The database has the recursive
hierarchy column MJ emits for a self-referencing FK (`ReversesOrderHeaderID` → `Root…`, `…Depth`,
`…Path`, `…IsLeaf`, `…ChildCount`); orders' committed generated code predates it. So metadata promises a
field the schema does not have, and every read of an Order Header fails.

**It is not a stale `dist`.** Source and dist agree — both lack it. Rebuilding orders changes nothing;
its CodeGen has to be re-run against this database.

### Why sales feels it and orders does not

Orders' own suite runs in process and never asks GraphQL for that field. Sales' deal workspace reads the
embedded order **over GraphQL**, so it is the first consumer to notice. Nothing in sales can fix it.

### What it blocks, precisely

Reopening any deal that has an order — i.e. every deal created since the redesign.
`DealWorkspaceService.LoadDeal` refuses rather than rendering a deal with no lines, which is the right
behaviour and makes the failure visible instead of silent data loss:

> deal … points at order … but the embedded record did not resolve. Refusing to render it as a deal
> with no lines.

Creating a deal, and creating its order, both still work: those go through **sales'** own resolver, and
the order is written server-side inside `DealEntityServer.Save()`.

### THE FIX WAS ATTEMPTED ON 2026-08-20 AND IT DOES NOT WORK. Read this before trying it again.

The obvious move is to re-run orders' CodeGen file pass against this database and rebuild:

```bash
cd bizapps-orders && node node_modules/@memberjunction/cli/bin/run.js codegen --skipdb && npm run build
```

That was run, with a full database backup taken first and orders' `excludeSchemas` already guarding
`__mj_BizAppsSales`. **It fixes the field and breaks two other things,** because the premise is wrong:
this host's `__mj` metadata is not the metadata orders' committed code was generated against. Each
regeneration trades one skew for another.

| Round | What was regenerated | Outcome |
|---|---|---|
| 1 | files only | `RootReversesOrderHeaderID` **appears** ✅ · `OrderHeaderEntity.InitialPaymentDetailID_Object` **disappears** ❌ — `orders-entities` no longer compiles |
| 2 | after setting the missing `EntityField.EmbeddedRecord` rows | the embeds come back ✅ · `entity_subclasses.ts` now **self-imports** `@mj-biz-apps/orders-entities` ❌ and `OrderHeader.Lines` **disappears** ❌ |

Everything was restored: orders' generated files to `HEAD`, and the seven `EmbeddedRecord` rows back to
`NULL`. Orders builds again and its `dist` matches its committed source.

### What the two failed rounds actually establish

**MJ_V6_Host is missing at least three CLASSES of orders' metadata**, not one field:

* **`EntityField.EmbeddedRecord`** — **zero** rows on the whole host. Orders ships these in
  `metadata/entity-fields/.embedded-payment-detail.json` and `.embedded-order-addresses.json`; that
  file's own comment says they need MJ's v6.1+ column and a push. `mj sync push --dir metadata` reported
  `entity-fields — 5 updated` and the values did **not** persist, so the push path for this column does
  not work here either.
* **`RelatedRecordCollection`** — `OrderHeader.Lines` vanished from the regenerated class, so this is
  missing too. Which also means **KI-20's cause is not the only reason line removal misbehaves**: on
  this host the collection is not even declared in metadata.
* **whatever drives `entityPackageName`** — the self-import is the exact trap sales documents in
  `packages/Entities/src/deal-entity.ts`, arriving from the other direction.

**So this is not a CodeGen problem. It is an INSTALL problem** — the same family as KI-21. Orders'
schema was migrated here and its metadata never was. `mj sync push --dir metadata` in bizapps-orders
gets 14 directories in and then fails:

```
✖ Push failed  Failed to process field 'CategoryID' in MJ: Queries:
  Lookup failed: No record found in 'MJ: Query Categories' where Name='Orders'
```

That missing category is the first hard stop. Clearing it, letting the whole push complete, and THEN
regenerating is the sequence with a chance of working — and it is `mj app install` for bizapps-orders in
all but name.

### The board cannot route around it either — measured 2026-08-20

The hope was that the pipeline board would give a stage-change surface that never opens a deal, making
the gap narrower than it looks. **It does not.** Dragging `DEAL-9001` — the one seeded deal that has an
order — refused, with the board saying so plainly:

> "Northwind Health — Platform Rollout" could not be read, so it was not moved.

and the same three console errors as the workspace, ending in
`DealWorkspaceService.LoadDeal: ... the embedded record did not resolve`. The database was unchanged:
same stage, same order status, same event count. The refusal is honest — nothing half-happened.

**The isolating result matters more than the failure.** Dragging a deal with NO order works completely:
`DEAL-9002` moved Qualification → Discovery, the target stage's probability default was applied
(25% → 10%), and **exactly one `DealStageEvent` was appended, stamped with `Probability = 25` and
`Amount = 42000`** — the values the deal held on the way OUT, not the 10 it arrived at. That is `BD2`'s
claim, verified through the UI rather than in process.

So the board is fine, the write path is fine, and the blocker is precisely and only the
**embedded-order LOAD**. Anything that must read a deal before writing it — workspace, board, importer —
hits it; anything that only creates hits nothing.

> **A false alarm worth recording, because it is the third time this trap has been sprung here.** The
> first run of that drag appeared to move the deal and append NO event, which read as a defect in the
> merged writer. It was a STALE API: MJAPI had been running since before the board branch was merged, so
> the process was holding a `DealEntityServer` with no `appendStageEvent` in it. `ng serve` rebuilt the
> browser bundle and made everything look current. CLAUDE.md says to restart both servers after a
> rebuild; the reason it keeps saying so is that the symptom is a plausible-looking wrong answer rather
> than an error.

That narrows what a fix has to restore: one GraphQL read of `MJ_BizApps_Orders: Order Headers` whose
selection set matches the host's entity metadata.

### Until then

Reopening a deal that has an order does not work in the Explorer, and neither does moving one on the
board, so the reopen half of the Explorer pass stays unverified. Creating a deal, provisioning its order and writing order lines all work: those
go through **sales'** own resolver and never ask GraphQL for an Order Header. `DECISIONS-NEEDED.md` DN-8
carries the decision.

**Do not "just re-run CodeGen".** It has been tried twice, it is recorded here, and the second attempt
left orders' tree broken until it was restored.

---

## 🔴 KI-21 — A host running Sales must ALSO register orders' server package, or no deal with an order can be opened

**Found in the Explorer pass on 2026-08-20, on MJ_V6_Host — a database where orders' schema, entities and
server classes were all present and the integration suite was fully green.** Every deal that HAS an order
failed to open in the workspace:

```
Error: Cannot query field "mjBizAppsOrdersOrderHeader" on type "Query".
Error in BaseEntity.Load(MJ_BizApps_Orders: Order Headers, Key: ID=8ADF440B-…)
DealWorkspaceService.LoadDeal: deal 7A3FB14D-… points at order 8ADF440B-… but the embedded record did
not resolve. Refusing to render it as a deal with no lines.
```

Since `DealEntityServer` provisions an order for every deal at creation, that is **every new deal**. Only
the older order-less seeded rows still opened, which is what made it look like a data problem.

### Why a green suite could not see it

The integration checks run **in process**: they resolve entities through the provider directly, so orders'
entities are reachable and every line assertion passes. The workspace reaches the same rows **over
GraphQL**, and a resolver enters the schema only if its file path is passed to `buildSchema`. From
`packages/ServerBootstrap/src/index.ts`:

> side-effect-importing a resolver class only registers type-graphql metadata, but `buildSchema` includes
> a resolver ONLY if it is PASSED in

So importing orders' packages — which the class manifest does — registers its entity CLASSES and none of
its resolvers.

### The mechanism, exactly

`loadDynamicAppPackages()` reads **`mj.config.cjs` → `dynamicPackages.server[]`**, written by
`mj app install`, and collects each listed package's exported `RESOLVER_PATHS`. On MJ_V6_Host that array
held one entry:

```
Loading Open App server packages...
  Loaded Open App server package: @mj-biz-apps/sales-server (ran LoadBizAppsSalesServer) (+2 resolver paths)
```

Sales only. Orders' schema was migrated and its entities registered, but `mj app install` had never been
run for it, so nothing contributed its resolver paths.

**Being in `package.json` is not enough, and neither is being in the class manifest.** Both were true here.

### The fix

Register orders as an installed Open App on the host — `mj app install` for bizapps-orders, or by hand in
`mj.config.cjs`:

```js
dynamicPackages: {
  server: [
    { PackageName: '@mj-biz-apps/sales-server',  StartupExport: 'LoadBizAppsSalesServer',  AppName: 'mj-bizapps-sales',  Enabled: true },
    { PackageName: '@mj-biz-apps/orders-server', StartupExport: 'LoadBizAppsOrdersServer', AppName: 'mj-bizapps-orders', Enabled: true },
  ],
}
```

The names come from orders' own `mj-app.json` (`packages.server[].startupExport`), not from guesswork.

### Why this is a KNOWN ISSUE and not a setup step

It is **both**, and the reason it is here is the AWS install. `mj-app.json` declares
`mj-bizapps-orders` a dependency, but a dependency declaration does not make the host register the
dependency's server package — and nothing in Sales can force it to. A host that migrates orders' schema
and stops there gets an app whose deal workspace cannot open a single deal, with a GraphQL error naming a
field rather than a missing install. Verify it before a deployment is called done:

```bash
grep -A3 'dynamicPackages' mj.config.cjs      # orders-server must be listed
# or, in the API's startup log:
#   Loaded Open App server package: @mj-biz-apps/orders-server (+N resolver paths)
```

---

## 🔴 KI-20 — Removing a line from an order is silently dropped, so the workspace's delete-line button does nothing

**Measured on MJ_V6_Host, 2026-08-20, by `test-harnesses/prove-line-removal.mjs`.** The save reports
SUCCESS and the row stays. Nothing logs, nothing throws, and the collection in memory is correct — so the
UI shows the line gone until the page is reloaded.

### The matrix, which is what makes the cause unambiguous

| Verb | Route | Result |
|---|---|---|
| INSERT a line | `deal.Save()` | ✅ written |
| EDIT a line | `deal.Save()` | ✅ written |
| **REMOVE a line** | `deal.Save()` | ❌ **row survives, save returns true** |
| **REMOVE a line** | `order.Save()` — the collection's own owner | ❌ **row survives, save returns true** |
| **REMOVE a line** | `Lines.Load()` then `order.Save()` — different loader | ❌ **row survives** |
| REMOVE an instalment (`Deal.PaymentSchedule`) | `deal.Save()` | ✅ **deleted** |

The last row is the control, and it is why this is not an MJ bug and not about embedded records. MJ's
collection-removal machinery works; `Deal.PaymentSchedule` proves it on the same save, in the same
process. Only `OrderHeader.Lines` drops the deletion, and it does so through every route.

### The cause, in bizapps-orders

`OrderEntityServer.Save()` deliberately takes the collection out of MJ's hands:

```ts
const savedHeader = await super.Save({ ...options, SkipRelatedCollections: true });
...
await this.persistPreparedLines(options, decisions);
```

`SkipRelatedCollections: true` is correct and well-reasoned — the comment above it explains that lines
must not insert before they have been expanded, priced, discounted, charged and taxed. But it means MJ
never processes the collection, so the hand-rolled replacement is now solely responsible for every verb.
And `savePendingLines()` is:

```ts
for (const line of this.Lines.Items) {
    const saved = await line.Save(options);
```

Inserts and updates, iterated off the SURVIVORS. It never asks the collection for its pending removals, so
a removed line is simply not in the loop and nothing deletes it.

### What this affects in sales, today

* **`DealWorkspaceComponent.RemoveLine()`** — the delete affordance on a deal line. It calls
  `Lines.Remove(line)` and then saves, which is the correct API. The line comes back on reload.
* **`save-deal.SD6`** asserts the defect rather than the requirement, on the CD7 pattern: **when orders
  fixes this, SD6 starts failing, and that failure is the signal to invert it back.** Read SD6's own
  comment before "fixing" it.
* **`save-deal.SD14`** lost its repositioning half. A clean row whose `LineNumber` changes because a
  neighbour was removed cannot be demonstrated while removal does not happen.

### The fix, and where it must happen — written for whoever picks it up in orders

In **bizapps-orders**, not here. Sales could delete the line row itself and that is deliberately NOT
done: it would put a second app in charge of deleting orders' rows, and orders freezes a booked line
with trigger 51003 for reasons sales does not model. `DECISIONS-NEEDED.md` DN-6 is the decision.

**The two lines responsible**, both in `packages/CoreEntitiesServer/src/OrderEntityServer.ts`:

1. `super.Save({ ...options, SkipRelatedCollections: true })` — correct, and the comment above it
   explains why: lines must not insert before they are expanded, priced, discounted, charged and taxed.
   Keep it. It means MJ never processes the collection, so the hand-rolled replacement owns every verb.
2. `savePendingLines()` — `for (const line of this.Lines.Items) { await line.Save(options); }`. Inserts
   and updates, iterated off the SURVIVORS. Nothing asks the collection for its pending removals.

**What a fix has to get right, and none of it is guesswork:**

* **Scope the delete to states where it is legal.** Trigger 51003 freezes a line on a Confirmed order,
  and because the CRUD procs run under INSERT-EXEC a trigger rollback raises *"Cannot use the ROLLBACK
  statement within an INSERT-EXEC statement"* — an error naming neither the line nor the rule. The
  existing comment in `prepareLines` says this in orders' own words. So: delete on `Draft`/`Quoted`,
  refuse with a real message afterwards.
* **Delete BEFORE the inserts and updates**, which is the ordering MJ's own plan uses and the reason
  `Deal.PaymentSchedule` re-sequences correctly: `LineNumber` is a `Sequence` field, and removing row 2
  of 3 has to renumber row 3 before or as part of the same write.
* **Do it inside the existing transaction**, alongside `persistPreparedLines`, so a failed delete rolls
  back with the header rather than leaving a half-emptied order.
* **Check `Lines.Dirty` still covers a pure removal.** `OrderEntityServer.Save()`'s ordinary-path
  shortcut is `if (!booking && !this.Lines.Dirty && this.IsSaved) return super.Save(options)`. Its
  comment claims `Dirty` "is true when a line was added, edited or removed". If a removal-only change
  leaves `Dirty` false, that shortcut swallows the delete a second time — and the fix passes its own
  test while the UI stays broken. **Verify that claim before trusting it.**

**The reproduction is already written and needs no orders-side setup:**

```bash
cd bizapps-sales && node test-harnesses/prove-line-removal.mjs
```

Six labelled cases, including the control that proves MJ's machinery works. `save-deal.SD6` is the
tripwire in the suite: **when this is fixed, SD6 starts failing**, and the three assertions to restore
are listed verbatim in its comment.

**One caveat found later, on 2026-08-20:** KI-22's second regeneration round showed `OrderHeader.Lines`
disappearing from the generated class, which means the `RelatedRecordCollection` metadata for it is
**absent on MJ_V6_Host**. The `dist` orders ships still declares the collection, so the harness result
above stands — but anyone reproducing this on a freshly-generated host should confirm the collection
exists before concluding anything about `savePendingLines()`.

### How to reproduce in thirty seconds

```bash
node test-harnesses/prove-line-removal.mjs      # needs orders linked and MJ_V6_Host seeded
```

It prints the matrix above and cleans up after itself.

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

## 🟢 KI-10 — RESOLVED: the orders chain assembles; app CodeGen must still exclude Sales

> **RESOLVED 2026-08-15, by building the thing rather than reasoning about it.** The two hazards below
> were written when Sales was the only app on the host, and the first of them turned out to be a
> statement about *that host*, not about orders. Both are kept, unedited, because the reasoning is still
> how you get from a Sales-only host to a working one — and because the CodeGen exclusion rule at the
> bottom is **not** resolved and never will be.
>
> ### What actually works
>
> A six-repo pnpm workspace at a common parent (`MJ`, `bizapps-common`, `bizapps-tasks`,
> `bizapps-accounting`, `bizapps-orders`, `bizapps-sales`), built with `mj dev workspace`, then migrated
> **in dependency order**:
>
> | Step | Schema | Applied |
> |---|---|---|
> | 1 | `__mj_BizAppsTasks` | 4 migrations |
> | 2 | `__mj_BizAppsAccounting` | 2 migrations |
> | 3 | `__mj_BizAppsOrders` | 9 migrations |
>
> The Msg 1767 failure below was never orders being unapplyable — it was orders applied to a host that
> had neither of the two schemas it points at. Supply them first and it just works.
>
> **CodeGen then registers the entity properly**, which hand-inserted metadata rows never did:
> `MJ_BizApps_Orders: Products` with 30 fields and a real generated `vwProducts`. With that in place,
> integration checks **PP1–PP4 pass 4/4** and the full sales suite stays green at **20/20** on the same
> host.
>
> ### Two things that will bite the next person
>
> 1. **The stand-in leaves a row behind that the schema drop does not take.** Tearing down the dev-only
>    `__mj_BizAppsOrders` stand-in drops its tables, views and FKs — but its `__mj.SchemaInfo` row
>    survives, and because the stand-in was transcribed verbatim it carries **orders' own hardcoded
>    UUID**. Orders' first migration then dies on a primary-key violation. Delete the `SchemaInfo` row
>    for the schema as part of any stand-in teardown.
> 2. **Orders' CodeGen exits non-zero on a clean run.** It fails to apply permissions for
>    `spCreateEventOrderLine` / `spUpdateEventOrderLine` — sprocs that do not exist because
>    `EventOrderLine` is an IsA child. Entity metadata is still written and post-CodeGen CRUD validation
>    still passes. Judge it on the entity rows, not the exit code.

## 🟠 KI-19 — The contract seam's END-TO-END path is unproven; the constraint it turns on is not

**The fix is in and its premise is PROVEN; only the seam round trip is not.** Read the scope note at
the bottom before treating this as an open correctness risk -- it is narrower than it first read.

**The bug.** `LiveContractsSeam` set both `CustomerOrganizationID` and
`CustomerPersonID`, and `CK_Contract_CustomerXor` requires exactly one:

```sql
CONSTRAINT CK_Contract_CustomerXor CHECK (
    (CASE WHEN CustomerOrganizationID IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN CustomerPersonID       IS NULL THEN 0 ELSE 1 END) = 1
)
```

`validate()` requires an `AccountID` on a won deal, so the organization side was always populated —
meaning **every B2B won deal with a primary contact produced a contract the database refused.** Only a
deal with no contact at all got through, which is exactly the shape the existing CT fixture used, which
is why it was invisible. Fixed by sending the contact as `PrimaryContactPersonID` (a real column on
`Contract`) and leaving `CustomerPersonID` null.

### Why it is unproven, and it is not the database's fault

Proving it needs contracts' `SaveContractOperation` to actually run — the seam dispatches
`Contracts.SaveContract` rather than saving entities itself. That needs **both** MJ new enough to build
this branch **and** the `bizapps-contracts` package loaded in-process. No stack has both:

| Stack | MJ supports the embed | `bizapps-contracts` |
|---|---|---|
| `/c/v6` — where this branch builds | yes (`next`, `0f2055fa`) | **absent** — never added as a workspace member |
| `/c/v6repro` — the only stack with contracts | **no** (`cbfc330c`, zero `DeclareEmbeddedRecord`) | present |

`MJ_V6_Repro` the *database* is fine — 10 contract tables, `PrimaryContactPersonID` present,
`CK_Contract_CustomerXor` present, and its core is now migrated current. Running the harness there gets
as far as `ContractsIsInstalled() === true` and then fails with
`Remote operation 'undefined' has no server implementation` — because the operation's server half lives
in a package this workspace does not have.

**Importing contracts across from `/c/v6repro` is not a shortcut**: it would resolve
`@memberjunction/*` from repro's older MJ and put two copies of MJ core in one process, which is the
single-copy rule in `docs/WORKSPACE-SETUP.md` and breaks `ClassFactory` and decorator identity.

### What closing the REMAINING gap costs (not blocking; the premise is proven)

Either **add `bizapps-contracts` to `/c/v6`** (clone, workspace member, install, build it against MJ
`next` — unproven, it carried a local conversion patch — then migrate its schema into `MJ_V6_Host` and
push its metadata), or **bring `/c/v6repro/MJ` up to `next`** (pull, install, full build including the
`ai-cerebras` and `actions-bizapps-formbuilders` breakage that needs `--noCheck` emits, then rebuild all
seven repro members). Both are substantial and both modify a shared stack.

### What IS verified — including the claim the fix turns on

**`CK_Contract_CustomerXor` was observed rejecting the old shape.** A CHECK constraint needs no MJ, no
contracts server half and no `Contracts.SaveContract` — so the missing stack does not stand in the way of
proving the premise. `test-harnesses/prove-customer-xor.mjs` inserts a minimal `Contract` row four ways
inside one transaction and rolls back, against real FK targets so a failure can only be the XOR:

| Row | Result |
|---|---|
| both columns set — **what the seam used to send** | **rejected**, by `CK_Contract_CustomerXor` by name |
| organization only — **what the fix now sends** | accepted |
| person only | accepted |
| neither | rejected — it is *exactly*-one, not at-most-one |

So the fix's correctness no longer rests on reading the constraint text. What remains unproven is only
the **round trip through the seam** — that `CreateContractFromDeal` composes a payload
`Contracts.SaveContract` accepts and that the contact lands in `PrimaryContactPersonID`.

### Also verified

The constraint text and the target column were read from contracts' own migration, the fix compiles, and
`test-harnesses/prove-contract-customer.mjs` is written and refuses to pass vacuously — it asserts the
contracts schema, the constraint's existence and `ContractsIsInstalled()` before it tests anything, and
exits non-zero if any is missing. It is ready to run the moment a stack can host it.

**Do not mark the CT bundle green on a host without contracts.** A skipped bundle is visually identical
to a passing one, and that shape has already burned this project four times.

---

## 🟠 KI-18 — CodeGen's remote-operation generation is not schema-scoped, so every app's file holds every app's operations

**The sibling of KI-10, and the one `excludeSchemas` cannot fix.** KI-10's rule is that an app's CodeGen
must exclude its siblings' schemas so it never emits their entities. That rule works, and sales' list is
complete. It has no effect here, because **remote operations are not generated from schemas at all.**

`runCodeGen.ts` selects them with an unfiltered view over the metadata table:

```ts
const remoteOpsResult = await new MJ.RunView().RunView<MJRemoteOperationEntity>(
  { EntityName: 'MJ: Remote Operations', ResultType: 'entity_object' },
  currentUser,
);
```

and the generator then emits **every row whose `Status` is `Active`**. There is no schema filter, no
exclusion hook and no config knob. So on a database hosting several Open Apps, each app's
`remote_operations.ts` contains the union of all their operations.

### What it actually costs

**Churn and size, not correctness.** Sales' committed file already carries eight prefixes — `AISkill.`,
`PredictiveStudio.`, `RecordComparison.`, `RecordProcess.`, `Sales.`, `TaskGraph.`, `Template.`,
`Workflow.` — because MJ core's own operations were always in scope. Generating on the shared v6 host
simply extends that to orders' (`OrdersPriceOrder`, `OrdersAdvanceOrderState`, …), about **+1,385 lines**.

It does **not** shadow anyone's implementation, which was the first thing to check. The generated classes
are **shells**: the file's own header says a hand-authored server subclass, registered via
`@RegisterClass`, supplies the `InternalExecute` body. The generated shells carry no `@RegisterClass` of
their own, so a sales-side copy of `Orders.PriceOrder` cannot win a ClassFactory key from orders' real
implementation.

### The ruling

**The host is canonical.** Sales' generated code is produced against `MJ_V6_Host`, because that is the
only database where the Deal → Order embed can resolve `RelatedEntityID` to a real `OrderHeader` entity.
Accept the wider `remote_operations.ts` that follows; do not revert it after each run and do not chase a
sales-only database to keep the file narrow — that would trade a correctness property for a cosmetic one.

### What would fix it upstream

A scope filter on that `RunView` — by operation-key prefix, by owning schema, or by the app manifest — so
an app emits only the operations it owns. That is an MJ CodeGen change and belongs with the
`entityPackageName` question in the same conversation, since both are about an app knowing which artifacts
are its own.

---
## 🟠 KI-10 (as originally recorded) — The shared v6 host cannot hold orders' schema, and app CodeGen must exclude Sales

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

---

## 🟡 KI-11 — Standing up the full revenue stack: what has to be TRUE, not just migrated

**Migrating the schemas is the easy half.** A won deal that becomes a booked order crosses four apps, and
each one refuses at a different layer with a message that names its own layer and not the missing data.
This is the list, in the order the failures arrive, so the next person can seed forward instead of
diagnosing backward.

Every item below was hit for real getting `close-won-handoff` to 4/4.

### The six data layers, in failure order

| # | Missing | How it presents |
|---|---|---|
| 1 | `ProductPrice` rules | *"cannot be priced: no price rule was found for this product, and no UnitPrice was supplied"* — orders correctly refuses to invent a price |
| 2 | `GLAccountRole` rows | push accounting's `metadata/gl-account-roles` |
| 3 | `GLAccount` + `GLAccountLink` at COMPANY level | *"No GL account is linked for role 'Accounts Receivable'"* — the resolver walks product → category → type → **company default**, and the company default is where the walk ends |
| 4 | Journal-entry types (`OrderBooking`) | *"journal-entry type 'OrderBooking' does not exist — its owning app must seed it first"*; push **orders'** `metadata/journal-entry-types` |
| 5 | `JournalEntrySequence` per company × fiscal year | *"EntryNumber assignment failed"* |
| 6 | `AccountingCompanyProfile` | *"the company must be accounting-enabled before JEs can be numbered"*. It is an **IsA child of `__mj.Company`, so `ID = Company.ID`** — not a new key. Needs `FunctionalCurrencyCode` to exist, so push accounting's `metadata/currencies` first |

`sync push` discovers entity directories **beneath** `--dir`, so pointing it at a leaf (`metadata/gl-account-roles`)
fails with *"No entity directories found"*. Assemble a temporary parent holding the dirs you want and point
at that — it keeps the blast radius small on a shared host.

### Re-run CodeGen for entities with IsA children

Orders' first CodeGen died at its permissions step (see KI-10) and left **`vwOrderLines` at 41 columns
against 39 registered `EntityField` rows** — KI-7's signature, on the entity that has an IsA child
(`EventOrderLine`). The symptom is far from the cause: *"Column name or number of supplied values does not
match table definition"* on `spCreateOrderLine`, because `SQLServerDataProvider` builds its `@ResultTable`
from entity metadata.

A second run reconciled it to 41 = 41. **Verify with a column diff, not by trusting the exit code** — and
snapshot the other apps' entities before and after, which is how we know Sales stayed byte-identical
(`fcda8cb8…`) across both runs.

### Load ACCOUNTING BEFORE ORDERS

Orders books through accounting's engine, and that engine serves `GLAccountLinks` from a cache it fills on
load. Without accounting loaded, every booking reports *"No GL account is linked"* **while the links sit
visibly in the table** — the resolver is reading an empty cache, not an empty database, and the message
cannot tell you which.

Two related traps in the same loader:
- Sibling packages are **not resolvable by name** from another repo. pnpm gives a repo no `node_modules`
  entry for a package it does not depend on, and the cross-repo workspace does not hoist `@mj-biz-apps/*`
  either. Resolve by scanning sibling repos for a `package.json` carrying the name.
- **Do not call every exported `Load*`.** Orders exports `LoadPaymentProviderConfig`, which is a real
  configuration loader that THROWS when no provider is configured — it takes the run down before a single
  check executes. Call named anchors only, and never swallow a load failure: a sibling that is present but
  fails to load must not read as "not installed".

### Test fixtures written for a stub do not survive the downstream going live

`close-deal` seeded lines with `ProductName` only, which was right when `DealLine.ProductID` was null
everywhere. On a host with orders installed the handoff is live and the same seed produces a line orders
cannot price.

**The visible error names the wrong thing, so the chain is worth knowing.** The absent `ProductID` is an
empty **string**, not null — so it passes the not-null check and reaches orders' price lookup as `ID = ''`
against a `uniqueidentifier` column, which is a SQL conversion error. Orders handles that correctly: it
catches, rolls back its own savepoint, and returns false carrying the real message. The
**`FK_DealStageEvent_Deal` conflict that follows is the CALLER continuing to write after a save had already
failed** — not a broken or out-of-band transaction.

Worth stating plainly because the first reading of this was wrong: **orders keeps the work inside the
caller's transaction by design.** It uses `this.ProviderToUse` throughout pricing and booking precisely so
that a fresh `Metadata` cannot open a second connection and break atomicity. The lookup runs as a nested
savepoint, not out of band.

Fixtures now attach a real `ProductID` when orders is installed. The fix belongs in the test input, not in
orders.

Likewise, a check ABOUT stub behaviour must pin the stub (`SetDownstreamSeam`) rather than assume one, and
restore with `ResetDownstreamSeam()` — `SetDownstreamSeam` latches, so restoring the old value alone leaves
every later check in the process pinned to it.

---

## 🟠 KI-12 — The Explorer harness runs against MJ core's shell now, and its timeouts predate that

**Specs 10, 20 and 30 fail on time, not on behaviour.** Every assertion they reach passes; they run out of
budget partway through.

### The measurements

| | Historical | 2026-08-16 |
|---|---|---|
| `10-deal-crud` | ~200s (the config raised its budget to 480s to fit it) | **exceeds 480s in step 1 of 7** |
| `00-recon` | seconds | **6.9 minutes** (passes) |
| `20-demo-tour` | — | times out on its FIRST `waitForURL`, 60s |
| `30-demo-setup-columns` | — | exceeds its 600s budget |

Spec 10's last artifact is `13-pipeline-saved.png`: it completed **create a Pipeline** and nothing else.
Steps 2–7 — create the Deal, read it back, update, grid check, delete both — never ran.

### Why

`b98603f` retired `apps/` — "Sales runs inside an MJ host, not its own shell". The harness's timeouts were
calibrated against **this app's own lightweight Explorer**. Port 4341 is now served by
`C:\v6\MJ\packages\MJExplorer` under `ng serve` — MJ core's full Explorer, in unoptimised dev mode. Every
navigation costs several times what it used to, and the budgets were never revisited.

**It is not the servers.** Both answer in milliseconds (`4341` 200 in 0.21s, `4141` 401 in 0.002s). The
cost is entirely in the browser rendering a much larger Angular app.

**It is not restored tabs**, though those made it worse and are worth clearing: `__mj.UserRecordLog` holds
only 3 rows, yet a run accumulated **12 open tabs**, each keeping a full form live in the DOM. Spec 10 now
closes them before starting.

### What was actually fixed

Two real bugs, both found once auth was restored:

1. **`formField` matched hidden forms.** MJ's shell keeps every open tab's form in the DOM and merely
   hides the inactive ones, so `.first()` could resolve the *Deals* form's `Name` input while the
   *Pipelines* form was on screen. The failure read `field "Name" must be editable … Received: hidden`,
   which sounds like a disabled field and was a locator pointing at another form. Now filtered to
   `visible=true`.
2. **A stale session made re-login impossible** — see the harness config; `PW_FORCE_LOGIN=1` is the way out.

`00-recon` passes with both fixes in place, which is the evidence that the *navigation still works*.

### What is NOT decided

Whether to raise the budgets (recon at 6.9 minutes implies 15+ minutes per spec, so a five-spec suite runs
over an hour), speed the shell up, or point the harness at a lighter host. **That is a judgement call and
has deliberately not been made here** — inflating the timeouts would turn a measured regression into a
silent cost, and the numbers above are the input to that decision.

---

## 🟠 KI-13 — bizapps-contracts cannot be installed on a fresh database

**Found while proving the close-won contract seam end to end. Not caused by the pnpm/v6 conversion — it
fails identically on npm/v5.** Recorded here because Sales' contract path cannot be demonstrated on any
new environment until it is fixed upstream, and because the failure disguises itself twice.

### The defect

Contracts' baseline hardcodes **other apps'** entity UUIDs in `EntityField.RelatedEntityID`. Orders and
accounting mint their entity IDs per database, so the baseline only applies to the machine its CodeGen
ran on. Six cross-app references are affected:

| Field | Must point at |
|---|---|
| `ProductID` | `MJ_BizApps_Orders: Products` |
| `SubscriptionTypeID` | `MJ_BizApps_Orders: Subscription Types` |
| `PaymentTermsTypeID` | `MJ_BizApps_Orders: Payment Terms Types` |
| `SubscriptionID` | `MJ_BizApps_Orders: Subscriptions` |
| `OrderID` | `MJ_BizApps_Orders: Order Headers` |
| `CurrencyID` | `MJ_BizApps_Accounting: Currencies` |

**Upstream fix:** resolve these by NAME at migration time rather than baking a UUID.

### Why it is hard to recognise

1. **The first error names the wrong table.** Flyway rolls the migration back and reports
   `FK_EntityRelationship_EntityID`. The true first failure is `FK_EntityField_RelatedEntity`, and it
   only appears if you render the baseline and apply it outside a transaction.
2. **Three of the six fail SILENTLY.** The migration "succeeds" while `Contract Terms`, `Contract Lines`
   and `Contract Billing Events` are each one field short. Per KI-7 that mismatch breaks every insert
   through the CRUD sprocs — so contracts looks installed and is not.

**Always column-diff after installing contracts**: registered `EntityField` count vs `INFORMATION_SCHEMA`
column count, per entity. All ten must match.

### Local workaround

`C:\v6\contracts-baseline-portability-fixup.mjs` resolves all six by name against the live database and
rewrites the rendered baseline. It refuses to run against anything but the isolated DB, and is
**deliberately not part of the contracts conversion patch**, which stays a clean reviewable PR.

## 🟢 Contracts' minimum bootstrap — what a contract needs before it can be created

Discovered the way KI-11's six layers were: in the order the failures arrive. Each is a hard stop.

| # | Requirement | How it presents |
|---|---|---|
| 1 | Contracts' `metadata` pushed | 6 `ContractType` rows; without them no type code resolves |
| 2 | `Contract.Status` from its own vocabulary | `CK_Contract_Status` — Draft / PendingSignature / Active / Expired / Terminated / Superseded. **`Pending` is a TERM status, not a contract one** |
| 3 | `ContractTerm.CommittedAmount` NOT NULL | *"State the amount committed for this term. Zero is a valid answer; blank is not."* It is a **negotiated commitment**, not a computed price |
| 4 | `ContractLine.LineType` NOT NULL | `Minimum` / `Usage` / `Milestone` / `OneTime` / `Subscription`; choosing `Subscription` additionally requires `SubscriptionTypeID` |

### One trap worth more than the rest

**`RemoteOpResult.Success` means the operation RAN, not that it worked.** Contracts' operations carry
their own `Success` + `Message` inside the payload:

```
{ Success: true, Output: { Success: false, Message: "Could not save contract: …" } }
```

Sales' first seam checked only the envelope and returned `Success: true` with a null `ContractID` for a
contract that was never written — a routing result claiming `Executed` for nothing. Any caller of a
bizapps remote operation must check **both**.

---

## 🟢 KI-14 — A deal line with a free-text product used to fail close-won and leave the deal Won

**TRIGGER CLOSED (PR #22).** A close-won that would send a line with no catalogue product now **refuses
before it starts**, naming the line, and the deal stays **Open**. Kept here because the shape is
legitimate, the HubSpot cutover produces it in volume, and the *broader* failure mode this exposed is
still open — see the last section.

### What used to happen

A `DealLine` carrying a `ProductName` string with **`ProductID` NULL** could not be closed. Worse than a
refusal: the close reported failure but the deal was **already marked Won**, so the roster was left in a
state no order or contract backed.

Both builders coerce the same way:

```ts
ProductID: String(l.ProductID ?? ''),
```

so a NULL became the **empty string**. Orders' `OrderLine` and contracts' `ContractLine` both type
`ProductID` as a `uniqueidentifier`, and `''` is not a null — it is a value that fails conversion. The
failure happened *inside* the sibling's save, which rolled back its savepoint and returned false; the
enclosing close transaction was already torn down by then. The observed symptom on a demo host was
`No active transaction to commit`, which names nothing useful and reads like a transaction-management bug
rather than a data problem. Same empty-GUID mechanism as KI-11, reached by a different route.

**Both routes were affected**, which the first fix got wrong. An earlier note here claimed only one-time
lines could trigger it because a recurring line "routes to a contract and does not hit this path" — that
was false. `LiveContractsSeam` uses the identical coercion, so a recurring line with no product failed
identically and left the deal **Won with no contract**. An audit caught it after the one-time half had
already been fixed.

### What the fix is

`CloseDealOperation.unroutablePlannedLines` mirrors both builders rather than one:

| Route | Lines inspected | Gate |
|---|---|---|
| Order | one-time | `Planned` && `OneTimeLinesTo === 'Order'` && `OrdersIsInstalled()` |
| Contract | recurring | `Planned` && `SubscriptionLinesTo === 'Contract'` && `ContractsIsInstalled()` |

It reuses the same recurrence split the routing uses, so there is no second notion of which lines go
where. Blank counts as unroutable alongside null, because the coercion makes an empty-string column
indistinguishable from a NULL by the time it reaches the sibling.

Each route is gated on **its own** app being installed. A route whose downstream is absent still reaches
its stub and refuses harmlessly — that is what keeps a lined deal closeable on a standalone host, and
what CD7 pins. Refusing there instead would have broken every sales-only deployment.

**PreviewOnly is affected on purpose.** The guard runs before the preview returns, so previewing a deal
that cannot close reports the refusal rather than a clean routing plan. Nothing is written either way.

Pinned by **CW5/CW6** (order route) and **CT5/CT6** (contract route) — a refusal check plus a control in
each pair, since a guard that fired on every deal would make the refusal checks pass while breaking the
close outright. They live in `close-won-handoff` and `close-won-contract` rather than the default gate,
because each refusal only fires when its downstream is **live**.

### Where this shape comes from — and why it is not hypothetical

Any line captured before the product picker existed. In this repo that was every seeded line, because
`DealLine.ProductID` is a **soft reference** and `ProductName` is transcription: a deal is meant to remain
readable on a host where orders was never installed. `scripts/seed-demo-data.sh` resolves catalogue IDs by
company so the seeded roster is safe, but the shape is legitimate and will recur.

**The migration implication is the real one. Deals imported from HubSpot will have exactly this shape**
(tracker **#60**) — a product *name* from HubSpot's line items and no MemberJunction catalogue ID. Those
deals are now **refused legibly** instead of corrupting a close, which is the right failure but still a
failure: the importer has to resolve what it can.

Two halves, and they are not equivalent:

1. **The importer resolves products to catalogue IDs.** Correct where a confident match exists, but names
   are not unique and `SKU`'s unique index is filtered (`WHERE SKU IS NOT NULL`), so matching is a
   *suggestion a human confirms*, never an identity mechanism — see `product-filter.ts`. Some rows will
   have no match at all.
2. **The close refuses the rest up front.** ✅ Done — this is PR #22.

Half 1 is still owed, and belongs with the importer (S6).

### Still open: the general case

**The trigger is closed; the class is not.** This bug was one *reachable* way for a close to fail
downstream after the status had been written. Any other error inside an installed sibling's save can still
land the same way — deal Won, nothing downstream, and an error that names the transaction rather than the
cause.

Fixing that means changing what happens when an installed downstream errors, which interacts with routing
and **waits for Andrew's end-to-end design doc**. Deliberately out of scope for PR #22, which closed the
one trigger we could reach without touching those semantics.

---

## 🟢 KI-15 — The deal number is not surfaced in the workspace after a save

**Found while dry-running the demo script.** Saving a deal reports `Deal created.` and clears the
`Unsaved` chip, and that is all. `DealNumber` is minted by the server and is genuinely on the record —
but the workspace template never renders it. It appears only in the roster
(`sales-section.component.html`, the `num-chip` beside the deal name), so the only way to see the
number of a deal you just created is to leave the workspace and open **All deals**.

**Expected, not a bug — do not file it.** Nothing is lost and nothing is wrong; the number simply has
no home on that surface yet. It matters because it reads as a failure: a demo or a tester waits for a
number to appear, and waits.

The fix is a one-line addition to the customer-context band, where the pipeline and deal-type chips
already live. Left alone here because that band is chrome the UX rework owns, and a number added to it
should be designed with the rest of the chips rather than wedged in.

---

## 🟢 KI-16 — The dashboard does not re-query when you navigate back to it

Its tiles and its "Closing soonest" card are loaded once and cached. Close a deal in the workspace,
click **Dashboard**, and the tiles still show the pre-close numbers — an open deal that is now won, a
pipeline total that no longer includes it. Nothing indicates the figures are stale.

**Press the refresh button (top right) and it corrects instantly.** That is the whole workaround, and
it is why the button exists.

**Expected, not a bug — do not file it.** The dashboard is a snapshot, not a live view, and the numbers
are right for the moment they were read. But a tester who closes a deal and checks the dashboard will
reasonably conclude the close did not count, which is the same false-negative shape as the close gap
itself (the close DID happen; only the reading is old).

Two ways it could be fixed and they are not equivalent: re-query on navigation (simple, and costs a
round trip every time the section is entered), or invalidate the cached figures when a close or save
succeeds (precise, and needs the dashboard to learn about events it currently does not observe). The
second is the better shape and the reason this is recorded rather than patched.

---

## 🟢 KI-17 — ClassFactory falls back to `_BaseEntity` for ANY of bizapps-common's entities

Clicking a customer name opens the account as its own Explorer record tab, and it renders correctly.
It also writes a warning to the browser console:

```
ClassFactory: no registration found for base class '_BaseEntity' with key
'MJ_BizApps_Common: Organizations'. … Falling back to an instance of '_BaseEntity' itself.
```

**IT IS THE WHOLE FAMILY, NOT ONE ENTITY.** Recorded first for `Organizations` because that is where it
was noticed, and the title said so for a while — which was a trap: a later reader met the same warning
naming `MJ_BizApps_Common: Addresses` (server-side, from a harness) and had to decide whether it was new.
It is not. **Any** entity in `__mj_BizAppsCommon` hits this, because the cause is that none of common's
subclasses are registered in the consuming process — not anything specific to one table. Observed so far
for `Organizations` (Explorer, opening a Sales Account) and `Addresses` (node harness); expect it for
`People`, `ContactMethods` and the rest on whatever surface reaches them first.

**Why.** `SalesAccount` is an IsA child of common's `Organization`, so loading one asks the ClassFactory
for the PARENT entity class. Sales' own subclasses are registered in the Explorer; **bizapps-common's are
not** — nothing loads them client-side — so the parent resolves to bare `_BaseEntity`. The registered-key
list in the warning is every sales and MJ-core entity and no common ones, which is the tell.

**Expected, not a bug — do not file it.** `RequiresSubclass` is false on that base, so the fallback is
legal and the record opens with its fields intact. Nothing is lost.

It is still worth recording because it is **console noise on a click a demo makes**, and the warning is
long enough to bury a real error underneath it.

**It does NOT currently trip the Explorer harness, and that was measured rather than assumed.** It is
logged at WARNING level, and `captureConsoleErrors` wires only `console.error` and `pageerror` — so the
sink never sees it and the specs that click a customer pass with no allowlist. If that sink is ever
widened to warnings, this becomes the first thing it catches, and `expectOnlyKnownErrors` takes an
`allowed` list for exactly that case.

The fix belongs upstream of sales: load bizapps-common's generated entity subclasses in the host's
client bootstrap, the same way sales' are. Recorded here rather than worked around, because the
workaround (registering common's classes from sales) would be sales reaching into another app's
responsibility.
