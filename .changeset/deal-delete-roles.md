---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

Deleting a deal works, under rules. A deal can be deleted only while it is open and has never been closed, and only when its order is not Confirmed. Holders of `MJ.BizApps.Sales.Deal.Delete` (new Sales Admin role, and Developer) can delete any such deal; holders of `MJ.BizApps.Sales.Deal.DeleteOwn` (new Sales User role) only deals they own. The deal's team, contacts, payment schedule and stage history are removed with it, and its order is deleted through orders, all in one transaction. A refused delete now says why instead of failing on a foreign key, and the Deal form shows that reason instead of "Error deleting record". New metadata: the two roles, the two authorizations, their grants, and delete permissions for both roles on Deals and on the order entities a draft order's delete removes.
