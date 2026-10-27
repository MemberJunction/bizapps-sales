---
'@mj-biz-apps/sales-entities': minor
---

Release seed for 6.20: `V202610230130__v6.20.x__Metadata_Sync.sql` and its PostgreSQL counterpart create the two party-lookup queries behind the Deal form's Account and Contact pickers (#475), with their parameters, fields and query entities, guarded so a host that already has them is untouched.
