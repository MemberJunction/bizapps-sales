---
"@mj-biz-apps/sales-ng": patch
---

Deal line editor: a rep with a price-override grant can pick one of the product's named prices with orders' shared line price picker, and the product list shows each product's catalog price. A typed custom amount stays off (D-DL2). Requires `@mj-biz-apps/orders-entities` / `@mj-biz-apps/orders-ng` 5.18.0 or later, and moves the common-* override to 5.46.3, the floor orders-entities 5.18 declares.
