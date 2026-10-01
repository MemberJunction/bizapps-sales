---
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-server': patch
---

Add the nightly `Sales.DetectWonDealsWithUnconfirmedOrders` Action and its scheduled job (golive #279,
type 3). It reads `MinDaysSinceClose` from accounting's `WON_DEAL_ORDER_NOT_CONFIRMED` exception type,
runs `Sales: Won Deals With Unconfirmed Orders`, and raises one finance exception per deal through
`Accounting.RaiseFinanceExceptions`, with the deal owner's linked login as creator. Skips when the type
is missing or inactive; a refused raise fails the run. When the owner's login cannot be resolved the
summary names the owner, since accounting shows it when refusing to clear the row. The job ships
Disabled; the new query `Sales: Deal Owners Without a Linked Login` lists owners to link before
enabling it. New exports only; no schema change.
