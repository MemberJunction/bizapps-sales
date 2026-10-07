---
"@mj-biz-apps/sales-ng": patch
---

The Sales section no longer spins forever when a load request fails. A read that throws (a gateway 504, a 5xx, a dropped connection) now ends the load, shows an error with a Try again button, and clears the dashboard figures instead of showing stale ones.
