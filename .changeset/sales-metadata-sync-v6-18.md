---
'@mj-biz-apps/sales-entities': minor
---

The 6.18 Metadata_Sync ships the new SQL of Forecast History, Slipped Deals and Stage Conversion and Dwell, which judge their date bounds on the business day and survive RecordChange rows that are not JSON, and sets AllowUpdateAPI and AllowDeleteAPI to false on Deal Stage Events. It has a Postgres counterpart.
