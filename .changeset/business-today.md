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

Requires `@mj-biz-apps/common-entities` 5.44.0, declared as `^5.44.0` — a floor with an upper
bound, not an exact pin — in every manifest that names the `@mj-biz-apps/common-*` family
(`common-entities`, `common-ng`, `common-activity-sync`).

An exact pin is what a SIBLING app must not use here, and that is measured rather than assumed. The
family self-pins in lockstep: `common-ng@X` and `common-activity-sync@X` each declare
`common-entities@X` EXACTLY. So a caret on all three is coherent — whichever version the resolver
settles on, it drags `common-entities` to the matching one, and there is one copy. What splits the
family is an exact `common-entities` held at one version while a sibling floats: orders ships
`orders-ng`/`orders-core-entities-server` declaring `common-ng >=5.44.0` and `common-entities
>=5.44.0`, so a host installing sales beside orders can resolve `common-ng` 5.46.0, which hard-requires
`common-entities` 5.46.0 — irreconcilable with an exact 5.44.0, and the resolver nests a second copy.
Two copies of `common-entities` is two `BusinessTimeZoneEngine` classes competing for one class-name
key in `BaseSingleton`'s global store, which makes the resolved zone depend on import order: this
release's own defect, arriving through the dependency graph instead of the code.

That is bc-aidp-next-golive#258 in a different package. There, sales pinned `orders-entities` exactly
at 5.13.0 while orders shipped 5.14.0; no resolver can satisfy two different exact pins from one copy,
the nested copy re-ran every module-scope `@RegisterClass` in it, and `OrderNumber` stopped being
minted. A sibling's exact pin is correct only while its number happens to equal the owner's, and
nothing maintains that equality. The owner of a package may pin it exactly; a consumer in another repo
should declare a range and let the owner's pin win.

`@mj-biz-apps/orders-entities` is `^5.14.0`, which arrived from `next` in #126 — the same rule applied
to the package where golive#258 actually happened. That pin belongs to that fix, not this one; this
branch only carries it through the merge.

`pnpm.overrides` holds all three `common-*` members at 5.44.0 for THIS workspace and CI. Exact is
right there and wrong in a manifest for the same reason: overrides are not published. It forces a
single copy where a manifest range only permits one, it pins the version the 637-test suite is
actually measured against, and all three move together so a caret can never pair `common-ng` 5.46.0
with `common-entities` 5.44.0. What travels to a consumer is the range in each `package.json`, which
is what lets a host dedupe instead of nesting.

The deal form's Overview panel now configures `BusinessTimeZoneEngine` in its own `ngOnInit` rather
than relying on MJ's startup sequence having reached a lazily loaded `sales-ng` chunk. The engine fails
open to UTC by design, so an unconfigured read is not a neutral default — it is silently the defect
this release fixes, with one logged warning nobody reads.
