---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-server': patch
---

Sales answers Orders' question about order lines, so a closed deal's lines are actually frozen.

`orders-entities` asks whether an order line may be edited — `RegisterOrderLineEditVeto` — and refuses
nothing until something registers. Nothing ever has. The seam shipped inert on purpose, because Sales
resolves `orders-entities` from npm and could not call a function that had not been published yet.
This is the app with the stake answering, and it is what closes golive#206 item 1.

**By flag, never by name.** The lock is `DealStatusType.LocksDeal`, the same flag the board, the deal
form and `DealEntityServer` already read. Won, Lost and Abandoned all lock, a deployment may add
another, and a rule matching status names would quietly stop covering it. `vwDeals` exposes
`DealStatusType` as a string and it is deliberately unused.

**The refusal names the gesture**, because the seam passes create/update/delete: *"before adding a
product"*, *"before removing a product"*, *"before changing what was sold"*. Each opens with the
sentence golive#207 settled and the deal form and workspace already use, so a rep meets one voice
across three screens rather than three descriptions of one rule.

**A lookup that cannot answer is not an approval.** A failed read throws, and
`ResolveOrderLineEditRefusal` turns that into a refusal naming the fault. Returning null would let a
frozen line change because the thing guarding it was briefly unreachable — the same trade
`DealEntityServer.readStatusLockFlags` already makes for the close lock.

**Nothing is cached, and the cost is two reads per line.** Orders asks once per line, so a fifty-line
order graph save costs a hundred round trips. A memo of the verdict would be wrong: the registry holds
one instance for the life of the process, so it outlives the truth — a deal reopened a moment ago
would keep refusing, and a deal just closed would keep allowing. An earlier draft memoed only the
order-to-deal mapping, which cannot go stale that way; it also saved nothing, because the deal row
still has to be re-read for its current status. **The test asserting the cost is what caught that.**
If the cost ever bites, the fix belongs in the seam — asking once per save — not in a cache here that
has to be right about when a deal changed.

**Where the registration lives matters.** It is called from `sales-core-entities-server`, which
DECLARES `@mj-biz-apps/orders-entities`. `sales-server` does not, and resolves that name transitively
to whatever is published — measured locally, it resolves to the npm build while the declaring package
resolves to the workspace. Putting the import in the package that owns the dependency is what makes
the version requirement honest rather than accidental.

13 tests, 7 mutations all killed: the flag never locking (the defect), every status locking, an
order with no deal falling through, each of the two failed reads allowing instead of refusing, a
hostile id reaching the filter, and the create gesture getting the wrong words.

Driven end to end against a real database as well: a real deal and the order it owns, open then
closed, with the registered vetoer — the grid path refused, the order-graph path refused, a delete
refused, Orders' own writes still allowed, and a `ContextUser` on every call.
