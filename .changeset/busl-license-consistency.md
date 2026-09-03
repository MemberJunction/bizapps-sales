---
'@mj-biz-apps/sales-actions': patch
'@mj-biz-apps/sales-ng': patch
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-server': patch
---

License declarations now agree on BUSL-1.1 everywhere.

The Open App manifest (`mj-app.json`) declared `"license": "ISC"` and the README badge
advertised ISC, while `LICENSE` and every `package.json` declared BUSL-1.1. The manifest is
what an MJ deployment reads on install and the badge is the first thing a reader sees, so
between them they were the repo's loudest license statement — and the wrong one. The badge
now links to `LICENSE`.
