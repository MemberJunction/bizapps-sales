---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

A stage's probability and forecast category are now applied on the write path, not only in the workspace.

`ApplyStageDefaults` lived in `DealWorkspaceComponent` and ran from the stage picker, so a stage set by an
agent, an Action, the S6 HubSpot importer or any API caller got neither value: the pipeline designer's
answer sat unused in the stage row while the deal landed with whatever the caller supplied, or null. The
same shape as the order provisioning that used to live in the workspace — a rule the UI enforces is a rule
only the UI obeys.

It now runs in `DealEntityServer.saveWithinScope`, on the same `PipelineStageID` trigger and in the same
transaction as the order-status writer, the stage event and the amount cache.

**It fills; it does not overwrite** — the amount cache's rule. A value the caller stated in this save is
theirs; one they did not state is the stage's to supply. The two cases are asked differently because
`Dirty` does not mean the same thing on a new record as on an update, and `board-move.BD2` caught the
version that ignored that.

`BD5` proves the defaults arrive through the entity layer with no UI involved; `BD6` proves a stated
probability survives while the field the caller left alone still fills. Mutants `M-BD1`, `M-BD2`, `M-BD3`.
