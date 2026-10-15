---
"@mj-biz-apps/sales-ng": patch
---

The deal form's Payment schedule grid lists instalments by payment date.

The grid asked for no sort, so instalments came back in storage order. It now sorts by payment date, then by Display Order within a date. Undated instalments ("on execution") list first on SQL Server and PostgreSQL alike, which put NULL dates at opposite ends when left to themselves. A rep can still re-sort by clicking a column header. The deal workspace's schedule tab keeps entry order.

The grid's default columns are now Payment Date, Amount and Description. With none set, it showed the first ten fields, including Deal ID and Display Order. Display Order stays available from the column chooser.
