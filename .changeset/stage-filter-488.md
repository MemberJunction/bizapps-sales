---
"@mj-biz-apps/sales-ng": minor
---

The Sales filter bar has a Stage list (golive #488). Stages are listed under each pipeline the Selling company and Pipeline filters allow (under the companies a pipeline serves while pipelines are hidden), each pipeline with a "No stage" entry for its deals that have no stage, and an "Open stages" button picks the listed stages whose status is open. The pick narrows every dashboard figure (Won and the win rate included), the deal lists, All Deals and the Board, where tabs and columns of stages not picked are hidden. It is kept in the URL as `stages`. `Sales: Dashboard Summary`, `Sales: Win Rate by Count and Value` and `Sales: Deal Roster` take two new optional parameters, `StageIDs` and `UnstagedPipelineIDs`.
