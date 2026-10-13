---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
---

Closing a won deal links its order to the contract the close produced (`MJ_BizApps_Contracts: Contract Orders`), so contracts copies the contract's annual increase and carry-discount term to the order's subscriptions (bizapps-contracts#77). `IDownstreamSeam` gains `LinkOrderToContract`. A contracts release without order links is reported as a close warning, not a failure.
