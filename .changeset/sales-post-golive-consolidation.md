---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-integration-tests": minor
---

Post-go-live sales consolidation:
- Enforce single-holder (`AllowsMultiplePerDeal = 0`) and employee-only owner (`IsOwnerRole = 1`) rules on `DealTeamMember` saves, clear `Deal.OwnerEmployeeID` when the owner row is deactivated, and block deleting a deal that has activities, tasks, or stage events.
- Record deal close and reopen transitions in the activity timeline, verify `DealID` existence in `ActivityWriterService.LogActivity`, and refusal-check `PeriodEnd < PeriodStart` in `RunSalesForecastSnapshotAction`.
- Show `WeightedAmount` on open deals and hide it on closed deals, differentiate close-stamp refusal hints (`ActualCloseDate` vs `ClosedAt`/`ClosedByUserID`), preserve the current inactive closing status in the status dropdown, and lock non-carve-out fields across all form panels when a deal is closed.
- Align dashboard, win-rate, bookings, forecast, involvement, and unconfirmed-won-order queries on `CalendarDayIn` (`BusinessTimeZone()`) and `DealStatusType` flags, format pipeline view `Amount` as currency, and compare board idle days by calendar day.
- Auto-number `DealPaymentSchedule.DisplayOrder` on insert, guard `MJSDealSchedulePanel.readRows` against out-of-order replies, and flag discounted line cards as `Discount not covered` when an earlier approval covers less than orders' current priced discount.
