---
"@mj-biz-apps/sales-entities": patch
---

Add the `Sales: Confirmed Orders Missing Agreement` query: confirmed orders with no deal, no contract, no signed date, or no file in the Executed Agreement category, one row per order with a flag for each check. Web orders, returns and subscription auto-renewals are left out; Payment Link orders are checked for a deal only (golive #388).
