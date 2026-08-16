---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

Closing a won deal now creates a real, booked order.

The D-CF3 seam was written against `Orders.CreateOrderInState`, transcribed from `origin/mjdev/orders-flow`.
That branch never merged: orders' `next` ships eleven operations and **no create-order operation of any
name**. Orders' own canonical creation path is the entity graph — `OrderEntityServer.Save()`, which is what
`order-builder.ts` drives — so sales now creates the order exactly the way orders does, and orders' server
code mints the number, prices the lines and posts them to the ledger.

`PreviewOrderMoney` delegates money to `Orders.PriceOrder`, which accepts a draft with no `OrderHeaderID`
and so prices something that was never persisted. Sales sends `ProductID`, `Quantity` and a requested
discount; it sends no price, and there is no arithmetic in the handoff.

The seam selects itself from the DEPLOYMENT: live when orders' entities are registered, stub when they are
not. Sales still installs standalone — `DealLine.ProductID` remains a soft reference and no sales package
imports orders' TypeScript. `Orders.PriceOrder` is invoked by ClassFactory key, a string.

The deal→contract path (D-CF4) stays stubbed and clearly marked. Contracts is not in the workspace, so it
cannot be proved end-to-end, and half-wiring it would be worse than leaving it honest.

New `close-won-handoff` bundle (CW1–CW4), verified 4/4 against a live six-app host: the order is created and
its number minted by orders, its lines carry the picker-set `ProductID`s, every line is priced by orders'
engine and posted to a journal entry, and the booked total equals an independent `Orders.PriceOrder` preview
of the same draft. Held out of the default gate, like `product-picker`, because it requires orders.
