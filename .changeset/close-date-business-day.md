---
'@mj-biz-apps/sales-core-entities-server': patch
---

A deal closed through `Sales.CloseDeal` now records `ActualCloseDate` as the business day it closed on, read from `BusinessTimeZoneEngine` for the deal's company, instead of the UTC day (bc-aidp-next-golive#168). Before, a deal closed after about 7 PM Central was stamped with the next day, so a win on a month's last evening counted in the next month's bookings and win rate. Existing rows are not rewritten. The contracts seam input also carries `ExecutionDate` and `StartDate` as `YYYY-MM-DD` rather than the server's local rendering of the date.
