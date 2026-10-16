---
"@mj-biz-apps/sales-ng": patch
---

The Sales section reads the grids' saved view once per load, alongside its other reads, instead of twice in a row after them; inspect slice clicks no longer read it again.
