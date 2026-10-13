---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-integration-tests": patch
"@mj-biz-apps/sales-actions": patch
"@mj-biz-apps/sales-server": patch
---

Requires bizapps-orders 5.30.0 or later (`@mj-biz-apps/orders-entities` and `orders-ng` `^5.30.0`, `mj-app.json` `>=5.30.0`). That release exports `FindUnansweredHeldLines` and `HoldingSubscriberFor`, which the Close Won check uses. orders 5.30.0 needs MemberJunction 6.1.5, so the `@memberjunction/*` ranges and `mjVersionRange` floor at 6.1.5. The lockfile resolves bizapps-accounting 0.22.0, which orders-ng 5.30.0 requires.
