---
"@mj-biz-apps/sales-ng": patch
---

The order header's From row shows a "No executed agreement" warning (bc-aidp-next-golive#443) on an
order a won deal names when the deal has no contract, or its contract has no executed agreement
linked. Reversals and voided orders get no warning. Sending to Bill.com is unchanged.
