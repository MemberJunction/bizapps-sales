---
"@mj-biz-apps/sales-ng": patch
---

The deal's line dialog:
- Cancel on an existing line now undoes the edit. Before, the change stayed in memory and the deal's next save wrote it to the order.
- Closing the dialog with X or the backdrop after a discount notice now refreshes the line cards and the deal's Amount, as Done does.
- A blank, zero or negative Quantity is no longer priced as one unit. The dialog shows no figures, says "Enter a quantity greater than 0." and blocks Save. Fractional quantities stay allowed.
- With "Add as next term" chosen, Term start shows the start orders will use (the day after the existing coverage ends) read-only, and the subscription prompt's dates use the same format as the line cards.
