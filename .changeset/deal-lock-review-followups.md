---
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-ng': patch
---

Five defects the deal-lock stack (sales#72, #73, #78, #79, #80) merged with, and the three checks that were looking the wrong way.

**A refused save put the caller's status back.** `saveDeclared` reverts `DealStatusTypeID` to its persisted value so the close lock sees a clean field — correct for a save that proceeds, a trap for one that refuses. A caller who read the refusal, fixed what it named and saved the SAME object got `planStatusTransition() === null` on `!field?.Dirty`: no close ran, the other edits committed, and `Save()` returned **true**. An open deal carrying a loss reason, and a caller told it worked. Restored in `refuseSave` rather than at each `return false`, for the same reason the `finally` above it exists — there are four exits and the bug is always the one added later.

**A stamp failure was silent.** The `catch` around `stampCompanyFromPipeline`/`stampOwnerFromTeam` was `LogError` + `return false`, so `ResolveOwnerRoleID`'s "no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner." — a message that names its own remedy — reached the user as "Unknown error creating record" (bc-aidp-next-golive#216). It now goes through `refuseSave`; the log line still contains the exact substring that issue tells people to grep for.

**Row 18 printed column names.** `DEAL_FIELD_LABELS` holds exactly the editable-while-locked set plus `DealStatusTypeID` — the fields row 16 lists. Row 18 names the FROZEN fields, none of which were in the map, so every one fell through to its raw column name. The fallback now splits the column name and drops a trailing `ID`, so the map is an override rather than the only source of a label and a column added tomorrow cannot regress it.

**The reopen test only ever saw one of two panels.** `source.indexOf('public async ConfirmReopen...')` returned the Pipeline panel's copy, so `MJSDealClosePanel` was invisible to it — permanently. That is how the Close panel shipped a reopen which never left edit mode under a green test named for exactly that. It now finds every declaration and asserts about each, and accepts either spelling of the reload (`RefreshRecord()` directly, or `refreshQuietly()`), because pinning one would have failed the panel that does it correctly. Verified against sales#72's tree, where it correctly fails `MJSDealClosePanel`.

**A Playwright assertion outlived its string.** sales#79 rewrote the closing column's lock title to "Deals cannot be moved here."; `80-board-drag.spec.ts` still asserted `/closes and locks/i`. The Explorer harness is deliberately out of CI, so nothing caught it. `COVERAGE-MAP.md`'s row for that step had drifted independently — it claimed `/workspace/i` where the spec asserts `/form/i` — and now matches.
