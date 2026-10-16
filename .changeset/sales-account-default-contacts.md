---
"@mj-biz-apps/sales-entities": minor
---

Sales Accounts can name a default primary contact and a default billing contact.

`SalesAccount` gains two nullable columns, `DefaultPrimaryContactID` and `DefaultBillingContactID`, each a foreign key to `SalesContact`, the same target as the deal's own contact fields. The generated Sales Account entity and form carry them. Nothing reads them yet: filling a deal's empty contacts from its account arrives separately.
