---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": minor
---

Won deals show whether their invoices are paid (golive #487). The Deals view gains Invoices, Invoiced, Paid, Balance due, Payment status and Next payment due, read from orders' invoices: one per instalment when the order has a payment schedule, otherwise the order itself. Payment status is Not invoiced, Outstanding, Partly paid or Paid; canceled and written-off instalments are left out. All Deals shows Payment and Balance due, a shared "Won deals: payments" view lists won deals with every payment column, and the new "Sales: Won Deal Payments" query lists each invoice with the same filters as the deal roster. There is no overdue flag yet. Migration V202611170200 adds the view, the status function and the columns.
