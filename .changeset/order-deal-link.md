---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

Order review by trigger support (bc-aidp-next-golive#320 §5). Sales now registers `DealOrderLink` with orders' `RegisterOrderDealLink` seam at bootstrap, answering which deal created an order from `Deal.OrderID`, so orders can let a deal order confirm without review. The seam ships in `@mj-biz-apps/orders-entities` 5.36.0; with an older orders the registration is skipped and logged. A pipeline's `CloseWonPolicy.CloseWonTasks.RaiseOrderReviewTask: false` stops a won deal raising the `ORDER_REVIEW` task; absent or `true` keeps it, so existing installs are unchanged.
