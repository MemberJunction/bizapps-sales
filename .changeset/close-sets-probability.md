---
"@mj-biz-apps/sales-core-entities-server": patch
---

A close now sets the deal's probability and forecast category, and a reopen puts them back.

A close declares its transition, which switches the stage defaults off, and nothing else wrote the probability, so every won or lost deal kept the figure it had while open. `Sales.CloseDeal` now writes the closing stage's probability and forecast category when that stage's status declares the same outcome, and otherwise 100 for won and 0 for lost from the status flags. The close's stage event still stamps the pre-close value.

When the pipeline has no active stage for the outcome, the close still succeeds but returns a warning naming the pipeline and the stage the deal stayed in, instead of saying nothing.

`Sales.ReopenDeal` restores the probability the close event stamped, and the forecast category of the stage the deal returns to, so a reopened deal is not left at 100 in the closed category.

The D2C pipeline gains the Lost stage it was missing (probability 0, closed forecast category, Voided on entry), matching B2B.
