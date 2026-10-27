---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Sales now requires bizapps-common 5.51.0 or later, in `mj-app.json` and in every package's common peer range. Deal Cycle Time and Won Deals With Unconfirmed Orders call common's `fnBusinessDayOf`, which 5.51.0 added, so an install on common 5.49 or 5.50 passed the check and then failed both reports (#406).
