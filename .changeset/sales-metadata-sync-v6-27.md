---
"@mj-biz-apps/sales-entities": minor
---

Release seed for the deal-delete permission model: `V…__v6.27.x__Metadata_Sync` creates the `MJ.BizApps.Sales.Deal.Delete` and `.DeleteOwn` authorizations, the Sales User and Sales Admin roles, their read and delete permissions on Deals, and the grants (Sales User → DeleteOwn; Sales Admin and Developer → Delete). Every record is create-only, guarded on its ID or natural key, so a host's existing roles and later changes are kept. Assigning users to the roles is left to each host.
