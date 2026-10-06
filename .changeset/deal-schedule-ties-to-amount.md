---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

The Deal form's Payment schedule panel shows what it has scheduled against the deal's amount, and a deal whose schedule does not tie can no longer be closed Won.

The panel accepted instalment rows and compared them with nothing: a schedule a penny short of the deal saved with no total, no remainder and no warning. It now shows a running total beside the deal amount whenever there are rows, and the sentence explaining the gap when there is one. `Sales.CloseDeal` refuses a Won close on the same reading, in wording shaped after orders' check at confirm.

At Close Won the deal's rows are copied onto its order, one to one, under the order's company, as `Scheduled` instalments numbered from one. An order that already carries a schedule is left alone, so reopening a deal and closing it again does not double it.

Rows the order could not take are refused at close: `OrderHeaderPaymentSchedule.DueDate` and `.Amount` are NOT NULL while the deal's are nullable, and its check constraint requires an amount greater than zero. A 0.00 instalment is the case worth naming, since it ties harmlessly and would still have failed the copy.
