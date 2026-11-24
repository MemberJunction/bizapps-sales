---
"@mj-biz-apps/sales-core-entities-server": patch
---

A deal now takes its order's total when it closes or reopens, even when its amount was typed before the order had lines (#643). Before, a deal whose lines were edited from the order form kept the typed figure through the close, and the close lock then froze it. A locked deal's amount still does not change on a permitted edit (#351).
