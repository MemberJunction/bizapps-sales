---
'@mj-biz-apps/sales-entities': minor
---

The 6.26 Metadata_Sync ships the HidePipelines Sales application setting ("false"), so a host that upgrades by migration gets it as one that ran `mj sync push` does. It is create-only: a host that already has the setting keeps its value. It has a Postgres counterpart.
