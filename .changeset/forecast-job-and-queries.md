---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

The §9 read models, the ForecastSnapshot daily job, and a cancelled meeting that was being stored as
Completed.

Two branch heads had moved past what the previous integration captured, and between them they carried
both halves of #40. The 13 MJ Queries now ship as metadata under `metadata/queries/` with their SQL, and
the ForecastSnapshot daily job runs behind a query seam with FS1–FS10 covering it.

**The D-25 fix is a live bug, not a refinement.** A cancelled Outlook meeting was being ingested with
`Status: 'Completed'` — so a meeting that did not happen appeared in the activity history as one that did,
and any measure counting completed meetings counted it. `CK_Activity_Status` already allowed `'Cancelled'`,
so the fix needed no new vocabulary. `activities.AC18` asserts it.

92 checks across 9 bundles, 0 failed, 0 skipped.
