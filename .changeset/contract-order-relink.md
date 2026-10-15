---
"@mj-biz-apps/sales-server": patch
---

A daily job links each won deal's order to its contract where the link is missing.

`Sales.RelinkWonDealOrdersToContracts` covers deals closed while the installed bizapps-contracts had no order links, and links refused at close time; the close itself never retries them. It skips, successfully, until contracts has the `Contract Orders` entity, then links every won deal that names both a contract and an order. The scheduled job ships Active at 01:00 UTC, ahead of contracts' renewal-terms sweep, and runs once on first start so an upgrade is picked up without waiting a night.
