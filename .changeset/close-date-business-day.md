---
'@mj-biz-apps/sales-core-entities-server': patch
---

A deal closed through `Sales.CloseDeal` now records `ActualCloseDate` as the business day it closed on, read from `BusinessTimeZoneEngine` for the deal's company, instead of the UTC day (bc-aidp-next-golive#168). Before, a deal closed in the evening Central (from 6 PM, 7 PM in daylight time) was stamped with the next day, so a win on a month's last evening counted in the next month's bookings and win rate. Existing rows are not rewritten. The close-won tasks' `DueAt` now counts `DueInDays` from that business close day (`ActualCloseDate`) rather than from the UTC day of `ClosedAt`, so after an evening close a five-day task is due five days after the close date rather than six. The contracts seam input also carries `ExecutionDate` and `StartDate` as `YYYY-MM-DD` rather than the server's local rendering of the date.
