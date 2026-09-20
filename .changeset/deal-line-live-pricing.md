---
'@mj-biz-apps/sales-ng': minor
---

The add-product dialog shows what the line comes to, before it is saved.

Unit price and line total sat blank under a caption reading "Priced by Orders", which a rep reasonably took to mean the price should already be there. The values were not missing: `UnitPrice` and `LineTotalNet` are resolved by `OrderPricingService` during the ORDER's save, so on a line still being composed they do not exist yet.

Sales may not work them out — multiplying quantity by price here would be the second implementation of pricing that the first rule in `CLAUDE.md` exists to prevent. So the dialog asks **`Orders.PriceOrder`**, which runs that same service and persists nothing. One implementation, so the figure on screen and the figure in the ledger cannot drift.

This was not possible until recently. The earlier `Orders.PreviewOrder` ran the real save inside a transaction that always rolled back, firing the whole booking walk — journal entries, subscription decisions, entitlement grants — on every keystroke and discarding all of it. Orders withdrew it and shipped `PriceOrder`, the decide step without the write, which is what makes asking cheap enough to do while somebody types.

It re-asks on every priced input (product, quantity, discount, term start), debounced: a quantity of 12 passes through 1 on its way there, and pricing each is a chance to show a figure for a number nobody meant.

**Nothing is written to the line.** These are display values; the order's own save resolves the real ones. Writing them here would make the dialog a second author of a priced figure, stale the moment the rep changed anything.

**No failure blocks the save.** An unreachable operation, a refused pricing run, or a thrown call all show "It is priced on save" and leave the figures unknown. Refusing to let a rep record what they sold because a pricing call timed out would not be honest about which of the two matters.

The two-layer result is checked: the envelope says the operation RAN, `Output.Success` says pricing worked. The test for that was written vacuously first — a failed output with no lines produced the same result either way, so a mutation dropping the inner check survived it. It now supplies a refused run that still carries a figure, which is the only shape that tells the two apart.
