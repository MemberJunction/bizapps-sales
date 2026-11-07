---
'@mj-biz-apps/sales-ng': minor
---

The Deal form's Account picker finds a sales account by its acronym as a starts-with match, and shows
the acronym next to the website domain under the name ("NAR · nar.realtor"). Migration
`V202611061900` refreshes `vwSalesAccounts` and the Sales Account procedures to carry the Acronym
inherited from Organization (Common 5.57+) and registers its field, so saving a Sales Account no
longer fails with "Cannot query field Acronym".
