---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-integration-tests": patch
---

Requires bizapps-orders 5.26.0 or later (`@mj-biz-apps/orders-entities` and `orders-ng` `^5.26.0`, `mj-app.json` `>=5.26.0`). That release adds `OrderLine.SubscriptionAction`, which lets a line say whether it extends a subscription the customer already holds or starts a new one. The lockfile drops duplicate MemberJunction 6.1.2 copies in favour of 6.1.4 and resolves bizapps-accounting 0.20.0, which orders 5.26.0 requires.
