---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-entities": patch
---

A deal whose status row is absent is now locked (#103).

The close lock treated a status read that succeeded and found no row as "does not lock", so a closed
deal whose `DealStatusType` row had gone became fully editable. It now locks, with the ordinary
editable set of a deal that is not lost, the same as a failed read. `ResolveDealLockState` reports the
same to the form and workspace, with its own notice.

The deal can still be repaired: its status may be set to an open one as an ordinary save. Closing it
from the missing status is refused, both by a status write and by `Sales.CloseDeal`, because nothing
says whether it was already closed. `Sales.CloseDeal` now also refuses when the deal's current status
cannot be read at all.
