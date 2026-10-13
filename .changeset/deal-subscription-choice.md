---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
---

A deal line for a product the customer already holds now asks whether it is the next term of that subscription or a new subscription on its own dates, the same choice the order line offers, and saves the answer on the line (`OrderLine.SubscriptionAction`). Close Won refuses a deal while such a line has no answer, with one error per line in the `lines` section, because the close confirms the order and an unanswered line would otherwise be moved to start after the existing coverage ends. On a deal type that requires a renewal source, unanswered lines are answered "next term" inside the close instead of refused. Requires bizapps-orders with `FindUnansweredHeldLines`.
