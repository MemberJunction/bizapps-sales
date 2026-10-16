---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Changing a deal team row's employee no longer fails with a raw SQL constraint error.

A team member is either an employee or a person, and the table enforces it. Nothing above the database did, so picking a new employee on a row whose Person was filled saved as both and came back as a CHECK constraint error, on the path the duplicate-role refusal tells a user to take.

A new shared `DealTeamMemberEntity` runs in the browser and on the server. Giving EmployeeID or PersonID a value clears the other, and `Validate()` refuses a row with both or neither with a message naming the fix. `DealTeamMemberEntityServer` now extends it, so its duplicate-role check and owner re-stamp are unchanged.
