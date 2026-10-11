# Known issues — bizapps-sales

Known issues and standing rules for this app. Open defects are tracked as GitHub issues in the repo that
owns the fix. This file keeps their status, the rules a developer needs, and one line for each resolved
entry, because code and docs cite these IDs.

Statuses checked on 2026-10-11 against `next` here and in the sibling repos.

## Status

| ID | Summary | Status | Owner | GitHub issue |
|---|---|---|---|---|
| KI-1 | `AllowMultipleSubtypes` was false on common's `Person` and `Organization`, so a second app extending either would mis-chain | Resolved: common's `V202608061617__v5.33.x__Deprecate_Person_LinkedUserID.sql` sets it on both (bizapps-common `dc83b8d`), and sales requires common 5.49 or later. Decision record: [`DECISIONS.md`](./DECISIONS.md) D1 | bizapps-common | — |
| KI-2 | Orders' `rebuild-db.sh` substituted `__mj` for common's schema placeholder | Resolved: it substitutes `__mj_BizAppsCommon` and stops on a failed batch (bizapps-orders `389a381`) | bizapps-orders | — |
| KI-3 | CodeGen skips AI enrichment when no AI credentials are configured | Superseded: without an AI key CodeGen drops AI-written output, including `Validate*()` methods, so set one before running it (`CLAUDE.md`, "CodeGen output must be reproducible from this repo") | sales | — |
| KI-4 | Sales had no hand-authored Application | Resolved: the Sales application ships in `metadata/applications` (`9cbd3e1`) | sales | — |
| KI-5 | Deleting a record whose tab is open logs `Error in BaseEntity.Load` | Open, [below](#ki-5--deleting-a-record-whose-tab-is-open-logs-a-load-error) | MJ | none |
| KI-6 | `CK_DealStatusType_NotWonAndLost` does not survive the PostgreSQL conversion | Open, [below](#ki-6--one-check-constraint-does-not-survive-the-postgresql-conversion) | sales | #197 |
| KI-7 | CodeGen registers a new view column one pass late | Standing rule, [below](#ki-7--run-codegen-until-it-reports-success-true-and-every-entitys-fields-match-its-view) | sales | — |
| KI-8 | FKs to IsA child entities had no name column on `vwDeals` | Resolved: `Deals` carries `Account`, `PrimaryContact` and `BillingContact` (`ad9191c`) | sales | — |
| KI-9 | Stage-event stamping would be lost or doubled when the board and close branches converged | Resolved: the append lives in `DealEntityServer.saveWithinScope` (`15836d2`), and BD1 and CD4 assert exactly one event per transition | sales | — |
| KI-10 | Orders could not be applied to a sales-only host, and an app's CodeGen could regenerate another app's entities | Resolved: tasks, accounting and orders migrate before sales (`WORKSPACE-SETUP.md` §4), and `includeSchemas` limits each app's CodeGen to its own schema (`e735297` here; orders and common do the same) | sales | — |
| KI-11 | What a host needs seeded before a won deal books an order | Standing rule, [below](#ki-11--what-a-host-needs-seeded-before-a-won-deal-books-an-order) | sales | — |
| KI-12 | Explorer harness specs ran out of time against MJ's full Explorer | No longer reproduces: the whole suite ran in 34 minutes at one worker on 2026-10-01 (`0c75922`); in August `00-recon` alone took 6.9 minutes | sales | — |
| KI-13 | Contracts' baseline hardcoded other apps' entity IDs and did not install on a fresh database | Resolved: contracts' v2 baseline references no orders, accounting or tasks object (bizapps-contracts `875d1ba`), and contracts 0.7.x installed on fresh hosts with its checks passing (#161) | bizapps-contracts | — |
| KI-14 | A deal line with no catalogue product failed close-won and left the deal Won | Resolved: unreachable since lines moved to the embedded order, where `OrderLine.ProductID` is `NOT NULL` (`2700ae0`); the close runs in one transaction | sales | — |
| KI-15 | The deal number did not show in the workspace after a save | Resolved: the Deal form's header shows it (`9d6ef9e`), and the workspace is no longer mounted | sales | — |
| KI-16 | The dashboard does not re-query when you navigate back to it | By design, [below](#ki-16--the-dashboard-does-not-re-query-when-you-navigate-back-to-it) | sales | — |
| KI-17 | ClassFactory falls back to `_BaseEntity` for common's entities in Explorer | By design, [below](#ki-17--classfactory-falls-back-to-_baseentity-for-commons-entities) | host | — |
| KI-18 | CodeGen wrote every app's remote operations into each app's `remote_operations.ts` | Resolved upstream: MJ scopes them to `includeSchemas` (MJ `c9de461`, on `lts/6.1`); sales' file holds only `Sales.*` | MJ | — |
| KI-19 | The contract seam's end-to-end path was unproven | Resolved: the seam writes contracts v2, which has no `CustomerPersonID` and no customer XOR constraint (`2911632`), and the `close-won-contract` bundle passed on fresh hosts with contracts (#161) | sales | — |
| KI-20 | Removing an order line failed the whole save | Resolved in orders (bc-aidp-next-golive#187), and SD6 asserts the fix (`58585c8`). Decision record: `DECISIONS-NEEDED.md` DN-6 | bizapps-orders | bc-aidp-next-golive#187 |
| KI-21 | A host running Sales must also register orders' server package | Standing rule, [below](#ki-21--a-host-running-sales-must-also-register-orders-server-package) | host | — |
| KI-22 | No deal with an order could be read over GraphQL (first recorded as orders' generated resolvers trailing the database) | Resolved: orders pushes `query-categories` before `queries` (bizapps-orders `406bcaa`), and MJ CodeGen imports peer entity classes through `entityImportPackages` (MJ `f23fc12`, 6.1.0-edge.4). Decision records: `DECISIONS-NEEDED.md` DN-8, DN-14 | bizapps-orders, MJ | — |
| KI-23 | `spCreateOrganization` and `spUpdateOrganization` were missing | Not a defect: one host had lost two procedures that common's migrations create (`V202608132239__v5.34.x__Layered_Base_Views_Metadata.sql`); repaired on that host (`1bad97f`) | — | — |
| KI-24 | `rebuild-db.sh` could not build a database the sales baseline applies to | Resolved: it migrates common, tasks, accounting and orders first (`6b39252`), and editing the baseline in place ended on 2026-09-18 | sales | — |
| KI-25 | `metadata/queries` failed to seed onto a fresh database | Resolved: MJ derives the query parameters (`c25bad3`) | sales | — |
| KI-26 | `mj sync push` after seeding empties every product picker | Standing rule, [below](#ki-26--mj-sync-push-after-seeding-empties-every-product-picker) | sales | — |
| KI-27 | Orders' lifecycle collapse would break CD24's `Posted` step | Resolved: CD24 asserts the collapse instead (`cf89281`) | sales | — |
| KI-28 | A fresh install registered 10 fewer orders fields than the views expose, so saves failed on a column-count mismatch | Resolved: orders folded the missing rows into migrations (bizapps-orders `2daf9b9`, `a389782`), and the drift query returned nothing on fresh hosts in October (#161). Metadata that CodeGen still adds on a first run: bizapps-orders#491 | bizapps-orders | bizapps-orders#491 |
| — | Contracts' minimum bootstrap | Obsolete: written for contracts v1 (`ContractTerm`, `ContractLine`), which v2 removed; `scripts/seed-demo-data.sh` seeds the contract template. Its remote-operation rule is [below](#remote-operations-report-success-twice) | — | — |

---

## Open

### KI-5 — Deleting a record whose tab is open logs a load error

After a delete through the UI, MJ Explorer re-loads the deleted record, from its open tab and from the
recent records it restores on entering the app, and logs
`Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=…)`. The delete itself succeeds. Seen on Deals
and Pipelines in 2026-08. It is MJ shell behaviour; the Explorer harness tolerates it only around delete
steps (`KNOWN_POST_DELETE_ERRORS` and `KNOWN_DEAD_RECORD_RESTORE_ERRORS` in
`test-harnesses/playwright/lib/explorer.ts`). Those deletes were soft deletes, so a test asserts that the
row left the grid, not the database.

### KI-6 — One CHECK constraint does not survive the PostgreSQL conversion

`CK_DealStatusType_NotWonAndLost` is `CHECK (NOT (IsWon = 1 AND IsLost = 1))`. Converted with
`mj sql-convert` in 2026-08, the `BIT` columns became `BOOLEAN` but `= 1` stayed, and PostgreSQL 16
refused it (`operator does not exist: boolean = integer`). No portable form exists: T-SQL refuses
arithmetic on `BIT`, and the converter quoted `CAST` and `AS` as identifiers in
`CAST(IsWon AS int) + CAST(IsLost AS int) <= 1`. So the PostgreSQL file needs one edit:

```sql
-- after conversion, replace:
CHECK (NOT ("IsWon" = 1 AND "IsLost" = 1))
-- with:
CHECK (NOT ("IsWon" AND "IsLost"))
```

Everything else in the baseline applied to PostgreSQL 16 in that run. `mj sql-convert` reported
`Errors: 0` on output PostgreSQL rejected, so prove a conversion by applying it. The keyword quoting was
filed as MJ#3857 (closed); whether the current converter rewrites this comparison has not been checked.
Producing the PostgreSQL migrations is #197.

## By design

### KI-16 — The dashboard does not re-query when you navigate back to it

Its tiles load once and are cached, so after a close the dashboard shows the pre-close figures until you
press its refresh button. Recorded as expected behaviour in 2026-08 and not re-checked since. Invalidating
the figures when a close or save succeeds would fix it without a round trip on every visit.

### KI-17 — ClassFactory falls back to `_BaseEntity` for common's entities

Opening a Sales Account in Explorer logs a console warning:

```
ClassFactory: no registration found for base class '_BaseEntity' with key
'MJ_BizApps_Common: Organizations'. … Falling back to an instance of '_BaseEntity' itself.
```

Any common entity can hit it, because nothing loads common's entity subclasses in the client. The record
opens correctly (`RequiresSubclass` is false), and the harness does not trip on it: it is a warning, and
`captureConsoleErrors` reads only errors. The fix belongs in the host's client bootstrap. Recorded in
2026-08 and not re-checked since.

## Standing rules

### KI-7 — Run CodeGen until it reports `success: true` and every entity's fields match its view

CodeGen creates `EntityField` rows from the columns a view already has. On the pass that adds a column to
a view (a new FK name column, an IsA-derived lookup), the column is not registered yet; the next pass
registers it. Measured when Sales Contacts gained a name field (`ad9191c`):

| | Deals (fields / view columns) | Deal Contact Roles | CodeGen reported |
|---|---|---|---|
| after pass 1 | 59 / 61 | 10 / 11 | `success: false` |
| after pass 2 | 61 / 61 | 11 / 11 | `success: true` |

Until that next pass, every save of the entity fails with *"Column name or number of supplied values does
not match table definition"*: the provider declares `@ResultTable` with one column per `EntityField` and
fills it positionally from `sp<Create|Update>`, which returns the view's columns. Nothing in the message
points at CodeGen.

This entry used to say that a second full pass corrupts the database. That read the same lag backwards:
in the first incident, a pass added an `Account` column to `vwDeals` and left its `EntityField` row to a
pass that never ran.

So run CodeGen until it reports `success: true`, then check parity; every row must match:

```sql
SELECT e.Name, e.BaseView,
  (SELECT COUNT(*) FROM __mj.EntityField f WHERE f.EntityID = e.ID) AS Fields,
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_SCHEMA = e.SchemaName AND c.TABLE_NAME = e.BaseView) AS ViewCols
FROM __mj.Entity e WHERE e.SchemaName = '__mj_BizAppsSales';
```

A `success: false` that names one entity says nothing about the others: the failing pass above named
`Deal Contact Roles`, not `Deals`. Back up the database first, because `git checkout` does not undo what a
pass writes there. Why CodeGen is not the tool for a one-column metadata gap is in
`docs/CODEGEN-PARTIAL-RUNS.md`.

### KI-11 — What a host needs seeded before a won deal books an order

A close-won order crosses four apps, and each refuses at its own layer with a message that names the layer
rather than the missing data. `scripts/dev/seed-revenue-stack.sql` seeds all six layers and stops with a
message if a metadata push it needs has not run; `scripts/seed-demo-data.sh` runs it. In the order the
failures arrive:

| # | Missing | How it presents |
|---|---|---|
| 1 | `ProductPrice` rules | *"cannot be priced: no price rule was found for this product, and no UnitPrice was supplied"* — orders correctly refuses to invent a price |
| 2 | `GLAccountRole` rows | push accounting's `metadata/gl-account-roles` |
| 3 | `GLAccount` + `GLAccountLink` at COMPANY level | *"No GL account is linked for role 'Accounts Receivable'"* — the resolver walks product → category → type → **company default**, and the company default is where the walk ends |
| 4 | Journal-entry types (`OrderBooking`) | *"journal-entry type 'OrderBooking' does not exist — its owning app must seed it first"*; push **orders'** `metadata/journal-entry-types` |
| 5 | `JournalEntrySequence` per company × fiscal year | *"EntryNumber assignment failed"* |
| 6 | `AccountingCompanyProfile` | *"the company must be accounting-enabled before JEs can be numbered"*. It is an **IsA child of `__mj.Company`, so `ID = Company.ID`** — not a new key. Needs `FunctionalCurrencyCode` to exist, so push accounting's `metadata/currencies` first |

The loader traps on the same path (load accounting before orders, resolve siblings by path, call named
`Load*` anchors only) are in `WORKSPACE-SETUP.md` §7, and pushing a subset of metadata directories is in
§5.

A check about stub behaviour must pin the stub with `SetDownstreamSeam` and restore it with
`ResetDownstreamSeam()`. `SetDownstreamSeam` latches, so restoring the old value leaves every later check
in the process pinned.

### KI-21 — A host running Sales must also register orders' server package

A resolver enters MJAPI's GraphQL schema only when its package is listed in `mj.config.cjs` →
`dynamicPackages.server[]`, which `mj app install` writes. Importing a package registers its entity
classes, not its resolvers. A host that migrated orders' schema without installing orders as an Open App
cannot open any deal that has an order, and the error names a field:

```
Error: Cannot query field "mjBizAppsOrdersOrderHeader" on type "Query".
```

The integration suite runs in process, so it passes on such a host. Register orders with `mj app install`,
or by hand, with the names from orders' `mj-app.json`:

```js
dynamicPackages: {
  server: [
    { PackageName: '@mj-biz-apps/sales-server',  StartupExport: 'LoadBizAppsSalesServer',  AppName: 'mj-bizapps-sales',  Enabled: true },
    { PackageName: '@mj-biz-apps/orders-server', StartupExport: 'LoadBizAppsOrdersServer', AppName: 'mj-bizapps-orders', Enabled: true },
  ],
}
```

Before calling a deployment done, check that `grep -A3 'dynamicPackages' mj.config.cjs` lists
`orders-server`, or that MJAPI's startup log shows
`Loaded Open App server package: @mj-biz-apps/orders-server`.

### KI-26 — `mj sync push` after seeding empties every product picker

`metadata/pipelines/.sales-pipelines.json` puts both pipelines on Default Company, the only company on a
fresh database. `scripts/seed-demo-data.sh` then moves them to the demo companies, which own the products.
A push after the seed moves them back to Default Company, which owns no products, so every product picker
is empty and the errors name the orders catalogue:

```
Error: the product picker offered nothing -- the orders catalogue did not load
```

Push metadata first and seed after (`WORKSPACE-SETUP.md` §5). If you push later, for example to restore an
action or a remote operation, re-run `scripts/seed-demo-data.sh`; it is idempotent. The metadata cannot
name the demo companies, because they come from `scripts/seed-dev-data.sh`, which is local dev data and not
part of the app.

### Remote operations report success twice

Found on the contracts seam: a BizApps remote operation's envelope `Success` means the operation ran.
Whether it did its job is the `Success` inside `Output`, which carries its own `Message`:

```
{ Success: true, Output: { Success: false, Message: "Could not save contract: …" } }
```

Check both.
