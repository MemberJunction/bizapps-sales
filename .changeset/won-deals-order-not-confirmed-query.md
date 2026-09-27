---
'@mj-biz-apps/sales-entities': patch
---

Ship the `Sales: Won Deals With Unconfirmed Orders` query for finance's month-end exception review
(golive #279, type 3): won deals whose order, reached through `Deal.OrderID`, is missing or not
Confirmed, so the deal is never billed. Metadata only; no schema change.
