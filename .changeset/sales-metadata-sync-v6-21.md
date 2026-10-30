---
'@mj-biz-apps/sales-entities': minor
---

Release seed for 6.21: `V202610300200__v6.21.x__Metadata_Sync.sql` and its PostgreSQL counterpart carry this release's metadata to hosts, which install by migration and never read `metadata/`: the new "Sales: Owner Rows Held by a Person" query with its parameter, fields and query entities; the new SQL of Bookings by Period, Deal Type Mix and Slipped Deals, with the fields and query entity they add; the `Sales.RecordDiscountConcession` remote operation (golive #340); and the Contains search on the Name fields of Deals, Sales Accounts, Pipelines, Pipeline Stages, Deal Types, Deal Status Types and Deal Roles, Deals searchable by account and by number (golive #359), and the Sales Accounts default contact labels. Every create is guarded on its ID or key, so a host that already pushed this metadata is untouched.
