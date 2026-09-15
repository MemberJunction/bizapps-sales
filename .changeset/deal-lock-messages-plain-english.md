---
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-ng': patch
---

Deal form — all three lock messages, in plain English (golive#207 rows 16, 17 and 18).

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

**Row 18, the SERVER refusal**, said "this deal is closed and locked; {fields} cannot be changed.
Reopen it through Sales.ReopenDeal, which records a reason." It is row 17's sibling: row 17 is what
the form shows a person, row 18 is what the save returns to whoever asked — the form, an import, an
agent or a raw API call. Its `{fields}` stays interpolated for the same reason the notice composes
its list: golive#206 item 3 grows that set.

Row 18 began on sales#73, the golive#205 branch, because that is where its sentence became TRUE —
until the trigger landed, a status write could not reopen a deal and the refusal genuinely had
nowhere else to send an integrator. It moved here so that one PR owns one issue. The sequencing is
unchanged and was the tester's own: "the three lock messages assume the close/reopen issue lands".
**This PR merges with sales#73, never before it.**

It also arrived with no test at all — reverting the sentence broke nothing. It has one now, which is
where the fourth mutation below comes from.

18 tests, eight mutations checked: reverting any of the three messages, dropping Deal Status from the
list, un-humanising the labels, losing the sentence's final "and", hardcoding row 18's field list,
and appending the API detail back onto it. The row 17 revert survived every other test in the repo
until its own gate existed, and row 18's revert did the same.
