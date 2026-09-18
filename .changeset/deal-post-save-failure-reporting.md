---
'@mj-biz-apps/sales-core-entities-server': patch
---

A failure after the save now tells the caller what happened, instead of contradicting itself.

Two paths returned `false` AFTER `super.Save()` had already registered a SUCCESS result: the status-write transition failing, and the `saveWithinScope` catch. `this.Load(this.ID)` does not clear the history — core guards its `init()` with `if (!this.IsSaved)` and the deal is saved — so a caller doing the obvious thing read `Save() === false` beside `LatestResult.Success === true` and a `CompleteMessage` of `undefined`, which the resolver renders as "Unknown error". A caller following exactly the pattern `deal-workspace.service.ts` uses was told the save succeeded. That is worse than silent: the last entry on the history contradicted the return value. Since golive#205 made the status-write trigger the primary close path for importers and agents, it is also the path most likely to hit it.

`reportPostSaveFailure` is a sibling to `refuseSave` rather than a reuse, because two things genuinely differ. It does **not** restore the caller's status — `refuseSave` does that because nothing was written and a retry must still carry it, whereas here the row has already moved and `Load()` has resynced this object to it, so re-dirtying a field to a value the database just rejected would invite the same failure again. And it carries `CloseDealOperation`'s structured `Issues`, which were being joined into a `LogError` and dropped; those sentences are the only thing that says why the close refused.

The transition message names both halves — the field edits were saved, the status did not move — because "the save failed" is as wrong as "it worked", and a caller who cannot tell the difference will either re-send edits that already landed or assume a close that never happened. The scope-catch message says whether the rollback itself succeeded, since a clean rollback means retry and a failed one means the row needs looking at first.

**A transaction was considered and is not available.** The transition reaches bizapps-contracts and bizapps-orders through seams, so there is no single database to be atomic in; `CloseDealOperation` is a remote operation owning its own scope and rollback; and it loads its own copy of the deal, which is why it must run after the commit rather than inside it. Narrowing the window belongs upstream, in the pre-flight that already refuses a lost close with no loss reason before a single row moves.

`M-CD30` is re-aimed. Its anchor was the registration line plus its `return false`, which stopped being unique the moment the new helper was added beside `refuseSave` — and two matches means the driver SKIPS and exits 1, so CD30 would have lost its proof while reading exactly as before. It now targets `failed.Message`, the line only `refuseSave` has, and isolates what CD30 actually claims: that the refusal's sentence reaches the caller.
