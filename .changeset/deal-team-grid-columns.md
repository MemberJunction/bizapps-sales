---
"@mj-biz-apps/sales-entities": minor
---

A deal's Internal team grid shows the member, role, attribution and dates instead of ID columns.

Deal Team Members had no field flagged DefaultInView, so the grid fell back to the first ten fields and showed Deal ID, Employee ID, Person ID and Deal Role ID as GUIDs. The role was visible only as an id. `metadata/entity-fields/.deal-team-member-default-in-view.json` flags Employee, Person, Deal Role, Attribution Pct, Start Date and End Date. Metadata only; no migration.
