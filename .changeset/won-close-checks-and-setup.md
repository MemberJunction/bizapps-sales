---
"@mj-biz-apps/sales-core-entities-server": patch
---

The close-won-tasks checks no longer fail when a won close reports the pending contract-link note: WT10 allows `info` notes, and WT13 finds the no-order warning by its exported wording (`NO_ORDER_ISSUE_PREFIX`) instead of a phrase the note also contains. The coverage gate expects all 18 close-won-tasks checks. The bizapps-tasks peer floor is raised to `^1.7.0` to match `mj-app.json`, and the integration tests declare the accounting, common, contracts and orders server packages the harness and demo seed load (`importSibling` now tries those declarations before scanning for sibling checkouts), so a plain install runs them without sibling checkouts. `.env.example` documents `MJ_BASE_ENCRYPTION_KEY`.
