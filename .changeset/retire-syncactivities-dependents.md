---
"@mj-biz-apps/sales-entities": minor
---

Unblock the Sales.SyncActivities retirement so 6.1.0's Metadata_Sync migration can apply.

`V202609020700` retires Sales.SyncActivities with three core deletes. Those cannot succeed on any
host where the job has actually run: every FK into `__mj.ScheduledJob` and `__mj.Action` is
NO_ACTION, and the blocking columns are NOT NULL so the rows cannot be unlinked either. On AIDP
stage the job had 158 `ScheduledJobRun` rows and its action 158 `ActionExecutionLog` rows, and the
upgrade failed at batch 17/18 on `FK_ScheduledJobRun_ScheduledJob`.

Adds `V202609020650`, numbered *before* `V202609020700` so that file stays byte-identical and no
migration checksum changes. It clears the retired job's and action's own run history, and stops
with an explicit message — rather than a raw FK violation — if that history is itself referenced
by other run records. Data-only, so no CodeGen output to append. Idempotent.
