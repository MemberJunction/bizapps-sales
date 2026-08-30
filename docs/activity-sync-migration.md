# Activity ingest → the Common Activity Sync Engine

**Status:** common#93 is on `next`. This PR is P6: `Sales.DealLinker` is the live in-stream
extension, the hourly job drives Common's `ActivitySyncEngine`, and the migrated ingest under
`src/activities/` is gone. Manual logging (`ActivityWriterService`) and the deal timeline
(`ActivityReader`) stay in sales.

Sales used to own a working activity ingest in `packages/CoreEntitiesServer/src/activities/`. It
wrote into **bizapps-common's** entities (`Activity`, `ActivityLink`) and was driven by **Common's**
`ActivitySyncConnection` / `ActivitySyncRule`. That pipeline now lives in
`@mj-biz-apps/common-activity-sync`. Sales' remaining half is which deal an item belongs to.

## What moved, and what stays here

| Was in `src/activities/` | Destination |
|---|---|
| `ActivitySource.ts` (the port) | `BaseActivitySyncProvider` in Common |
| `MSGraphActivitySource`, `MSGraphCalendarSource`, `GraphMessageMapper` | Common provider plugins |
| `ImportedGraphActivitySource`, `FixtureActivitySource` | Common fixture provider |
| `RelevanceFilter` | Common `KnownParticipant` stage + `IdentityResolver` |
| ingest half of `ActivityWriterService` | Common `ActivityWriter` (synced rows). Manual log still uses sales' writer |
| `ActivityIngestService` | `ActivitySyncEngine` in Common |
| `ActivitySyncJob` | **stays as a thin loop** over the engine until Common ships a scheduled action |
| `ActivityReader` | **stays.** It is the deal-timeline read model |
| **`DealMatcher`** | **stays.** Which deal an item belongs to is sales' question |
| `Sales.SyncActivities` action + hourly `ScheduledJob` | **stays**, rewired to the engine. Common does not yet ship a generic action |

## Live path

`src/activities/DealLinkerExtension.ts` — `Sales.DealLinker`, a `BaseActivitySyncExtension` the
engine runs **inside the Activity write transaction**. It calls the unchanged `DealMatcher` and
adds a `Regarding` link per matched open deal.

A known contact on no open deal is still filed (against the person, no `Regarding`). That is S-US10
and is the opposite of the old ingest, which dropped unattributed items.

The default source factory is two empty fixtures, so the hourly job is safe to ship Active.

`@mj-biz-apps/common-activity-sync` is declared at `5.36.0`. Local M5 links the workspace package;
npm publish of common + sales together is release work. Sales-only CI will not resolve the module
until that publish.

## Entity name — confirmed

`MJ_BizApps_Common: Activity Sync Extensions` (ID `c7e5ece1-f347-4bc9-ac53-e2f33577b449`).
Registration row: `metadata/activity-sync-extensions/`.
