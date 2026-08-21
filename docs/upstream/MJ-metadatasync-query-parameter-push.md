# MetadataSync: pushing a Query with declared parameters fails on every push after the first

**Component:** `@memberjunction/metadatasync` (`mj sync push`)
**Affects:** `MJ: Queries` records that declare `MJ: Query Parameters` as related entities
**Observed on:** MJ `6.1.0-edge.2`, CLI `6.1.0-edge.2`, SQL Server
**Severity:** high — a metadata directory that pushes cleanly once can never be pushed again, and the
failure takes unrelated directories down with it

---

## Summary

`sync push` **extracts** query parameters from a Query's Nunjucks template and inserts them itself.
If the metadata file also declares those parameters as related entities — which is the documented way
to give a parameter a description, type and sample value — the two writes collide on
`UQ_QueryParameter_QueryID_Name`, and **the entire push aborts and rolls back**.

The insert is unconditional. It does not check whether a parameter of that name already exists on
that query, so the same collision occurs whether the duplicate comes from the file being pushed or
from a previous push of the same file.

The practical result: a query metadata directory lands correctly on a clean database, and **every
subsequent push of it fails permanently**.

## Reproduction

1. Create an `MJ: Queries` metadata record whose `SQL` uses a Nunjucks parameter:

   ```sql
   SELECT COUNT(*) AS N
     FROM SomeTable t
    WHERE 1 = 1
      {% if CompanyID %}
      AND t.CompanyID = {{ CompanyID | sqlString }}
      {% endif %}
   ```

2. Declare that same parameter explicitly in the file:

   ```json
   {
     "fields": { "Name": "Example Query", "SQL": "@file:SQL/example.sql", "...": "..." },
     "relatedEntities": {
       "MJ: Query Parameters": [
         {
           "fields": {
             "QueryID": "@parent:ID",
             "Name": "CompanyID",
             "Type": "string",
             "IsRequired": false,
             "Description": "Selling company. Omit for all companies.",
             "DetectionMethod": "Manual"
           }
         }
       ]
     },
     "primaryKey": { "ID": "…" }
   }
   ```

3. `mj sync push --dir metadata` against a database where the query does not yet exist.

**Actual:** the push fails.

```
❌ FATAL ERROR: Failed to save MJ: Query Parameters record
   Entity: MJ: Query Parameters
   Record Path: MJ: Queries[0]/MJ: Query Parameters[0]
   Is New Record: true
   SQL Error: Error executing SQL
     Error: Violation of UNIQUE KEY constraint 'UQ_QueryParameter_QueryID_Name'.
            Cannot insert duplicate key in object '__mj.QueryParameter'.
⚠️  Rolling back database transaction due to error...
✓ Database transaction rolled back successfully
✖ Push failed
```

**Expected:** the declared parameter is reconciled with the extracted one — upserted by
`(QueryID, Name)` — and the push succeeds.

### The second, more confusing shape

Remove the explicit `relatedEntities` and the same file pushes cleanly, because only the extractor
writes. **Push it a second time and it fails again**, with the identical constraint violation — this
time because the extractor is re-inserting parameters it inserted on the previous run.

So the defect is not really "declared parameters conflict with extracted ones". It is that
**parameter insertion is an INSERT where it should be an UPSERT.** The declaration case merely makes
it fail on the first push instead of the second.

## Why the blast radius is larger than the query

`sync push` processes directories in order and **halts** on the failure rather than skipping the
offending record. Every directory after it in `directoryOrder` never runs. In our case that meant a
push intended to add one query left several unrelated metadata directories unapplied, and the symptom
surfaced much later as missing entity-field metadata rather than as a query problem.

A related ordering hazard, already known to us, compounds it: `queries` sorts before
`query-categories` alphabetically (`i` < `y` at index 4), so without an explicit `directoryOrder` the
queries are pushed before the category they reference, every `CategoryID` lookup fails, and the push
halts in the same way.

## Workarounds, and what each costs

| Workaround | Cost |
|---|---|
| Omit `relatedEntities`; let extraction create the parameters | Loses hand-written descriptions, types and sample values. Extraction falls back to heuristic descriptions when no LLM credentials are configured (`No suitable model found for prompt SQL Query Parameter Extraction`). **Still fails on the second push.** |
| Push once to a clean database, never re-push | Not viable: any edit to the SQL needs a re-push. |
| Update `Query.SQL` directly in the database | What a second team hit this independently and had to do. It works, and it silently desynchronises the database from the metadata files that are supposed to be their source of truth. |
| Delete the `QueryParameter` rows before each push | Requires a manual DELETE against `__mj` before every push; easy to forget and unscriptable from the CLI. |

Two independent teams working in the same repository hit this in the same week, and reached different
workarounds — which is itself a signal that the failure mode is not self-explanatory from the error.

## Suggested fix

Make parameter persistence an **upsert keyed on `(QueryID, Name)`**, in both paths:

1. **Extraction** should update an existing row rather than insert a second one. This alone makes
   re-pushes idempotent and fixes the majority of the pain.
2. **Declared parameters should win over extracted ones** for fields the file states — `Description`,
   `Type`, `IsRequired`, `SampleValue`, `DetectionMethod` — since the file is the source of truth and
   the extractor is inference. A declared parameter that the template does not use is worth a warning;
   an extracted parameter the file does not declare should still be created.

A narrower fix, if the ordering above is contentious: have extraction skip any parameter name already
present on the query, whether it arrived from the file or from a previous push. That is strictly less
correct than an upsert — it would leave a stale description in place after an edit — but it removes
the hard failure.

Separately, and independently useful: `sync push` **halting** on a single record failure rather than
reporting it and continuing turns a one-record problem into a partial-metadata problem, and the
partial state is not obvious afterwards. Even a summary line naming the directories that were skipped
would have saved us the later diagnosis.

## Notes for whoever picks this up

- `DetectionMethod` on `QueryParameter` suggests the schema already anticipates both an extracted and
  a manual origin, so an upsert that preserves a `Manual` row against a re-extraction looks consistent
  with the intended design.
- The failure is fully deterministic and reproducible on a single query; no concurrency involved.
- Rollback works correctly — no partial writes were observed within a failed push. The damage is
  entirely in what never got applied.
