---
'@mj-biz-apps/sales-core-entities-server': patch
---

A deal created already in a locking status (Won or Lost) no longer gets an empty Draft order. The close lock reads the persisted status, which a create does not have, so a deal born closed used to pass as unlocked and receive an embedded order it would never use, consuming an order number. The save now checks the incoming status on a create. An order the caller built before the first save (lines added in the same save) is still provisioned. A deal created open, or with no status, gets its order as before.
