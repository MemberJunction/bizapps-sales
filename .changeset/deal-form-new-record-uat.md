---
"@mj-biz-apps/sales-ng": patch
---

Deal form: a new deal is not a deal that failed an audit (#188, #189, #190).

The Pipeline panel listed `Name` and `DealNumber` while the hero directly above already
renders both — `Name` as an editable field in edit mode, `DealNumber` beneath the title once
the server assigns one. The form therefore offered two inputs bound to one column, and an
empty textbox for a value the user does not get to choose. Both are gone from the panel; the
hero's `Name` is the one that survives.

Overview no longer greets an unsaved record with "No owner", "No next step" and "No account".
A deal nobody has saved has not *failed* to have those — nobody has had the chance to give it
one. Health returns nothing until `IsSaved`, the same signal the container already uses to
decide not to restore a stored rail position for a new record.

Tests pin all three fixes and mutation-check that they hold.

Not fixed here: that a new deal lands on Overview at all (the other half of #188). The
container picks `spec.Groups[0]`, its coordinator is a private per-container provider, and the
container is not exported for `ViewChild` — there is no seam a form can reach. It needs a small
opt-in in MJ base-forms.
