---
"@mj-biz-apps/sales-server": patch
---

Logging an activity on a deal works again for users who are not Owners. MJ 6.1.6 runs an action through `RunAction` for Owners only unless the action authorizes its caller, so Log Activity now does: it refuses a deal the caller cannot read, and saves the activity with the caller's own permissions.
