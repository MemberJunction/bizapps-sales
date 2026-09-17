---
'@mj-biz-apps/sales-core-entities-server': patch
---

Two defects on a closed deal: the owner could not be reassigned from the workspace, and a refused save told the caller nothing.

Both were found by writing the check golive#206 item 2 had been missing. Neither would have been found by reading the code, and neither failed any existing check.

**1. `SetOwner()` was refused on a locked deal.** golive#206 item 2 says reassigning a rep after close is record-keeping and must be allowed, and it held on one surface and not the other. The deal form's Internal team panel edits `DealTeamMember` rows, leaving `Deal.OwnerEmployeeID` clean, so it passed the lock. The deal workspace's owner picker calls `DealEntity.SetOwner()`, which loads the roster and then assigns the stamp itself — so the field arrived at `checkCloseLock` dirty, was counted as an edit to a frozen field, and the save was refused.

`ownerStampEditRefusal` already knew that assignment was legitimate when the roster drives it; `checkCloseLock` never asked. The condition is now a single `RosterDrivesThisSave` predicate with three readers, which is what stops them disagreeing again — it was spelled out twice and omitted once, and the omission was the bug.

The carve-out is narrow and grants nothing: `SD26`'s rule stands, a caller who hand-sets `OwnerEmployeeID` without touching the roster is still refused, and `stampOwnerFromTeam` re-derives the stamp from the roster afterwards regardless of what was supplied. `CD29` asserts both directions.

**2. Every refusal in `Save()` was `LogError`'d and nothing else.** The caller got a bare `false` and the reason went to the server log.

golive#207 row 18 is explicit about who that message is for: row 17 is what the form shows a person, and row 18 is *"what the save returns to whoever asked — the form, an import, an agent or a raw API call"*. Logged, it returned to nobody. The form looked correct only because `DealFormComponentExtended.Validate()` produces row 17 for itself; every other caller got silence.

The three refusals now go through a `refuseSave` helper that registers a failed `BaseEntityResult`, so the sentence lands on `LatestResult` where a caller reads it. Registered rather than assigned, because `LatestResult` returns `null` on an empty history while typing itself non-null — the same mistake that reached production in orders' line delete.

**A source-level test could not have caught this.** `deal-lock-server-refusal-copy.test.ts` proves row 18's sentence is in the file, and it was — every word of it, correct and unreachable. `CD30` runs a real save and reads the message off the result, and it is the only check that does: `M-CD30` returns the refusal to log-only and fells CD30 **alone**, with all 129 other checks still green. That is the measurement of how unread the message was.

`M-CD6` was re-aimed in passing, because the frozen-field filter it anchored on became a named predicate when the owner carve-out was added. Same mutation, new anchor. Anchor sweep: 97 of 97, 0 skips. Count bumped to 30 / CD1-CD30.
