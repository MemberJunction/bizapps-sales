---
'@mj-biz-apps/sales-ng': patch
---

**A customer or contact created from the deal workspace is linked under the ID that was actually written.** On MJ 6.1.x, creating an IsA child (`SalesAccount`, `SalesContact`) over GraphQL writes it under a server-minted key while `Get('ID')` keeps reporting the browser's unwritten key, so the deal could be bound to a customer that does not exist and refused on save. The workspace now reads the new record's key from `PrimaryKey`, which carries the written value. Fixes #188.
