---
"@mj-biz-apps/sales-entities": minor
---

Foundation for the Deal→Order redesign: `Deal.OrderID` with a real FK to orders'
`OrderHeader`, and the embedded-record declaration on `DealEntity`.

Sales now depends on `@mj-biz-apps/orders-entities`. That is sanctioned — Amith
ruled sales has a hard dependency on orders — but orders' packages are
unpublished, so **sales is workspace-only until they are published**.

DealLine is untouched by this changeset; retiring it is the next step.
