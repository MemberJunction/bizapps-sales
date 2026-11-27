---
"@mj-biz-apps/sales-ng": minor
---

The dashboard's default deal list follows the selected period (golive #489): it lists the open deals expected to close in the period, soonest first, and its title names the period ("Open deals expected to close this quarter"). The fixed "closing in the next 30 days" list is gone; the Expected to close card's buckets cover the near term. An old link with `inspect=closing` opens the new default. `ClosingSoon` is replaced by `ClosingInPeriod(deals, window)`, and `InspectDayBounds` loses `ClosingEnd`.
