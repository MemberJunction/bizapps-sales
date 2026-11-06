---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-server": patch
"@mj-biz-apps/sales-ng": patch
---

Restore the Acronym field on Sales Accounts. Sales Accounts inherit it from Organization (Common 5.57+), and the 6.24.0 generated code dropped it, so every Sales Account form failed to load with "Cannot query field Acronym". Common is now required at 5.60.0 or later, the version AIDP Next runs, so CodeGen in this repo keeps the field.
