---
'@mj-biz-apps/sales-ng': patch
---

The deal form's Payment schedule panel shows the scheduled total and the remainder against the deal amount whenever the deal has instalments, and one sentence explaining a gap: an amount not yet scheduled, an amount over the deal, or an instalment with no date or no amount above zero. Amounts are compared in whole cents, so a schedule one cent off shows as off. Display only; orders' own check still decides whether the schedule reaches the order.
