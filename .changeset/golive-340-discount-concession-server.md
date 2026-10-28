---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
---

A deal line's raised discount is now recorded as orders' Price concession through a new `Sales.RecordDiscountConcession` remote operation, so orders' server subclass fills, values and decides it. Before, the browser created the concession itself, its required-field validation failed before any request was sent, and the rep saw "Orders refused the concession and gave no reason". A refusal now carries orders' own reason. Raising a line's discount again withdraws the concession recorded for its earlier discount (when orders allows it) before recording the new one, so orders no longer counts both. `CONCESSION_REFUSED_WITHOUT_REASON` is exported from `@mj-biz-apps/sales-entities`. `RecordDiscountConcession` no longer takes a `contextUser` argument.
