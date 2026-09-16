---
'@mj-biz-apps/sales-ng': minor
---

Deal form: reopening a deal no longer throws away what the user had typed (sales#73 review).

Both reopen paths ended by reloading the record, and a reload overwrites the in-memory one. Anything
edited and not yet saved went with it — no prompt, no warning, no message. A locked deal is not a
read-only deal: `DealFieldsEditableWhileLocked` keeps six fields open, seven on a lost one, and the
panels render them, so a rep could legitimately be mid-sentence in Description when they decided to
reopen from the Status control. The Description was gone when the form came back.

**The reopen now saves first**, which the code previously said out loud that it must not do. The old
comment's reasoning was that "the close lock would refuse the save and turn a legal reopen into a
refusal". The lock refuses less than that: `DealEntityServer.checkCloseLock` filters
`f.Dirty && !editable.has(f.Name)`, so only a dirty FROZEN field is refused, and a save carrying
nothing but the carve-out fields passes straight through. Those are the only fields these panels let
anyone type into — `FieldEditable` renders the rest read-only — so the case the comment was defending
against is the one the form cannot produce, and the case it was preventing was the everyday one.

When a frozen field IS dirty the save is refused, and the reopen is then **abandoned rather than run
over the top**: `DealFormComponentExtended.Validate()` names the field before any round trip, the deal
is left closed, and the typing is still on screen to correct. Discarding it to get the operation
through would be the same defect wearing a different costume.

**The order is the load-bearing part, and it is why this is not simply "save on the way past".** The
save goes BEFORE the operation. Once `Sales.ReopenDeal` commits, the record in the browser still holds
the CLOSED status in both `Value` and `OldValue` — the operation moved the row, not the copy — so a
save at that point writes that closing status back over the reopened row.

Nothing would refuse it, which is what makes the order a correctness matter rather than a tidiness
one. Both halves of the status field are equal, so it is clean: `planStatusTransition` returns null on
`!field?.Dirty`, the golive#205 trigger never sees it, and the update writes the column anyway because
MJ sends every `AllowUpdateAPI` field and applies no dirty filter. The result is a silently re-closed
deal with `ClosedAt` still cleared by the reopen. A check that only proved a save happened would stay
green through that rearrangement, so every ordering assertion in the new suite names both calls and
their positions.

**The Close panel's reopen is fixed too**, because it carried the same wrong premise in its own
comment. Its symptom differed rather than being absent: that button is not inside `@if (EditMode)`, so
in edit mode it reopened the deal and then reloaded **nothing at all** — `canRefreshRecord()` is false
while edit mode is on, and it returns false rather than throwing — leaving a reopened deal still drawn
as closed and locked. It now saves, ends edit mode and reloads, the same way the Status control does.

A clean record is still not saved. The reopen control renders only inside `@if (EditMode)`, so
`ConfirmClose`'s `EditMode || Dirty` condition would have written to a locked row on every reopen for
no reason; `Record.Dirty` is the question actually being asked, and it covers companions and the IsA
parent as well as fields.

9 tests, three mutations checked: skipping the save entirely (the original defect) fails 6 of them,
moving the save after the operation fails 2, and saving unconditionally fails 2.
