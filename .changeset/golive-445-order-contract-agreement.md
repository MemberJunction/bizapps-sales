---
"@mj-biz-apps/sales-ng": patch
---

The order header's From row names the contract by number and status, opens its executed agreement,
or says "Awaiting signed agreement" when the contract needs one and none is linked
(bc-aidp-next-golive#445). When the deal holds no `ContractID`, the contract its close created is
found by `CreatingRecordID`.
