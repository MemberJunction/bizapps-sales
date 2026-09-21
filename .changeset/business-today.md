---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
---

Product availability and forecast periods are judged on the business day (bc-aidp-next-golive#168).

`ProductFilterFor` took an instant and chose the UTC day inside, so at 8 PM Central a product
available from tomorrow was already offered and one whose last day was today had already gone. It now
takes a calendar day — validated before it is interpolated into SQL — and `LoadProducts` passes today
in the instance's business time zone from bizapps-common's `BusinessTimeZoneEngine`, defaulting to it
rather than to `new Date()`.

`CurrentMonthPeriod` chose the month with `getUTCMonth()`, so a nightly forecast job running in the
evening of the last day of a month had already rolled over to the next one and the closing month was
never snapshotted. It now takes an optional zone (UTC by default, which is what every existing caller
gets) and `RunForecastSnapshot` passes the business zone. The re-run guard compares `CapturedAt` on
the business day for the same reason.

The period BOUNDARIES are unchanged and deliberately so: `PeriodStart`/`PeriodEnd` are `DATE` values,
which are calendar days, and they are still built and read as UTC midnight. A zone conversion applied
to a stored day moves it back one day west of Greenwich.

The deal workspace's date boundary (`ToDateInput` / `IsUnparseableDate` / `FromDateInput`) delegates
to the shared calendar-day helpers with its contract unchanged and its tests untouched; it is now
also strict about days that do not exist, so a stored `2026-02-30` reports as unreadable instead of
rendering an empty box.

Breaking for direct callers: `ProductFilterFor(asOf: Date)` is now `ProductFilterFor(asOfDay:
CalendarDay)`, and `DealWorkspaceService.LoadProducts(asOf?: Date)` is now
`LoadProducts(asOfDay?: CalendarDay)`. Requires `@mj-biz-apps/common-entities` 5.43.0, which
`sales-ng` and `sales-entities` now declare.
