---
'@mj-biz-apps/sales-entities': minor
---

`Metadata_Sync` for the 6.x release — the DealLinker extension registration, the pipeline view, and the retirement of `Sales.SyncActivities`.

Release seed coverage flagged 2 primaryKeys in no migration: the Activity Sync extension that
registers `DealLinker` with bizapps-common's engine, and the Sales Pipeline user view. Without the
first, a host installing from migrations gets the DealLinker code with nothing telling common's
engine to call it.

`V202609020700__v6.1.x__Metadata_Sync.sql` carries 161 records (2 created, 12 updated, 3 deleted,
0 errors), generated against a database built from migrations only — MJ core v6.1.0-edge.5, common,
tasks, accounting, orders, then this app.

**The three deletes are deliberate.** They retire `Sales.SyncActivities` (an Action, its param, and
its Scheduled Job), superseded by common's Activity Sync engine. All three were seeded by
`V202608251930__v5.2.x__Metadata_Sync.sql`, so every host on 5.2.0 has them and needs them removed;
they are declared as tombstones in `metadata/` via `deleteRecord: { delete: true }`, which is the
mechanism MetadataSync provides for exactly this.

Minor, not patch: this release carries a migration.
