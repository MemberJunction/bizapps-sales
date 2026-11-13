---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
---

A deal team row saved or deleted on its own can no longer leave an open deal with no owner: deleting, deactivating or re-roling the last active Owner row is refused with a message pointing at the Owner field (#568). The owner stamp now credits only an active owner row. The Sales Account's Contacts panel gains "Link person", which links an existing Sales Contact to the account (#443). Adds an integration check that Close Won refuses an unanswered line whose product inherits its subscription type (#504).
