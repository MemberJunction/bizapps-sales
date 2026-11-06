---
"@mj-biz-apps/sales-entities": minor
---

New finance control for orders invoiced without an executed agreement (bc-aidp-next-golive#443): the
query and shared Order Headers view "Sales: Orders Invoiced Without Executed Agreement" list confirmed
or invoiced orders from won deals whose deal has no contract, or whose contract has no executed
agreement linked. The order header's From row shows a "No executed agreement" warning for the same
orders. Sending to Bill.com is unchanged.
