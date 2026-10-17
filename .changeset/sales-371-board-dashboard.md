---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Sales Board and dashboard (#371, #448, #449, #450): page, period, Inspect slice and Board company/pipeline are kept in the URL; Board cards open with Enter or Space, have a "Move to stage" control, move at once on drop and move back with the reason if the save fails, and show an "Idle N days" flag past the stage's Rotting Days; a failed win rate, pipeline list or grid view shows its own error with Retry instead of replacing the page, and a failed period change says why with Retry; forecast stack segments are keyboard buttons; one date format ("Jul 1, 2026"); All deals lists open deals first, then by expected close; grids show "Expected close" and "Closed on" and probability as a percent; Inspect filters by criteria instead of ID lists; a pipeline's Close Won Policy is checked on save.
