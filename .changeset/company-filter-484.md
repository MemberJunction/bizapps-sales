---
"@mj-biz-apps/sales-ng": minor
---

Deal companies reach the product picker and the filter bar (golive #484). The deal line product picker lists only the products of the deal's companies, and says how many other companies' products match a search. The filter bar's Selling company and Product company lists become one Company list: a deal matches when its selling company, a company listed on it, or one of its lines' companies is selected, on the Board, the Dashboard and All Deals. The Dashboard Summary, Deal Roster and Win Rate queries apply the same rule to `CompanyIDs`.
