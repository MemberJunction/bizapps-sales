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

The dashboard and the deal form move onto the same day. `TodayUtc()` rolled over at UTC midnight, so
from 19:00 Central the fiscal window, the close buckets and the inspect lists were already on
tomorrow — and once the picker was fixed they disagreed with it on the same screen. The deal form's
close countdown, its close clock and its next-step-overdue flag measured from the UTC day for the
same reason, so a deal closing today read "1 day overdue" all evening.

New: `ProductWindowCovers(from, to, day)` on `sales-entities` — the TypeScript reading of the same
availability rule `ProductFilterFor` emits as SQL, for a caller holding the window's two columns.
It exists because the integration check that derives PP2's expectation open-coded that comparison
against a `DATE` column returned as a `Date`, where `String(value).slice(0, 10)` is `'Thu Aug 13'`:
every windowed product fell out of the expectation and `AvailableTo` never bound anything.

Breaking for direct callers: `ProductFilterFor(asOf: Date)` is now `ProductFilterFor(asOfDay:
CalendarDay)`, `DealWorkspaceService.LoadProducts(asOf?: Date)` is now
`LoadProducts(asOfDay?: CalendarDay)`, and `TodayUtc()` is removed in favour of `BusinessToday()`.
The last one is a rename rather than an alias on purpose: a name stating a zone it no longer uses is
worse than a compile error.

Requires `@mj-biz-apps/common-entities` 5.44.0. The whole `@mj-biz-apps/common-*` family is now
pinned EXACTLY at `5.44.0` across every manifest (`common-entities`, `common-ng`,
`common-activity-sync`). A caret range on any one of the three re-splits the family — each publishes
an exact dependency on `common-entities` of its own version — and two copies of `common-entities`
means two `BusinessTimeZoneEngine` classes competing for one class-name key in `BaseSingleton`'s
global store, which makes the resolved zone depend on import order.
