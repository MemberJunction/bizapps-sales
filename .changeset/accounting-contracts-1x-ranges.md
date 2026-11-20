---
'@mj-biz-apps/sales-entities': patch
---

Accept bizapps-accounting and bizapps-contracts 1.x as well as 0.x. Both apps leave 0.x with their first release-line release (1.0.0), so `mj-app.json`'s `dependencies` on them, and the integration tests' ranges on their packages, are widened from `<1.0.0` to `<2.0.0` with the same floors. No resolved version changes. No published package declares these ranges; the change ships in `mj-app.json`, which the installer reads.
