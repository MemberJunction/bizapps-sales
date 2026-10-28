---
"@mj-biz-apps/sales-core-entities-server": patch
---

`DealNotWonConfirmVeto` now validates the shape of an id before it reaches a filter string, throwing when it is not a record id, instead of doubling quotes and reading on. Its sibling `DealLockOrderLineVeto` already did this: ids reach both vetoes from Orders, so neither treats them as its own. The confirm still fails closed, because the caller turns the throw into a refusal naming the fault (review nit on #191).
