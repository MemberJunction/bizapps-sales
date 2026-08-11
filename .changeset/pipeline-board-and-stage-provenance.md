---
'@mj-biz-apps/sales-ng': minor
'@mj-biz-apps/sales-core-entities-server': minor
---

Pipeline board, and stage-transition provenance behind it.

A **Board** page joins Dashboard / All deals / Workspace in the Deals rail. Columns are the selected
pipeline's `PipelineStage` rows in `DisplayOrder`, with a pipeline switcher; cards are the deals in each
stage and open in the workspace exactly as a roster row does. Column headers show a count and a
`SUM(Deal.Amount)` of stored amounts — summed over deals, never over `DealTeamMember`, and nothing is
priced.

Dragging a card moves the deal and applies the target stage's probability and forecast defaults, which
stay editable. **`Sales.SaveDeal` now appends an append-only `DealStageEvent`** whenever it sees the stage
change, stamping the amount and probability the deal held *on the way out* — the save and the append share
one transaction, so a move cannot land without its provenance.

A drag **never** closes a deal: a stage whose `DealStatusType.LocksDeal` is set refuses drops and says
why, and closing remains the explicit `Sales.CloseDeal`. No orders or contracts seam is invoked.

Uses `@angular/cdk/drag-drop`, already this package's drag primitive for workspace tab reordering — MJ has
no generic kanban component at v5.51.0 despite the docs listing one. No schema change; every column
already existed.
