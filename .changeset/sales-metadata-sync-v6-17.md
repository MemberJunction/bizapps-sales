---
'@mj-biz-apps/sales-entities': minor
---

The 6.17 Metadata_Sync ships the D2C Lost stage's pipeline by the seeded pipeline's ID, so a host where an earlier `mj sync push` attached the stage to another company's copy of D2C gets it back on the seeded pipeline. It has a Postgres counterpart.
