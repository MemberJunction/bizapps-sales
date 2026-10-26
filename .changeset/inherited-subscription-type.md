---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-ng': patch
---

A deal line for a product that names no subscription type of its own, but inherits one from its product type, is now treated as a subscription, as orders' confirm treats it. The line editor shows Term start and asks whether the line is the next term of a subscription the customer already holds, and the line cards show its term start. `sales-entities` adds `WithInheritedSubscriptionType` and `E_ORDERS_PRODUCT_TYPE`, and `ProductLookup` gains `ProductTypeID` (also in `PRODUCT_LOOKUP_FIELDS`).
