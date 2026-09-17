---
'@mj-biz-apps/sales-core-entities-server': patch
---

A deal status that cannot be read no longer closes the deal.

`readStatusLockFlags` fails closed — it returns `LocksDeal: true` when the read fails. That is right for the close lock: an unreadable status means we cannot prove the deal is unlocked, so the edit is refused, and an unreadable status refuses more, never less.

`planStatusTransition` reads the same value to mean *"the target status closes the deal"*. Under the same default, a transient failure on one status row produced a **Close plan** and ran a real close — stage event, contract, finance tasks, a voided order — on a save that asked for none of it. One default, two readings, opposite consequences. The fail-closed instinct that protects the lock is what fires the close.

Guessing the other way is no better: a status that really does lock would then be written with no close behind it, which is the defect golive#205 was filed about. So neither guess is taken. `readStatusLockFlags` now reports whether it actually read the row, and the trigger refuses the save when it did not — the same instinct `planStageDefaults` already states for its own read, *"Unreadable is treated as do not derive"*, and the same trade: a rep retries one save, rather than a deal closing that nobody asked to close.

A status the lookup succeeds at but does not **find** is treated the same way. `Success: true` with no rows is not a failure, but it is equally unanswerable — there is no row to say whether that status closes a deal — and the foreign key would refuse the write a moment later with a worse message.

**The refusal runs BEFORE the status is reverted, and that ordering is what makes the retry work.** The revert exists so the close lock and `super.Save()` do not write a status the transition is about to move; on this path nothing downstream runs, so reverting would serve nothing and would cost the one thing the message asks for. A reverted field is clean, so a caller who reads "try again" and re-saves the same object would get `planStatusTransition() === null` on `!field?.Dirty` — no close, the other edits committed, and `Save()` returning true. Left dirty, the retry reads the status again, which is exactly what a transient failure needs.

Six tests, three mutations, all killed: removing the guard (which restores the defect exactly), making the read always claim success, and making the failure path claim success. The three that would have shipped it.

The lock's own behaviour is unchanged — `statusLocksDeal` still fails closed, and a status row that is merely absent still reads as not-locking there, exactly as before.
