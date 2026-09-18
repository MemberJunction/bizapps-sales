---
'@mj-biz-apps/sales-ng': patch
---

Show where an order came from, on the order form's header.

A UAT tester opened an order that had been raised from a deal and found nothing on it saying so
(`bc-aidp-next-golive#227`). The header names the status, type, company, dates and parties, and no
part of it pointed back at the deal that caused the order to exist, or at the contract that deal
produced.

A row of chips now sits above the order header: the **Deal**, and the **Contract** reached through
that deal. It is `bizapps-related-chips` from `@mj-biz-apps/common-ng` — the shared row built for
`golive#225` precisely so orders, sales and contracts would stop each solving a slice of this
differently — so the rules about when a chip must not be drawn at all come from there: nothing for
an entity this host does not have or this user cannot read, nothing for a record that is not there,
and never a raw id where a name belongs.

**Sales owns an order-form panel because the link only exists in one direction.** `Deal.OrderID` is
a foreign key into orders and `Deal.ContractID` a soft reference into contracts; `OrderHeader` holds
neither, and `mj-app.json` has sales depending on orders and contracts with neither depending on
sales. So the knowledge that an order HAS a deal is this app's, and the panel is contributed onto
the order form through MJ's `before-fields` slot rather than built into an app that must not know
this one exists. The orders repo is unmodified.

**One read, and the contract is why.** The chip row can find a record from a filter as happily as
from an id, so the deal chip alone would need no read here. The contract is a second hop — order →
deal → contract — that the row cannot take on a caller's behalf, and the only alternative would be a
filter carrying a subquery across into the sales schema. The panel reads the deal once for both ids
and hands over two ordinary forward links.

Which relationships an order has lives in `order-related-links.ts` as plain functions, testable
without Angular DI, the same split `deal-related-links.ts` and common's own `related-links.ts` use.
Both chips are ungated, unlike the deal form's: the order already exists and is being looked at, and
where it came from does not become truer at a later status.
