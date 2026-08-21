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
capture is stale, because a sibling app's entities are not loaded, or because an IsA relationship resolves
differently on the second pass than the first.

This repository's own `CLAUDE.md` already records a measured instance of that last case: a second full
CodeGen pass regenerated `vwDeals` with eleven virtual lookup columns where the first produced ten, without
adding the matching `EntityField` row — leaving every Deal insert failing on a column-count mismatch. Same
family: a tool that is correct end-to-end and destructive when interrupted or misfed.

---

## What to do instead

**For a missing `EntityField` row, write the INSERT.** It is a dozen lines of SQL in a migration, it is
reviewable, it changes exactly one thing, and it cannot drop an object. The generated `EntityField` INSERTs
already in the migration set are the template.

**For a stale view or procedure, regenerate that object alone**, from the migration that owns it, rather
than regenerating the schema.

**If CodeGen genuinely is the right tool** — a real schema change, many entities, a rebuild — then the
preconditions from `CLAUDE.md` are not optional and the reason each exists is now demonstrated rather than
theoretical:

* Take a `COPY_ONLY` backup first, and verify it with `RESTORE VERIFYONLY … WITH CHECKSUM`. `COPY_ONLY`
  specifically, if anyone else is working against the host: a normal full backup resets their differential
  base.
* Run it against a database you own, never a shared host.
* One pass, not two. Pass 2 must be `--skipdb`.
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

**A tool whose failure mode is "removes things and stops" must never be aimed at a small problem.** The
blast radius is not proportional to the goal — it is proportional to what the tool regenerates, which is
everything. Three incidents is enough evidence that the instinct to reach for it needs to be treated as
the warning sign, not the plan.

The question worth asking before running it is not "will this fix the gap?" but **"what does this drop on
the way in, and do I have a verified restore point?"**
