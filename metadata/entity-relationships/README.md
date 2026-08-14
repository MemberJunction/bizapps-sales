# Related Record Collections on `Deal`

Three of the five `Deal → child` relationships CodeGen creates carry a `RelatedRecordCollection`
config. That JSON is what makes CodeGen emit a **typed, writable child collection** on
`mjBizAppsSalesDealEntity`, so a deal and its children travel, validate and persist as one unit —
`MJ.SaveEntityGraph` on the wire, `EntitySavePlan` inside one `EntityTransactionScope` on the server.

`RelatedEntity` and `RelatedEntityJoinField` are **not** repeated in the JSON. They are real columns on
`EntityRelationship`, already set by CodeGen; duplicating them here would create a second place for the
same fact to be wrong.

## The three shapes, and why they differ

| | `Lines` | `PaymentSchedule` | `Team` |
|---|---|---|---|
| `OrderBy` | `DisplayOrder ASC` | `DisplayOrder ASC` | `__mj_CreatedAt ASC` |
| `Sequence` | `DisplayOrder`, from 1 | `DisplayOrder`, from 1 | **none** |
| `OnRemove` | `delete` | `delete` | `delete` |
| `Load` | `explicit` | `explicit` | `explicit` |

**`Lines` and `PaymentSchedule` are ordered lists.** Their order is meaningful — it is how a quote
reads, and how an instalment plan reads — so array position is the authority and `DisplayOrder` is
derived from it on every add and remove. Nobody sets `DisplayOrder` by hand.

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
something calls `Load()`, and `Load()` itself refuses to run over unsaved changes unless forced. The
deal workspace loads each collection **once**, when the deal opens.

## `DisplayOrder` is now `1, 2, 3` — it used to be `10, 20, 30`

RRC's sequencer is `child.Set(field, from + index)`. The step is fixed at 1; there is no increment
option, so `From: 1` produces `1, 2, 3`.

The old 10-step was cosmetic. It looks like room to insert a row between two others, but nothing ever
used it: the hand-rolled code re-sequenced the whole collection on every add and remove, so a gap never
survived the next mutation. Rows written before this change keep their old values until the deal is next
saved, and ordering is unaffected either way because it comes from `OrderBy`.

## Why these rows are updated rather than created

CodeGen makes one `EntityRelationship` per foreign key and **re-mints its ID on every
`rebuild-db.sh`**. So each record here resolves its primary key with `@lookup` on
*Entity + RelatedEntity* rather than a hardcoded UUID, and this directory is pushed **after** CodeGen
pass 1 and **before** CodeGen pass 2 — pass 2 is the one that reads this JSON back out of metadata and
emits the collections. That ordering is the reason the documented rebuild loop runs CodeGen twice; see
`CLAUDE.md`.

`autoCreateMissingRecords` is turned **off** here, overriding the repo-root default, so an unresolvable
lookup fails loudly instead of inserting a duplicate relationship beside CodeGen's.

## The two relationships deliberately left plain

`Deal Stage Events` is **append-only provenance**. A writable collection is the wrong shape for it: a
collection invites `Remove()`, and the whole value of the stage-event trail is that nothing can edit or
delete it. Events are appended by server code, on purpose, one at a time.

`Deal Contact Roles` has no surface yet. It gets a collection when something needs to write it.
