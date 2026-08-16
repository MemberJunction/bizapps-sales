---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-entities': minor
---

S4 close flow: `Sales.CloseDeal`, `Sales.ReopenDeal` and the close lock.

Closing a deal is now one atomic transaction that validates what the close requires, resolves the
effective `CloseWonPolicy`, routes lines downstream, and stamps the close with an append-only
`DealStageEvent`. The path is resolved from `DealStatusType` flags — `IsWon`, `IsLost`, `LocksDeal` —
and routing from the pipeline's policy; no name is compared anywhere, so a deployment can rename its
statuses and pipelines without changing what a close does.

The close lock is enforced in `DealEntityServer.Save()` rather than the UI, so an Action, an agent and a
raw `BaseEntity.Save()` all hit the same refusal. `Description` and `NextStep` stay editable per §7.3,
and `Sales.ReopenDeal` is the only exit — it requires a reason and preserves the close in the event log.

**The lock covers the CHILD COLLECTIONS as well as the header**, which matters because a deal's lines are
exactly what the contract and the order were derived from. `Lines`, `PaymentSchedule` and `Team` are
companions rather than fields, so they never appear in the entity's field list — a lock built only on
dirty fields would refuse a renamed deal and accept a deleted line, the more damaging of the two. Any
dirty companion now refuses the save, enumerated generically so a collection added later is protected
without anyone remembering to add it.

The check is keyed on the **persisted** status, so the closing transition itself may still carry final
collection state: a close that writes its last line is legal, and editing that line tomorrow is not.

The downstream seams to orders and contracts are typed and STUBBED: neither sibling is reachable yet.
`StubDownstreamSeam` reports the real blocker instead of a fabricated record ID, and the routing intent
is preserved in the stage event's notes. `SetDownstreamSeam()` is the swap point.

No schema change — every column §7 stamps already existed.
