---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Deal line: picking a revenue band for a buyer whose revenue is unknown no longer demands a price override reason. Orders 5.40.0 treats that pick as the rules' price and hides its reason box, but the deal line still asked for a reason, so the line could not be saved. Requires Orders 5.40.0.
