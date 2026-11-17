---
"@mj-biz-apps/sales-core-entities-server": patch
---

A deal's currency now reaches its order (golive #492). When a deal provisions its order, the order takes the deal's currency code; it stays empty when the deal is in the selling company's functional currency or has no currency, which orders reads as the functional currency. A later change of the deal's currency moves the order's currency while the order is Draft or Quoted and has never been confirmed. A confirmed order, or one whose currency was set on the order itself, keeps its currency, and the deal's save reports why. Requires the orders release that adds `OrderHeader.CurrencyCode`.
