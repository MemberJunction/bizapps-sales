---
'@mj-biz-apps/sales-ng': patch
---

The dashboard's Stage mix card draws its bars at their real height again. A bar's percentage height had nothing definite to resolve against, so every bar fell back to its 8px minimum. Stage names now take a fixed two lines (full name on hover), so a long name no longer lifts its bar off the shared baseline.
