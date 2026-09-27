---
"@mj-biz-apps/sales-ng": patch
---

The dashboard now reports an error when `Sales: Deal Roster` returns without a column it reads, instead of treating the missing column as `false`. A database holding an older query definition used to show Weighted open as $0 and an empty stage mix with no error (#137).
