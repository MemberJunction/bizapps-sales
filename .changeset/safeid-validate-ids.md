---
"@mj-biz-apps/sales-core-entities-server": patch
---

The three places that build a filter string from an id Orders supplied now validate the shape of that id and throw when it is not a record id, rather than doubling quotes and reading on. `DealLockOrderLineVeto` already did this; `DealNotWonConfirmVeto` and `DealOrderLink` now match it. Ids reach all three from another app, so none of them treats one as its own. Each still fails closed, because the caller turns the throw into a refusal naming the fault (review nit on #191).
