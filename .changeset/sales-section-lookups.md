---
'@mj-biz-apps/sales-ng': patch
---

The Sales section no longer loads every account and contact when it opens. It reads only the pipelines, stages and status types the board and the status pill use; the deal workspace still loads every lookup list. `DealWorkspaceService.LoadLookups` takes an optional list of lookup names, and its reads are defined once per name, so a result can no longer land in the wrong list.
