---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": minor
---

A discount raised on a deal line is recorded as a Price concession in orders. The Add a product / Edit line dialog asks for a reason category and a reason when Discount % goes up, and after the order saves the line it records the concession: inside the rep's Sales Authority orders approves it on save; outside it the dialog says the order cannot be confirmed until it is approved, and shows orders' refusal when it could not be recorded. New exports from `sales-entities`: `DiscountNeedsConcession`, `DiscountReasonCategories`, `RecordDiscountConcession`. The `@mj-biz-apps/orders-*` floor moves to `^5.22.0`, the first release with the Order Concession entity.
