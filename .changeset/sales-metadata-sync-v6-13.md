---
'@mj-biz-apps/sales-entities': minor
---

The 6.12 Metadata_Sync ships the query SQL from the business-day fix (bc-aidp-next-golive#168) to hosts: `Sales: Dashboard Summary`, `Sales: Deal Cycle Time`, `Sales: Deal Roster` and `Sales: Won Deals With Unconfirmed Orders` now compare against the business day rather than the UTC day on an installed database, not only on a developer's own. It also moves Deal Roster's `PipelineIncludeInForecast` field to its position in the SELECT. It only updates rows earlier seeds created; nothing new is written to the core schema.
