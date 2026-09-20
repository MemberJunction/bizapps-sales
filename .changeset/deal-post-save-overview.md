---
'@mj-biz-apps/sales-ng': patch
---

A deal moves to the Overview once it has been saved for the first time.

A new deal opens on Pipeline — that panel declares `leadsWhenUnsaved`, deliberately (golive#188), because a summary of a record with no data is a page of blanks. Once the deal is saved that reasoning inverts: the summary has something to summarise, and the rep has just finished what Pipeline was for.

MJ persists the active group only for a SAVED record (`ShouldPersistChromeActiveGroup`), so nothing moved the rail on that transition and a rep was left looking at the form they had just completed.

It lives in the hero rather than the Pipeline panel for two reasons, the second load-bearing: the hero renders for every section, so it sees the save wherever the rep is, and `MJSDealPipelinePanel` deliberately avoids `inject()` so `new MJSDealPipelinePanel()` keeps working in its tests.

Keyed on the unsaved→saved CROSSING, not on `IsSaved`: an already-saved deal must never be dragged to Overview, or a rep could not stay on another section for the rest of its life. That single test also makes it fire exactly once — a separate once-per-record flag was written first, and a mutation proved it inert.
