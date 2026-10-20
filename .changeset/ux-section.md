---
"@mj-biz-apps/sales-ng": patch
---

Sales section fixes: the Board shows the load-failed panel with Retry when the deal list cannot be read, instead of empty columns at $0. The Board keeps its company and pipeline across reloads, and a drag re-reads the deals without tearing the board down. Board totals and card amounts show the currency code (USD, EUR) resolved from accounting instead of the currency record's ID, and deals with no currency total with USD ones. The slipped-deal badge moves from All deals to Dashboard, whose tile and queue show the same count. Linked cells in the All deals and Inspect grids and in the deal form's Activity grid open their record, and New on the Activity grid opens the compose form above it.
