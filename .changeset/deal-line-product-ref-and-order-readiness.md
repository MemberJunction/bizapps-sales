---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-ng': minor
---

Carry `DealLine.ProductID` end-to-end and surface order readiness in the deal workspace.

A deal line can now hold a catalog product reference and have it survive a round trip through
`Sales.SaveDeal`, giving a resolved reference somewhere to live. `DealDraft` gains
`LinesMissingCatalogProduct()`, `IsOrderReady` and `OrderReadinessMessage()`, all derived from
`ProductID IS NULL` — there is no stored readiness flag and no schema change, because a persisted flag
would be a second copy of an answer the lines already give.

The workspace flags a deal whose lines lack catalog products through the validation surface it already
had, plus one chip in the context band. It is a **warning, never a save block**: an early-stage deal
legitimately has no resolved products yet, since the catalog reference belongs at the hand-off rather
than at entry.

Deliberately excluded: no product picker, no resolver, and no local product catalog. Each would commit
the team to a resolution approach and to orders' catalog contract before those are decided, and sales
must never host its own catalog — orders is the source of truth. The plug point is just the column.
