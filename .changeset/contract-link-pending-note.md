---
"@mj-biz-apps/sales-entities": minor
---

A won close no longer warns that the order was not linked to the contract when the installed bizapps-contracts is too old to have order links.

That case is not a failure: the deal closed, and the contract and order both exist. The close now reports it as a note ("Contract link pending ... linked automatically once contracts is upgraded"), shown with an info icon and muted text on the Deal form's close and status panels and in the deal workspace. A link that contracts refuses to save is still a warning.

`SalesCloseSeverity` gains `'info'`: something the close could not do yet that needs nobody's action. It never blocks. `ContractsSeamResult` gains an optional `Pending` flag that a seam sets for that case. Callers that switch on severity should handle `'info'`.
