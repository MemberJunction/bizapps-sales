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

---

**A save already in flight stops the reopen, and the close.**

Saving first only protects anything if the save actually happens. `Save()` returned at its re-entrancy
guard — `if (!deal || !tabId || this.Saving())` — without writing a message, and both callers decided
whether it had worked by reading `MessageIsError`, which is whatever the last message left behind. A
silent early return therefore read as success.

The sequence: edit Description on a closed deal, press Save, press Reopen before it resolves. Both
controls are live at once — the save affordance is the tab strip's, and Reopen was disabled only while
closing. The reopen ran, and the in-flight save then landed on the reopened row and wrote the closing
status back over it, which is the loss the ordering exists to prevent, reached from the other side.

`Save()` now reports a boolean, and `ConfirmClose()` and `ReopenDeal()` share one
`saveActiveTabIfDirty()` that keys on `Saving()` and refuses out loud. Both confirm buttons are
disabled while a save is running.

---

**Where to see it: nowhere, yet.** `mjs-deal-workspace` appears in no template — commit `9d6ef9e`
("Replace the in-rail deal workspace with Explorer OpenEntityRecord") unmounted it on 2026-08-31 and
nothing has rendered it since, so this surface is currently unreachable in the running app. The fix is
real and the checks are real; a tester should not go hunting for the repro in the UI. The deal FORM's
equivalent paths were fixed separately in sales#78.
