# Partially-failed CodeGen runs — a cautionary record

**Not an upstream defect.** This is damage to our own host, caused by how we have run CodeGen, and it is
being repaired. It is written down because it has now happened **three times in this project** and the
pattern is worth more than any of the three incidents.

Nothing here belongs in a report to another app team.

---

## The pattern

All three follow the same shape:

1. CodeGen is run to close a metadata gap — a column that exists in SQL but not in `EntityField`, a
   generated view that is out of date, a missing subclass.
2. The run does not complete. It fails partway, or it completes against an incomplete capture of the app.
3. **It has already dropped objects it did not recreate.** MJ's generated half is DROP-then-CREATE, so an
   interrupted run leaves the database missing views, stored procedures or registrations that existed
   before it started.
4. The symptom appears somewhere else entirely, hours later, as an error naming a column or a constraint
   rather than a missing object.

The third instance took out `spCreateOrganization`, and before it, a run took out contracts' views and
stored procedures.

**The important property: step 3 is invisible at the moment it happens.** A failed run reports a failure.
It does not report "and I removed nine procedures on the way in". So the cost is not paid when the mistake
is made, and by the time it is paid the run is no longer the obvious suspect.

---

## Why the temptation keeps recurring

Every one of the three started from a genuine, narrow problem that CodeGen *does* solve: a metadata gap.
The reasoning each time is reasonable — "the `EntityField` row is missing, CodeGen writes `EntityField`
rows, therefore run CodeGen" — and it is wrong for a reason that is not obvious from the goal:

**CodeGen is not a metadata-repair tool. It is a whole-schema regeneration tool that happens to write
metadata as part of its output.** Pointing it at a one-column gap asks it to regenerate everything, and
everything includes objects whose current definition it may not be able to reproduce — because the app
capture is stale, or because a sibling app's entities are not loaded.

A run can also stop one pass short. The pass that adds a column to a view registers that column's
`EntityField` row only on the next pass (`docs/KNOWN-ISSUES.md` KI-7), so stopping after it leaves every
insert on the entity failing on a column-count mismatch. Same family: a tool that is correct end-to-end and
destructive when interrupted or misfed.

---

## What to do instead

**For a missing `EntityField` row, run CodeGen under the preconditions below; do not hand-write the
INSERT.** `CLAUDE.md` ("CodeGen output must be reproducible from this repo") rules that metadata CodeGen
creates ships in a migration as CodeGen wrote it, and that generated output is never written by hand. A
hand-written row is not what this repo's toolchain produces from its migrations, so the next CodeGen run
on any host drifts from it. An earlier version of this page said to write the INSERT; that advice is
withdrawn.

**For a stale view or procedure, regenerate that object alone**, from the migration that owns it, rather
than regenerating the schema.

**Whenever CodeGen runs**, the preconditions from `CLAUDE.md` are not optional and the reason each exists
is now demonstrated rather than theoretical:

* Take a `COPY_ONLY` backup first, and verify it with `RESTORE VERIFYONLY … WITH CHECKSUM`. `COPY_ONLY`
  specifically, if anyone else is working against the host: a normal full backup resets their differential
  base.
* Run it against a database you own, never a shared host.
* Run it until it reports `success: true` and every entity's field count matches its view (KI-7). One
  pass is not always enough, and a `success: false` pass leaves the database inconsistent.
* Confirm every sibling app's entities are loaded before starting, since an unresolved sibling is what
  makes the capture incomplete.

**And afterwards, check what is missing rather than what failed.** A run that reports success can still
have dropped something, if the recreate silently produced a different definition. The cheap check is a
count of generated objects before and after:

```sql
SELECT o.type_desc, COUNT(*) AS N
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE s.name LIKE '__mj%'
  AND o.type IN ('V', 'P', 'FN', 'TF', 'IF')
GROUP BY o.type_desc
ORDER BY o.type_desc;
```

Run it before and diff. A drop shows up as a smaller number, which is the one signal that does not depend
on anybody noticing an error message.

---

## The general lesson, stated plainly

**A tool whose failure mode is "removes things and stops" must never be aimed at a small problem without
a verified restore point.** The blast radius is not proportional to the goal — it is proportional to what
the tool regenerates, which is everything. Three incidents is enough evidence that a small gap is no reason
to skip the preconditions above.

The question worth asking before running it is not "will this fix the gap?" but **"what does this drop on
the way in, and do I have a verified restore point?"**
