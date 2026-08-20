---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-integration-tests": minor
---

Add `CloseWonTaskService` — the finance tasks a won deal raises (S-US2 #34, S-US3 #35).

Both pipelines get an order-review task linked to the deal's order; a pipeline whose
`CloseWonPolicy.CreateContract` flag is set also gets a contract-processing task.
Pinned by WT1–WT6.

NOT wired into `Sales.CloseDeal` — that file is mid-rework for the embedded-order
redesign, and the wiring lands after it.

Sales now depends on `@mj-biz-apps/tasks-core` and `@mj-biz-apps/tasks-entities`.
