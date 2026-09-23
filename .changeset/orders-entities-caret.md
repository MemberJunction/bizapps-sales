---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
---

Depend on `@mj-biz-apps/orders-entities` with a caret range instead of an exact pin. The exact pin
made a host that installs both Sales and Orders nest a second copy of `orders-entities` whenever
Orders released, and that copy's entity registrations outranked the Orders server subclasses. The
order-line veto registry is now shared across copies, so the pin is no longer needed; the caret keeps
the host to one copy.
