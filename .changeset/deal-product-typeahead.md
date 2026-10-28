---
"@mj-biz-apps/sales-ng": patch
---

A deal line's product is chosen from a type-ahead (name or SKU) instead of a plain list of every product. It ranks with orders' own add-product rule, lists the deal's company first, and warns before Save when the product belongs to another company, since that company books the line's revenue (golive#360).
