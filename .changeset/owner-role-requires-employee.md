---
"@mj-biz-apps/sales-core-entities-server": patch
---

A deal team row in the owner role must name an Employee. Saving one that names a Person is refused with a message pointing to the Employee field, instead of saving and leaving the deal with no owner.
