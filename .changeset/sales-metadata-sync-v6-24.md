---
'@mj-biz-apps/sales-entities': minor
---

Release seed for 6.24: `V202611061330__v6.24.x__Metadata_Sync.sql` and its PostgreSQL counterpart carry this release's metadata to hosts, which install by migration and never read `metadata/`: the `Sales.RecordDiscountConcession` remote operation's input type gains the optional `ConcessionID`, so a resend after a timeout finds the concession the first attempt wrote.
