---
'@mj-biz-apps/sales-ng': patch
---

**A customer or contact created from a deal form field is linked under the ID that was actually written.** The "Create new" footer on the deal form's Account, Primary Contact and Billing Contact fields selected the new record with `Get('ID')`, which on MJ 6.1.x returns the browser's unwritten key for an IsA child (`SalesAccount`, `SalesContact`). The deal then pointed at a record that does not exist and the save was refused as "does not exist". The deal field panels now rebind the field to the key from `PrimaryKey`, the same read the deal workspace uses since #188. Fixes #202.
