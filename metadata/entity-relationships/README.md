# Related Record Collections on `Deal`

Two of the `Deal → child` relationships CodeGen creates, to `Deal Payment Schedules` and
`Deal Team Members`, carry a `RelatedRecordCollection` config (`.deal-child-collections.json`). That
JSON is what makes CodeGen emit the **typed, writable child collections** `PaymentSchedule` and `Team`
on `mjBizAppsSalesDealEntity`, so a deal and its children travel, validate and persist as one unit —
`MJ.SaveEntityGraph` on the wire, `EntitySavePlan` inside one `EntityTransactionScope` on the server.

`RelatedEntity` and `RelatedEntityJoinField` are **not** repeated in the JSON. They are real columns on
`EntityRelationship`, already set by CodeGen; duplicating them here would create a second place for the
same fact to be wrong.

`.form-chrome.json` in this directory sets a different column, `Configuration`, which places each
relationship on the generated forms; `metadata/entities/README.md` covers it.

## The two shapes, and why they differ

| | `PaymentSchedule` | `Team` |
|---|---|---|
| `OrderBy` | `DisplayOrder ASC` | `__mj_CreatedAt ASC` |
| `Sequence` | `DisplayOrder`, from 1 | **none** |
| `OnRemove` | `delete` | `delete` |
| `Load` | `explicit` | `explicit` |

**`PaymentSchedule` is an ordered list.** Its order is meaningful — it is how an instalment plan
reads — so array position is the authority and `DisplayOrder` is derived from it on every add and
remove. Nobody sets `DisplayOrder` by hand.

**`Team` is a SET, and that is a schema fact rather than a preference.** `DealTeamMember` carries
`UQ_DealTeamMember_Deal_Employee_Role` and `UQ_DealTeamMember_Deal_Person_Role`: a member is identified
by *(deal, person, role)*, and there is no column for "third from the top". Declaring a sequence would
mean inventing an order the database refuses to distinguish.

The consequence is worth stating because it is not obvious: **changing somebody's role is a remove plus
an add, not an edit.** Editing `DealRoleID` in place moves the row onto a key that may already be taken,
and the unique index is what stops it. RRC contributes deletions *before* insertions within the
transaction, which is exactly what makes remove-then-add safe in a single save.

## `Load: 'explicit'` is a data-loss guard, not a performance choice

A lazy load that fires **mid-edit** would replace the in-memory children with whatever is in the
database, discarding unsaved work with no error. `explicit` means the collection populates only when
something calls `Load()`, and `Load()` itself refuses to run over unsaved changes unless forced.

## `DisplayOrder` runs `1, 2, 3`

RRC's sequencer is `child.Set(field, from + index)`. The step is fixed at 1; there is no increment
option, so `From: 1` produces `1, 2, 3`.

## Why these rows are updated rather than created

CodeGen makes one `EntityRelationship` per foreign key and **re-mints its ID on every
`rebuild-db.sh`**. So each record here resolves its primary key with `@lookup` on
*Entity + RelatedEntity* rather than a hardcoded UUID. After a rebuild this directory is pushed
**after** one CodeGen run, which creates the relationship rows, and **before** a second
(`pnpm run mj:codegen:files`), which reads this JSON back out of metadata and emits the collections.

`autoCreateMissingRecords` is turned **off** here, overriding the repo-root default, so an unresolvable
lookup fails loudly instead of inserting a duplicate relationship beside CodeGen's.

## The two relationships deliberately left plain

`Deal Stage Events` is **append-only provenance**. A writable collection is the wrong shape for it: a
collection invites `Remove()`, and the whole value of the stage-event trail is that nothing can edit or
delete it. Events are appended by server code, on purpose, one at a time.

`Deal Contact Roles` appears on the Deal form as the Buying team panel, a plain related-entity grid.
Nothing writes it as part of a deal save, so it has no collection.
