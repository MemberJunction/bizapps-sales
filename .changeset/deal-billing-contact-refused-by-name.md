---
"@mj-biz-apps/sales-core-entities-server": patch
---

**A deal save naming a billing contact that does not exist is refused by name.** The server check that refuses a missing customer or primary contact before anything is written did not look at `BillingContactID`, so a stale billing contact failed later on `FK_Deal_BillingContact` as a SQL error. It is now checked the same way, and the refusal names it as the billing contact. Fixes #248.
