---
'@mj-biz-apps/sales-entities': patch
---

The D2C pipeline's Lost stage now finds its pipeline by the seeded pipeline's ID, like every other stage in `metadata/pipeline-stages/`. A lookup by `Code` could attach it to another company's copy of D2C on a later `mj sync push`, since every company's copy shares the Code.
