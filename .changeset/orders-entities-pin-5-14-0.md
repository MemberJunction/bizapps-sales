---
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-integration-tests': patch
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-ng': patch
---

Move the exact `@mj-biz-apps/orders-entities` pin from `5.13.0` to `5.14.0`, in all five
declarations.

The pin has to be exact — `orders-entities` keeps its order-line veto registry in a module-scoped
variable, so it is per-copy rather than per-process — and it has to match what orders pins inside
its own packages, or the host app resolves two copies. Orders published `5.14.0` and rewrote its
internal pins; this one is in another repo, so nothing moved it.

What the drift cost: npm cannot satisfy two exact pins from one copy, so it nested a second
`orders-entities` under the sales packages. That copy re-ran every module-scope `@RegisterClass` in
it, including the generated `OrderHeaderEntity` for `MJ_BizApps_Orders: Order Headers`. Registration
priority auto-increments, so the later copy outranked `OrderEntityServer` — and `OrderNumber`, which
only that server subclass mints, was never assigned. Every new order header then failed its NOT NULL
insert, on the Orders screen and on every Deal that provisions an embedded order.

No behaviour in this package changes. Verified against the published `5.14.0` tarball rather than the
version number: `order-line-edit-veto.js` is present and `index.d.ts` re-exports it, which is the path
this package imports through.
