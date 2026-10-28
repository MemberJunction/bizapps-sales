---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

Sales bug fixes:

- Close lock: a permitted edit on a closed deal no longer rewrites its Amount (#351); order lines lock when the deal's status row is missing, as the header does (#401); a save that reopens a deal and changes a frozen field says to save the status change first (#390); a Lost close takes its loss reason and notes from the caller, not from values left on the deal (#400).
- Close routing: the Contract Processing task follows the close's effective policy, overrides included. `CloseWonTaskInput.PipelineID` is replaced by `CreateContract` (#354).
- Order vetoes read Deals as the system user, so a role that may confirm orders but not read Deals is no longer refused; its refusals do not name the deal (#423).
- A stage that confirms the order holds it back with a warning while a line for a product the customer already holds has no next-term answer (#426).
- Deal form: no duplicate order-total read (#386); saving clears the stale-amount notice when only the order changed (#399); Amount, MRR, ARR and Weighted honour field-level read security (#403); an empty Pipeline shows the required underline (#416); a deal whose status row is gone can be set to an open status (#402); the closed-deal notice names Status and Forecast Category as the form labels them (#387).
- Deal lines: a term start is cleared when the product changes to a non-subscription (#374); a failed product catalogue load is shown, not an empty picker (#380); the product select explains an overridden price to reps without the price grant (#408).
- Team and contacts: picking an Employee clears the old Person's name on the row (#437); the Sales Contact form lists the accounts the contact works at (#442); the default contact fields are labelled without "ID" (#435); a new query lists owner-role rows held by a Person (#438).
- Queries: Deal Type Mix leaves out open deals of pipelines flagged out of the forecast (#404); Bookings by Period parses with MJ's SQL parser (#417); Slipped Deals takes the first and last move by when each was made (#353); the No owner queue says no employee holds the owner role (#438).
