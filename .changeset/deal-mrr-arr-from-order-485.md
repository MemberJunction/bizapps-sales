---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
---

A deal's MRR and ARR now come from its order, beside Amount (golive #485). Each deal save that refreshes Amount from the order's total also copies the order's recurring monthly and annual totals onto MRR and ARR. Those totals arrive with the orders release that adds `OrderHeader.RecurringMonthlyTotal` and `RecurringAnnualTotal`; on a host running an older orders release, MRR and ARR stay as typed. Once a deal's amount comes from its order, Amount, MRR and ARR are read-only on the deal form and a save that types one is refused; a deal without products keeps all three typed.
