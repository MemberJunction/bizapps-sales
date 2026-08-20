---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-ng': patch
'@mj-biz-apps/sales-integration-tests': minor
---

A provisioned order now takes the status its stage declares, instead of always Draft.

The order-status writer keyed on `PipelineStageID` **changing**, which is right for a move and wrong for a
birth. A deal already at or above the agreement threshold when its order was provisioned never triggered
it, so the order stayed `Draft` while its stage plainly declared `Quoted` — and the board displays that
mismatch without complaint. Found by the story audit reading the database rather than the code:
`DEAL-9003` at Proposal with a Draft order. It would have hit every open deal the HubSpot import lands
past Proposal in S6.

`_orderJustProvisioned` lets a birth ask the question a move asks. Pinned by `save-deal.SD25`, which
gives a stage an opinion, strands a saved deal without an order, and then saves it **without moving the
stage** — so a pass cannot come from a move. Mutant `M-PV2` reverts the gate and fails SD25 alone.

Also: the dashboard's `ClosingSoon` now sorts on `ExpectedCloseDate` rather than trusting the roster
query's `ORDER BY` to stay what it is today. Same output, but the comment claiming "soonest first" is
enforced by the code beneath it instead of by a clause in another file.

52 checks, 0 failed, 0 skipped. Thirty-four mutants, twenty-three isolating exactly one check.
