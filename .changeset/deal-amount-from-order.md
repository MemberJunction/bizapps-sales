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

**And the deal save had to be forced past the dirty check**, which is what made the first two attempts look like they had changed nothing. A line save changes the ORDER; the deal's own columns are untouched, so it is not dirty — and `BaseEntity.Save()` skips the provider entirely when nothing is dirty. `FormComponent.SaveRecord()` takes no `EntitySaveOptions` and so cannot ask otherwise, so the request never left the browser and the entity server never ran. The seam calls `Record.Save()` with `IgnoreDirtyState`, still a full deal save.

**The guard also had to stop asking the wrong question.** `OrderID_Object` is the IN-MEMORY embedded order and is null on any save that did not load it — which is most of them — so an `!!order &&` prefix short-circuited every other test. The note claiming lined deals "re-read TotalGross on every save" was therefore true only when the order happened to be in memory. The dirtiness tests, which genuinely need the object, stay behind it; the state tests ask `OrderID` instead, which is all `refreshAmountFromOrder` needs.

None of the three works alone: without the forced save nothing reaches the server, without the FK-keyed guard the save refreshes nothing, and without the bootstrap term a deal that never had an amount can never acquire one.

Found by measurement rather than reading, after two confident and wrong diagnoses: deal `__mj_UpdatedAt` 00:32:43 against its order at 00:39:08 with three lines totalling 1057. A deal timestamp older than its order's says the save never ran, which no amount of studying the guard would have revealed.

The guard's decision table is reproduced in tests rather than extracted — changing code to suit a test is its own problem — and a second test reads the shipped expression and asserts every term of it, so the copy cannot drift from the original unnoticed.
