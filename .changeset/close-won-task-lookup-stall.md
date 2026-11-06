---
'@mj-biz-apps/sales-core-entities-server': patch
---

Close Won no longer stalls 30 seconds and returns a GraphQL 504. The check for an existing contract-processing task now reads on the close's own transaction instead of a separate connection that waited on the order-review task the close had just written.
