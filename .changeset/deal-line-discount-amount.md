---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
---

A deal line's discount can be typed as a dollar amount. The editor converts it to a percent of orders' list amount and stores it on `DiscountPct`, so the percent's precision, bounds and concession rules apply.
