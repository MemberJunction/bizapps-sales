# Activity ingest → the Common Activity Sync Engine

**Status:** draft, blocked on bizapps-common. **Nothing has been deleted from this repo yet.**

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

`@mj-biz-apps/common-activity-sync` is unpublished, and the `ActivitySyncExtension` entity has not
been through CodeGen in Common. **This branch does not build**, deliberately: it exists so the
shape can be reviewed before the engine lands, and so the work is not lost.

**The dependency is deliberately NOT declared in `packages/CoreEntitiesServer/package.json` yet.**
Declaring an unpublished, non-workspace package does not merely fail the build — it fails
`pnpm install`, so the whole repo becomes un-installable and no other work can proceed in that
checkout. A branch nobody can install is worse than one that does not compile. So the import in
`DealLinkerExtension.ts` is unresolved on purpose: `pnpm install` succeeds, the vocabulary gate
runs and can actually check this code, and the only failure left is the honest one — a missing
module. Add the dependency at step 2 below, when there is something for it to resolve to.

Deleting the working ingest before its replacement is published would leave this repo broken with
no way to verify the replacement. So the order is fixed:

1. bizapps-common#93 merges and publishes (P1–P5 there).
2. Sales bumps to that version; `pnpm install` resolves.
3. `DealLinkerExtension` compiles; its registration row is added to `metadata/`.
4. **Then** the migrated files are deleted and `Sales.SyncActivities` + its `ScheduledJob` retire.
5. Integration checks AC1–AC13 split: the generic ones move to Common, the deal-specific ones stay
   here and cover the extension.

## Entity name — confirmed

`MJ_BizApps_Common: Activity Sync Extensions` (ID `37aca09a-df6e-4a81-a519-690b425884ed`), verified
by CodeGen against bizapps-common#93 on a fresh database. The guess was right, so the registration
metadata can be written against that name once Common publishes.

The rest of the new Common entities, for reference:

- `MJ_BizApps_Common: Activity Sync Provider Types`
- `MJ_BizApps_Common: Activity Sync Rule Sets`
- `MJ_BizApps_Common: Activity Sync Connection Rule Sets`
- `MJ_BizApps_Common: Activity Sync Exclusions`
- `MJ_BizApps_Common: Activity Sync Runs`
- `MJ_BizApps_Common: Activity Sync Run Details`
