---
"@mj-biz-apps/sales-entities": minor
---

The v6.28.x Metadata_Sync resolves the "Sales: Confirmed Orders Missing Agreement" query's category to this app's own Sales category (its ID first, then by name). It looked the category up by name alone, which fails with "Subquery returned more than 1 value" on a database holding two categories named Sales, so 6.28.0 could not install there. The migration has not been applied anywhere, so it is corrected in place. The Postgres counterpart gets the same lookup.
