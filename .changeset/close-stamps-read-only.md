---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

An open deal no longer reads "Closed" because someone typed a date into Actual Close Date (#252). Actual Close Date, Closed At and Closed By are now read-only on the deal form, and the deal save refuses a write to them except from `Sales.CloseDeal` and `Sales.ReopenDeal`. Expected Close Date moved from the Commercial panel to the Pipeline panel, next to stage and probability, and the header labels an open deal's date "Expected close". The close fields carry descriptions saying which date is which.
