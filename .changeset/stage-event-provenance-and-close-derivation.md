---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-entities": minor
---

DealStageEvent gains AmountAtTransitionIsComputed, close-won tasks get a due date, and a close derives its
closing stage. Adds two migrations (the column plus the view rebind it needs), so this is a minor bump
under the repo's migration rule.
