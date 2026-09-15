---
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-ng': patch
---

Deal form — the two lock messages a person reads, in plain English (golive#207 rows 16 and 17).

These were the tester's own deferrals from the last copy round: they wait on the close/reopen work,
because both replacements tell the user to "set the status back to Open" and until golive#205 landed
that was not something the form could do. It is now.

**The header lock notice** said the deal was "closed (Won) and locked", explained that a contract or
an order was derived from it, and told the reader to "reopen the deal, which records a reason". The
replacement names what can still be edited and the one action that unblocks them. The provenance
argument is gone: a person who has just been stopped wants to know what they can do, and the reason
is one click away in the close history.

**The form save refusal** said "Frozen: this deal is closed and locked. Reopen it through
Sales.ReopenDeal, which records a reason, if this genuinely needs to change." — the word "frozen"
three times over before anything actionable, and an API operation named to someone who had just typed
into a form field.

**The editable list is DERIVED, not the three names the tester wrote.** They wrote "Deal Status,
Description and Next Step" when the editable set held two fields; golive#206 item 3 expands it. A
hardcoded sentence would have started lying the moment that landed, and it would have read perfectly
while doing it. The notice composes the set through a label map, so it stays true as the set changes.

**Deal Status is listed but is not in `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`**, which looks like a
contradiction and is not. That set is what the SERVER accepts in a bare save, and golive#205 asks for
a bare status write to be refused on every path — the status moves through `Sales.CloseDeal` and
`Sales.ReopenDeal`, which the form's status control routes to. The field is editable to a person and
not writable by a raw save, and one set cannot say both. The notice is the one that describes people.

14 tests, five mutations checked: reverting either message, dropping Deal Status from the list,
un-humanising the labels, and losing the sentence's final "and". The row 17 revert survived every
other test in the repo until its own gate existed.

Row 18 (the SERVER refusal) is not here — sales#73 is already rewriting that exact string, so it
ships there rather than conflicting.
