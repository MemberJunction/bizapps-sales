---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-integration-tests": patch
---

Raising a deal line's discount now withdraws the line's earlier concession instead of deleting it (golive #403). The earlier Pending or Approved Price/Scope concession is set to Withdrawn, so orders keeps it as a record and counts it toward nothing, and an Account Director, who may record concessions but not delete them, can raise a discount. If orders refuses the withdrawal, the new concession is not recorded and the refusal is returned, instead of being logged while both concessions stayed counted. Needs `@mj-biz-apps/orders-entities` with the Withdrawn status.
