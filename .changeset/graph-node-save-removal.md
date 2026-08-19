---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-integration-tests": minor
---

Drop the graph-node guard from `DealEntityServer.Save()`, which no longer compiles
against MJ `next`.

MJ removed `EntitySaveOptions.IsGraphNodeSave` in `47ff71d68b` so application code
cannot skip companions through a public flag, and moved the node path to a private
`BaseEntity.saveAsGraphNode`. The graph now executes every node — root included —
without re-entering the public `Save()`, so the double-call the guard existed for
cannot happen and `Save()` runs exactly once per save.

Adds SD17, which pins that on the composite path: a deal saved together with its
lines must consume exactly ONE deal number. SD11 only ever covered childless deals,
which never build a save plan at all, so nothing was watching the graph path.
