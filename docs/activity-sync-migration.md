# Activity ingest → the Common Activity Sync Engine

**Status:** common#93 is on `next`. Common#94 is the engine actually invoking extensions, plus
`Common.SyncActivities`. This sales PR is P6: `Sales.DealLinker` only. There is no
`Sales.SyncActivities`.

Sales used to own a working activity ingest. That pipeline now lives in
`@mj-biz-apps/common-activity-sync`. When Common syncs a connection, the engine writes the
Activity and runs registered extensions **inside that write transaction**. Sales' remaining
half is which deal an item belongs to.

## What moved, and what stays here

| Was in `src/activities/` | Destination |
|---|---|
| Sources, Graph mapper, fixture, RelevanceFilter, ingest, job | Common `ActivitySyncEngine` |
| `ActivityReader` | **stays.** Deal-timeline read model |
| `ActivityWriterService` | **stays.** Manual "log an activity" from the workspace pane |
| **`DealMatcher` / `Sales.DealLinker`** | **stays.** Common never learns what a deal is |
| `Sales.SyncActivities` + hourly ScheduledJob | **retired.** Common owns the trigger (`Common.SyncActivities`) |

A known contact on no open deal is still filed (against the person, no `Regarding`). That is S-US10.

`@mj-biz-apps/common-activity-sync` is declared at `5.36.0`. Local M5 links the workspace package.

## Entity name — confirmed

`MJ_BizApps_Common: Activity Sync Extensions` (ID `c7e5ece1-f347-4bc9-ac53-e2f33577b449`).
Registration row: `metadata/activity-sync-extensions/`.
