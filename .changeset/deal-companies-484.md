---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

A deal can involve several companies (golive #484). New `DealCompany` link table, backfilled from each deal's company and its order lines' companies. The deal server adds the billing company and every line's company to the list on save. The deal form has a Companies panel above "What's being sold"; a deal with no billing company takes the first company listed.
