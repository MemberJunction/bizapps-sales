---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

The Deal form's Payment schedule panel shows what it has scheduled against the deal's amount, and a deal whose schedule does not tie can no longer be closed Won.

The panel accepted instalment rows and compared them with nothing: a schedule a penny short of the deal saved with no total, no remainder and no warning. It now shows a running total beside the deal amount whenever there are rows, and the sentence explaining the gap when there is one. `Sales.CloseDeal` refuses a Won close on the same reading, in wording shaped after orders' check at confirm.

Rows missing a date or an amount are refused too: `OrderHeaderPaymentSchedule` requires both while the deal's columns are nullable, so such a row cannot become an order row at all.
