---
'@mj-biz-apps/sales-ng': patch
---

Reopening a deal from the workspace no longer throws away what the user typed.

golive#224. `ReopenDeal()` went straight to `Sales.ReopenDeal` and then `ReloadActiveDeal()`, which
replaces the `DealEntity` wholesale — so a half-typed `Description` vanished. A locked deal is not a
read-only deal: `DealFieldsEditableWhileLocked` keeps six fields open, seven on a lost one, and the
Reopen button sits in the lock banner directly above them.

Worse than the version sales#78 fixed on the deal form. There the edit was lost but the record stayed
dirty; here `ReloadActiveDeal()` also calls `store.MarkClean(tabId)`, so the tab-strip marker was
cleared too and nothing on screen suggested anything had been pending. sales#78's changeset was
amended at the time to say the workspace was still uncovered rather than imply the class was closed —
this closes it.

It now mirrors the workspace's own `ConfirmClose()`: check the active tab's dirty flag, save, and
abandon the reopen if that save is refused, leaving the reason on screen and the typing in the box.

The save runs **before** the operation, and that ordering is the load-bearing part: once
`Sales.ReopenDeal` has committed it has moved the row, not the copy in the browser, which still holds
the closed status in both `Value` and `OldValue`. A save at that point would write the closing status
back over the reopened row, and nothing would refuse it.
