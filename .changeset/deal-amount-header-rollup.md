---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-integration-tests": patch
---

Lined deals cache `OrderHeader.TotalGross` onto `Deal.Amount` (sales copies, never sums). A typed figure survives only on a header-only deal.
