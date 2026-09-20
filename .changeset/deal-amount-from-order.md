---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-ng': minor
---

Adding a product now updates the deal's amount and weighted amount.

`Deal.Amount` is a cached copy of its order's `TotalGross`, refreshed only during a DEAL save. The line dialog saves the ORDER, so adding a product left the deal reading no amount and no weighted amount while its order carried a real total. Measured on a test deal: order `TotalGross` 229, deal `Amount` NULL, and no subsequent save able to move it.

**The guard was a bootstrap failure, not a missing poll.** `amountMayHaveMoved` tested `order.Dirty`, `order.Lines.Dirty` and `AmountIsComputed === true` — and the last is what `refreshAmountFromOrder` *stamps* once it has cached a figure. A deal that never had one is false on all three, permanently; by the time anything saves the deal, the order the dialog committed is clean.

The added term is `Amount === null` — the unbootstrapped state itself, not a comparison between the two figures. It costs one read per save for exactly that state and stops as soon as a figure is cached, because `AmountIsComputed` then carries it.

It does **not** reintroduce polling, which the note in `Save()` rejects for good reason. A header-only deal with a typed amount is non-null and never read; one with no amount reads an order whose `TotalGross` is NULL — `SUM` over no rows — and `refreshAmountFromOrder` returns without touching a column. Drift caused by someone editing the order directly is still not chased here; that remains what `AmountSourceHash` is for.

**And the deal is saved when a line commits**, so the figure appears while the rep is looking at it rather than after some later unrelated save. A full save rather than a targeted amount write: `Amount` has one author — `refreshAmountFromOrder`, where the provenance stamps are set together — and a panel reaching in to write it is how a cached figure and its fingerprint start disagreeing. The stated cost is that other unsaved edits commit with it, which is the right answer while composing.

Neither half works alone. The guard without the seam only takes effect on some later save; the seam without the guard runs a save that refreshes nothing.

The guard's decision table is reproduced in tests rather than extracted — changing code to suit a test is its own problem — and a second test reads the shipped expression and asserts every term of it, so the copy cannot drift from the original unnoticed.
