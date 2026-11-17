---
"@mj-biz-apps/sales-entities": patch
---

The refusal for a discount typed between 0 and 1 now names a rounded percent ("7%") instead of floating-point noise ("7.000000000000001%"). Fixes #295.
