---
"@mj-biz-apps/sales-core-entities-server": minor
---

No one can be removed from a closed deal's team until the deal is reopened. A team row deleted on its own (the Internal team grid) and a removal saved with the deal are both refused with "This deal is closed, so no one can be removed from its team. Undo the removal, reopen the deal, then remove them. Changing the owner is still allowed." Replacing the owner on a closed deal still works. Adds the exported `CLOSED_TEAM_REMOVAL` and `CLOSED_TEAM_REMOVAL_WITH_REOPEN` messages and `DealEntityServer.StandaloneTeamRemovalRefusal()`.
