---
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-ng': patch
---

A customer or contact created from the deal workspace is now bound only under an id the lookup or a server read shows to exist. Previously, when the lookup reload missed the new row, the workspace bound the id the slide-in reported, which has been measured to be an id that was never written; the deal's first save then failed inside its order on `FK_OrderHeader_BillToOrganization`.

The server now refuses a deal save that names a customer or primary contact the database does not hold, with a message naming it, instead of a raw SQL error from the embedded order. The workspace re-reads its customer and contact lists after a failed save so the rep can pick again without reloading the page.
