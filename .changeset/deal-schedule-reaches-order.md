---
'@mj-biz-apps/sales-core-entities-server': patch
---

A deal's payment schedule now reaches its order. At Close Won the deal's rows are sent to orders' `Orders.ReplacePaymentSchedule`, which writes one order instalment per deal row, numbered by due date; a deal with no rows leaves the order's schedule alone. If orders refuses (a row with no date or amount, or rows that do not add up to the order) the close is refused with orders' message. After Won, every change to the deal's schedule is sent again, whether it is saved with the deal or as a single row from the form's grid. Instalments the order has already invoiced cannot change: a deal edit that changes or removes one is rolled back with a message naming it. While the deal's rows are incomplete or do not add up to the order, the deal edit is kept, the order keeps its previous schedule, and the save says so; the order updates as soon as the rows tie again. Requires bizapps-orders with `Orders.ReplacePaymentSchedule`.
