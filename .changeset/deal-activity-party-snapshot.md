---
"@mj-biz-apps/sales-core-entities-server": patch
---

When DealLinker attributes an activity to a deal, also snapshot the deal's Account (Organization) and Primary Contact (Person) as `LoggedFor` links. Reverse lookup on Person/Org survives a later contact or employer change.
