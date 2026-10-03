---
'@mj-biz-apps/sales-entities': patch
---

The 6.10 upgrade no longer fails on hosts whose Deals `PredictedWinRiskBand` field was created outside V202609202353. Migration V202609291800 inserted that field's four values against the field ID V202609202353 pins, but V202609202353 only inserts the field with that ID when no field of that name exists yet. A host that already had the field under another ID failed on `FK_EntityFieldValue_EntityField`, which `mj app upgrade` reports as "Transaction has been aborted". The migration now resolves the field by entity and name, and skips a value the field already has.
