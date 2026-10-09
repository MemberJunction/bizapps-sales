---
"@mj-biz-apps/sales-ng": patch
---

The Sales section no longer spins forever when a load request fails. A failed read (a gateway 504, a timeout, a dropped connection) now clears the spinner and shows the reason with a Retry button on the dashboard, All deals and Board pages.
