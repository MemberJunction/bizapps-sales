---
"@mj-biz-apps/sales-entities": minor
---

Release seed for the confirmed-orders check: `V…__v6.28.x__Metadata_Sync` creates the `Sales: Confirmed Orders Missing Agreement` query with its fields, parameters and query entities, and sets its approved fingerprint while it has none. Every record is create-only, guarded on its ID or key, so a host that already has the query keeps its copy. It has a Postgres counterpart.
