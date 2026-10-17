---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Closing and reopening fixes. A plain save that moves an open deal into a closing stage no longer takes that stage's probability, forecast category or order status, and the deal form and workspace no longer list closing stages. Reopening a deal that was closed with no stage puts it back with no stage. A failed deal save keeps the status and changes the caller asked for, so a retry still closes. A draft order's date follows the business day, and a booked order takes the close date. The Deals panel on organizations and people offers New only for sales customers and contacts, and the refusal for a missing customer or contact says which case it is.
