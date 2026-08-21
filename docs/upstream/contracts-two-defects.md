# bizapps-contracts — two defects found while building the sales→contracts handoff

**Reported by:** the bizapps-sales team, from writing `LiveContractsSeam` against contracts v2.

One is a fresh-install blocker. The other forces name-matching across an app boundary. They are unrelated
to each other.

---

## 1. `ParentStatusRequirement` is a physical column with no `EntityField` registration

**Severity:** blocks a fresh install. Existing databases that were hand-corrected will not show it.

`V202608192100__v0.1.x__ContractType_ParentStatusRequirement.sql` adds the column to
`__mj_BizAppsContracts.ContractType`, but does not insert the matching `__mj.EntityField` row.

**Why that is fatal rather than cosmetic.** MJ's providers build their SELECT lists and their
`@ResultTable` shapes from **entity metadata**, not from the physical table. A column that exists in SQL
and not in `EntityField` is invisible to `RunView`, is absent from generated entity subclasses, and — where
the generated `spCreate`/`spUpdate` procedures were regenerated against the real table while the entity
was not — produces a column-count mismatch on insert:

```
Column name or number of supplied values does not match table definition
```

…inside a transaction that then aborts. The message names neither the column nor the entity.

**Why anyone installing fresh hits it.** A database built by replaying the migration set gets the column
and not the registration. Ours was corrected by hand on the host, which is a diagnostic rather than a fix:
the next CodeGen run overwrites it, and nothing in the repository carries the correction.

**Our understanding of how it got dropped** — relayed to us rather than established first-hand, so treat
it as context: the CodeGen half of that migration was hand-assembled around a broken `mjdev` app capture,
and the `EntityField` INSERT was lost in the assembly. That is worth knowing because it predicts *where
else* to look — any other column added in that same migration, or in others assembled the same way, may
have the same gap.

**What we would check before calling it fixed:**

```sql
-- every physical column on a contracts table with no EntityField row
SELECT t.name AS TableName, c.name AS ColumnName
FROM sys.columns c
JOIN sys.tables  t ON t.object_id = c.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN __mj.Entity      e  ON e.SchemaName = s.name AND e.BaseTable = t.name
LEFT JOIN __mj.EntityField ef ON ef.EntityID  = e.ID   AND ef.Name     = c.name
WHERE s.name = '__mj_BizAppsContracts'
  AND c.name NOT LIKE '__mj_%'
  AND ef.ID IS NULL
ORDER BY t.name, c.column_id;
```

An empty result is the passing condition. Running it once is cheaper than finding the next one the way we
found this one.

---

## 2. `ContractType` has no `Code`, which forces name-matching across an app boundary

**Severity:** design. Works today, and the way it works is the problem.

**Verified first-hand** against the baseline migration on `next`: `ContractType` carries `ID`, `Name`,
`Description`, `RequiresExecutedDocument`, `ParentStatusRequirement`, `Status`. There is no `Code`, and the
only unique handle besides the primary key is `UQ_ContractType_Name`.

**What that does to us.** Sales' close-won policy names a contract type as configuration, because sales
must not bake another app's UUIDs into its own code. With no `Code` column there are exactly three options
and all three are bad:

| Option | Why it fails |
|---|---|
| Filter on `Code` | The column does not exist. `RunView` fails the whole query rather than returning nothing — the previous version of our seam did this and could only ever fail. |
| Bake the seeded UUID | Couples sales to contracts' seed data. A rebuild that re-mints IDs breaks it silently. |
| Match on `Name` | What we do now, and it means a **display label is load-bearing across an app boundary**. Renaming "Order Form" in a lookup UI breaks a different application, with no error and no reference anyone can grep for. |

We took the third with a metadata probe: our seam asks `EntityField` whether `Code` exists, uses it when
present, matches on `Name` otherwise, and says which it used in its result message. So the day you add the
column we start preferring it with **no change on our side**.

**Why we think you'll want this anyway.** Contracts' own seed comments make the argument better than we
can — on `ParentStatusRequirement` replacing a name comparison:

> ⚠ THIS USED TO COMPARE THE TYPE'S NAME TO THE STRING 'Change Order' — and that was the defect, not a
> shortcut. A display name is not a rule: renaming that lookup row, an ordinary thing to do, silently
> stopped the check from ever firing, with nothing failing and no error to notice.

That is exactly the hazard, one level up: you removed a name comparison *inside* contracts and there is
still one *into* contracts, made by us, because there is nothing else to hold onto.

**The precedent, if it helps.** bizapps-tasks added `TaskType.Code` (`NVARCHAR(50)`, `NOT NULL`, `UNIQUE`)
for this reason, with a name-derived backfill for existing rows:

```sql
ALTER TABLE <schema>.TaskType ADD Code NVARCHAR(50) NULL;
-- explicit backfill by stable ID for the seeded rows, then:
UPDATE <schema>.TaskType SET Code = UPPER(REPLACE(Name, ' ', '_')) WHERE Code IS NULL;
ALTER TABLE <schema>.TaskType ALTER COLUMN Code NVARCHAR(50) NOT NULL;
```

Two things that migration got right and are worth copying: the seeded rows were backfilled **by ID** rather
than by the name-derived fallback (so `Follow-up` became `FOLLOW_UP` and not `FOLLOW-UP`), and the
`NOT NULL` came after the backfill. A `UNIQUE` constraint on a name-derived code will also fail if two
type names normalize to the same string — worth checking before the ALTER, not during it.

Suggested codes for the four seeded types, on the SCREAMING_SNAKE convention tasks used:
`ORDER_FORM`, `STATEMENT_OF_WORK`, `PAYMENT_LINK`, `CHANGE_ORDER`.
