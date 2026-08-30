# Activity ingest → the Common Activity Sync Engine

**Status:** common#93 is on `next`. This PR declares `@mj-biz-apps/common-activity-sync` and
registers `Sales.DealLinker`. Old ingest under `src/activities/` stays until the replacement is
the live path. **Nothing has been deleted from this repo yet.**

Sales owns a working activity ingest in `packages/CoreEntitiesServer/src/activities/`. It writes
into **bizapps-common's** entities (`Activity`, `ActivityLink`) and is driven by **Common's**
`ActivitySyncConnection` / `ActivitySyncRule`. It is good code and it is in the wrong repository:
marketing, tasks or any other sibling can only reuse it by depending on sales.

The engine is therefore being promoted into Common — a generalization of this work, not a rewrite.
Design of record: **[MemberJunction/bizapps-common `plans/activity-sync-engine.md`]** and PR
**MemberJunction/bizapps-common#93**.

## What moves, and what stays here

| Today, in `src/activities/` | Destination |
|---|---|
| `ActivitySource.ts` (the port) | → `BaseActivitySyncProvider` in Common |
| `MSGraphActivitySource`, `MSGraphCalendarSource`, `GraphMessageMapper` | → Common provider plugin |
| `ImportedGraphActivitySource`, `FixtureActivitySource` | → Common |
| `RelevanceFilter` | → Common, as qualification stage 2 |
| `ActivityWriterService` | → Common's writer |
| `ActivityIngestService`, `ActivitySyncJob` | → `ActivitySyncEngine` in Common |
| `ActivityReader` | → Common, or stays; it is a read model |
| **`DealMatcher`** | **stays.** Which deal an item belongs to is sales' question, asked against sales' entities and sales' `DealStatusType.IsOpen` flag. Common must never learn what a deal is. |
| `Sales.SyncActivities` action + its hourly `ScheduledJob` row | → Common ships the action; sales' row retires |

## What replaces the sales-owned pipeline

One file: `src/activities/DealLinkerExtension.ts` — `Sales.DealLinker`, a
`BaseActivitySyncExtension` that Common's engine runs **inside the Activity write transaction**.
It calls the unchanged `DealMatcher` and adds a `Regarding` link per matched open deal.

Two properties worth keeping when this is finished:

- **A failed read is not "no matches."** `DealMatchResult.ReadFailed` exists because both cases
  produced an empty array, and a database blip was once filed as "involves a known contact but
  matches no open deal" — an item reported as considered when it had not been looked at. The
  extension throws on `ReadFailed` and lets the registration's `FailurePolicy` decide.
- **Several deals is a correct outcome**, not a tie to break. Choosing one would hide the message
  from the other, and choosing well would mean reading it — a model call, after the stage where
  those are allowed has closed.

## Why nothing is deleted yet

Common#93 merged to `next`. `@mj-biz-apps/common-activity-sync` is declared in
`packages/CoreEntitiesServer/package.json` at `5.36.0`. Local M5 links the workspace package;
npm publish of common + sales together is release work. Sales-only CI will not resolve the
module until that publish. The registration row is `metadata/activity-sync-extensions/`.

Deleting the working ingest before its replacement is published would leave this repo broken with
no way to verify the replacement. So the order is fixed:

1. bizapps-common#93 merges and publishes (P1–P5 there).
2. Sales bumps to that version; `pnpm install` resolves.
3. `DealLinkerExtension` compiles; its registration row is added to `metadata/`.
4. **Then** the migrated files are deleted and `Sales.SyncActivities` + its `ScheduledJob` retire.
5. Integration checks AC1–AC13 split: the generic ones move to Common, the deal-specific ones stay
   here and cover the extension.

## Entity name — confirmed

`MJ_BizApps_Common: Activity Sync Extensions` (ID `c7e5ece1-f347-4bc9-ac53-e2f33577b449`), verified
by a single CodeGen pass on bizapps-common#93 (`V202608291500` applied end-to-end on a fresh
database). The name guess was right; use this ID when writing the registration row once Common
publishes. The previous ID `37aca09a-…` was from an earlier generate and does not ship.

The rest of the new Common entities, for reference:

- `MJ_BizApps_Common: Activity Sync Provider Types`
- `MJ_BizApps_Common: Activity Sync Rule Sets`
- `MJ_BizApps_Common: Activity Sync Connection Rule Sets`
- `MJ_BizApps_Common: Activity Sync Exclusions`
- `MJ_BizApps_Common: Activity Sync Runs`
- `MJ_BizApps_Common: Activity Sync Run Details`
