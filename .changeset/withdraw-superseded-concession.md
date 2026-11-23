---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-integration-tests": patch
---

Raising a deal line's discount now withdraws the line's earlier concession instead of deleting it (golive #403). The earlier Pending or Approved Price/Scope concession is set to Withdrawn, so orders keeps it as a record and counts it toward nothing, and an Account Director, who may record concessions but not delete them, can raise a discount. If orders refuses the withdrawal, the new concession is not recorded and the refusal is returned, instead of being logged while both concessions stayed counted.

Sales now needs Orders 5.50.0 or later, the first release with the Withdrawn concession status: the `@mj-biz-apps/orders-*` peer ranges and `mj-app.json`'s Orders dependency move from 5.39/5.40 to 5.50.0. Orders 5.50 needs Accounting 0.24 or later, so the integration tests' Accounting ranges move to 0.24.0 as well.
