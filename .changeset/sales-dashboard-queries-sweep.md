---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

Sales report queries and dashboard copy:

- Deal Type Mix leaves out the open deals of pipelines flagged out of the forecast, as Pipeline Summary does (#404).
- Bookings by Period parses with MJ's SQL parser, so its Query Entities and Query Fields are recorded correctly (#417).
- Slipped Deals reports the first move's date, the last move's date and the net slip between them by when each move was made (#353).
- The dashboard's No owner queue says the deal has no employee in the owner role (#438).
