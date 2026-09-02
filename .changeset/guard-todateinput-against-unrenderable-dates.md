---
"@mj-biz-apps/sales-ng": patch
---

Guard `ToDateInput` so an unreadable stored date cannot render as an empty field (bc-aidp-next-golive#185).

`deal-workspace.dates.ts` exists to be the ONE boundary between an `<input type="date">` and an
entity date field, and only one of its two directions was guarded. `FromDateInput` has always
refused an unparseable value; `ToDateInput` had no guard in either branch. An invalid `Date`
formatted to `NaN-NaN-NaN` and a malformed string was sliced to its first ten characters and handed
over whole — the element rejects both and renders **blank**. The field then reads as "no date" while
the record holds a value, and a rep who saves the form writes that emptiness back over it. Nothing
errors, because nothing failed.

**The reachable half was the year, not the text.** These columns are SQL `date`, so they cannot hold
"not-a-date" at all — the reproduction in the original report is not possible. But `getUTCFullYear()`
returns a *number*, so a year below 1000 formatted as `1-01-01`, and SQL `date` starts at 0001-01-01.
A stored early year is therefore storable, reaches the component as a real `Date`, and rendered blank.
The year is now padded to four digits alongside the month and day.

`IsUnrenderableDate` is exported beside it, and the workspace shows a note under any date field whose
stored value cannot be displayed. The guard alone would only have changed *why* the box is empty:
an element of `type="date"` cannot display an invalid value at all, so telling an empty field apart
from an unreadable one has to be the caller's job.

Also adds the missing `.dw-field-error` rule. The class was already rendered by `DiscountRefusals`
and nothing matched it, so that refusal text has been coming out as ordinary body copy.
