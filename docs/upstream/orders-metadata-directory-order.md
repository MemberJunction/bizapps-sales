# bizapps-orders — `metadata/.mj-sync.json` halts a full push at 14 of 23 directories

**This one is a fix, not a report.** One line, and the mechanism is fully understood.
**Reported by:** the bizapps-sales team.

---

## What happens

`mj sync push --dir metadata` stops partway through with:

```
Failed to process field 'CategoryID' in MJ: Queries:
Lookup failed: No record found in 'MJ: Query Categories' where Name='Orders'
```

14 of 23 directories processed, the rest untouched, and the queries absent.

---

## Cause

`metadata/.mj-sync.json`'s `directoryOrder` lists **7** directories:

```json
"directoryOrder": [
  "revenue-recognition-types", "subscription-types", "payment-provider-types",
  "payment-types", "remote-operation-categories", "remote-operations", "applications"
]
```

Everything not listed falls to default ordering, which is alphabetical. And **`queries` sorts before
`query-categories`** — `i` < `y` at index 4. So every query row is pushed ahead of the category it
resolves `CategoryID` against by `@lookup`, the lookup finds nothing, and the push halts.

The rule that makes this class of bug easy to miss: `directoryOrder` only matters where one directory
looks up a record another creates. Fifteen of these directories are genuinely independent and correctly
omitted. `query-categories` → `queries` is a real dependency that happens to be *inverted* by alphabetical
order, which is the one case where leaving it out is not harmless.

---

## The fix

Add the pair to `directoryOrder`, categories first:

```json
"directoryOrder": [
  "revenue-recognition-types", "subscription-types", "payment-provider-types",
  "payment-types", "remote-operation-categories", "remote-operations",
  "query-categories",
  "queries",
  "applications"
]
```

**Measured result** (reported to us by the session that found it, not independently reproduced here):
**14/23 → 23/23, exit 0.**

Two notes on the shape of the fix:

* **List the dependency, don't rename to game the sort.** Renaming a directory so alphabetical order
  happens to work leaves the next person with no way to tell an ordering requirement from a coincidence.
* **A comment beside it is worth more than the two lines.** The failure message names `CategoryID` and
  `MJ: Query Categories` and says nothing about ordering, so the next person to hit this will not connect
  it to a sort. Recording *why* those two entries exist is what stops them being tidied away later.

---

## Precedent: the same class of bug, independently, in bizapps-contracts

Worth knowing that this is not a one-off. Contracts' v2 metadata hit the same shape — a `@lookup` resolving
against a row a later directory creates — and documented it in their own `.mj-sync.json`:

> `remote-operation-categories` MUST precede `remote-operations`: the operation rows resolve their
> `CategoryID` with `@lookup` against a category by Name, so the category has to exist first. This is the
> first entry in this list where the ordering is genuinely load-bearing rather than precautionary — get it
> wrong and the push fails on an unresolvable lookup.

Two apps, same failure, found separately. That suggests the general fix is not per-app diligence but
something in MetadataSync: either resolving `@lookup` dependencies to order directories automatically, or
failing at *validation* with a message that names the ordering rather than at row 14 with a message that
names a column. Worth raising with whoever owns MetadataSync — the per-app fix above is correct but it will
keep being rediscovered.

---

## State when we looked

The committed state at `next` has the 7-entry list above. The working tree of the orders checkout we can
see already has an **uncommitted** fix applied, with a comment explaining the same `'i' < 'y'` mechanism —
so someone on your side has very likely already found this. This write-up is here so the reasoning and the
MetadataSync-level suggestion are not lost if that edit lands as a bare one-liner.
