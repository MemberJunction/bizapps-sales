# Known issues — bizapps-sales

Live risks that are **not** bugs in this repo and cannot be fixed from here. Each one is something a
future developer will otherwise rediscover the hard way.

---

## 🔴 KI-28 — a fresh install registers 10 fewer FIELDS than the views expose, and 4 are on entities we write

**Measured 2026-08-25 on `MJ_Sales_Latest`, a fresh database built from every sibling at `origin/next`
following `WORKSPACE-SETUP.md` exactly. This is what QA will do, so this is what QA will hit.**

**This is not a design difference and nothing about it is exotic — it is a lapsed append, and we have
had the identical one ourselves.** Every BizApps app bakes CodeGen's output into its versioned migrations.
Counting `INSERT … EntityField` lines in `V*.sql`: **orders 990**, sales 343, common 63, tasks 26. Orders
ships *more* of it than we do.

The 990 are almost entirely one file — orders' baseline
`V202607061432__v0.1.x__Tables_and_Objects.sql` carries **989**. Since then **seven migrations added
columns and shipped none**:

```
V202608091500  Retire_draft_operations
V202608101200  Pricing_driver_class
V202608131541  OrderHeaders_layered_inner_view
V202608141400  EventOrderLine_Person
V202608141500  EventOrderLine_Organizer_Notes
V202608141800  Product_MaxQuantityPerLine
V202608182055  Cleanup_Product_Successor_Hierarchy_Fields
```

(plus three more on `origin/next` — `Checkout_Widget_And_Sessions`, `ProductType_Configuration`,
`OrderHeader_Status_And_Fulfillment` — which is where the remaining missing fields come from.)

`V202608101200`'s header says *"registering them as `EntityField` rows is CodeGen's job … Migrate, then
generate."* Read against the evidence above, that is describing **that migration's** hand-off to a later
CodeGen pass — not a policy of never shipping the output. **The later pass is what lapsed.**

> **This is KI-24 in another repo.** Ours stopped on 2026-08-12 and orphaned six CodeGen emits, which were
> folded back into the sales baseline (32,006 → 35,925 lines) earlier in this project. Same mechanism, same
> symptom, same fix. Orders has `scripts/append-codegen.sh` already — the tooling is not missing, the run is.

A database built from migrations alone therefore has `__mj.EntityField` **short of the views**:

| Entity | Missing | Do we write it? |
|---|---|---|
| `MJ_BizApps_Orders: Order Headers` | `Origin`, `SourceCheckoutWidgetID`, `SourceCheckoutWidget` | **yes** |
| `MJ_BizApps_Orders: Order Lines` | `RootReversesOrderLineID` | **yes** |
| `MJ_BizApps_Orders: Products` | `RootSuccessorProductID` | read only |
| `MJ_BizApps_Orders: Product Types` | `PricingDriverClass` | seed only |
| `MJ_BizApps_Orders: Subscriptions` | `RootMigratesFrom/ToSubscriptionID` | no |
| `MJ_BizApps_Orders: Payment Headers` | `RootReversesPaymentHeaderID` | no |
| `MJ_BizApps_Orders: Checkout Sessions` | `Distribution` | no |

### Why it is worth a KI rather than a footnote

**The error names nothing that would lead you here.** Saving an affected entity builds `@ResultTable` from
`EntityField`, then runs `INSERT INTO @ResultTable EXEC sp<Create|Update><Entity>`. The proc returns the
*view's* columns, the counts differ, and SQL Server says:

```
Column name or number of supplied values does not match table definition.
```

followed by several hundred lines of generated SQL naming neither `EntityField` nor the missing column.
First encountered here as a `sync push` failure on `MJ_BizApps_Orders: Product Types`.

**And the demo host cannot reproduce it.** `MJ_V6_Host` measures **0 drift**, because CodeGen has been run
on it. Only a fresh install shows this, which is precisely the configuration nobody was testing.

### Detect

```sql
SELECT e.Name, c.name AS MissingField
FROM __mj.Entity e
JOIN sys.views v ON v.name = e.BaseView
JOIN sys.schemas s ON s.schema_id = v.schema_id AND s.name = e.SchemaName
JOIN sys.columns c ON c.object_id = v.object_id
WHERE NOT EXISTS (SELECT 1 FROM __mj.EntityField ef WHERE ef.EntityID = e.ID AND ef.Name = c.name)
ORDER BY e.Name, c.column_id;
```

### Work around — **only CodeGen does this. There is no SQL shortcut.**

⚠️ **An earlier version of this entry prescribed the two schema-sync procs below. That was wrong — they
were run against `MJ_Sales_Latest` on 2026-08-25 and the drift stayed at exactly 10.** Corrected here so
nobody loses an hour to it:

```sql
-- DOES NOT WORK for missing fields. Updates existing rows only.
EXEC __mj.spUpdateExistingEntitiesFromSchema      @ExcludedSchemaNames = 'sys,staging';
EXEC __mj.spUpdateExistingEntityFieldsFromSchema  @ExcludedSchemaNames = 'sys,staging', @EntityIDs = NULL;
```

`spUpdateExistingEntityFieldsFromSchema` filters on **`AND ef.ID IS NOT NULL`** — by construction it can
only touch `EntityField` rows that already exist. Its `INSERT INTO` statements all target table variables
(`@FilteredRows`, `@ExcludedSchemas`, `@ScopedEntityIDs`), never `__mj.EntityField`.

**MJ's own repeatable migration does not fix it either.** `MJ/migrations/R__RefreshMetadata.sql` runs
`spUpdateExistingEntitiesFromSchema`, `spUpdateSchemaInfoFromDatabase`, `spDeleteUnneededEntityFields` and
`spUpdateExistingEntityFieldsFromSchema` — all four are update/delete only. So re-running migrations, in
any order, cannot close this gap.

Creating a new `EntityField` row happens **only** in CodeGen's TypeScript layer:
`MJ/packages/CodeGenLib/src/Database/manage-metadata.ts` → `createNewEntityFieldsFromSchema()`, which
issues per-field `INSERT INTO EntityField` with computed `Sequence`, display-name derivation, type
mapping, FK detection and default-value parsing. **Do not hand-write a substitute** — that is a large
surface to get subtly wrong, and a wrong `EntityField` row fails later and further away than a missing one.

So the only supported fix is **run CodeGen against the database after migrating**, which is exactly what
`bizapps-orders`' migration header tells you to do.

> **This collides with Amith's standing rule that CodeGen runs need his approval plus a quality gate.**
> That is not a reason to skip it quietly — it is the reason this is a 🔴 and needs raising. A fresh
> BizApps install cannot be made correct without it.

*Status of the above: the proc behaviour is **measured** (ran them, drift unchanged at 10). That only
CodeGen can create the rows is read from MJ's source, **not** executed — nobody has yet run CodeGen against
a fresh install and re-measured. Do that before treating "run CodeGen" as proven.*

### What does NOT fix it

Pushing orders' `metadata/entity-fields`. Checked on `origin/next`: that directory holds only
`address-embed` and `payment-detail-embed`, and none of the ten fields appear in it.

### Who owns the real fix

Orders, and it is routine maintenance rather than a new pattern: run `scripts/append-codegen.sh`, which
they already have, and commit the result the way their baseline already does for 989 rows.

**Still do not change orders from this repo.** A PR against another app needs their review, and the CodeGen
run that produces the output needs Amith under his standing rule. Neither of those is a reason to sit on
the finding — the finding is that their append lapsed ten migrations ago and every fresh install is
short until it runs.

*One correction worth carrying: an earlier draft of this entry claimed orders "deliberately" does not ship
CodeGen output, and that a fix would contradict their design. That was wrong — it generalized one
migration's comment into a policy the repo's own 990 lines contradict.*
