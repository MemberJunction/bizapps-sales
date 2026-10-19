---
"@mj-biz-apps/sales-ng": minor
---

The Board uses the Dashboard's filter bar, and one selection serves both pages. Period, Selling company, Product company, Pipeline and Deal owner (with My deals) are a shared component on both pages, kept in the section's URL, so switching pages or opening a copied link keeps the filters. On the Board the period bounds which closed deals the Signed and Lost columns show (open deals always show); the tabs are the pipelines the filters allow and are hidden when only one is; the Board's own Company picker is removed and its old `company` URL param is no longer read. `Sales: Deal Roster` takes a `ClosedUntil` parameter, the closed-deal counterpart of `ClosedSince`; applied with `mj sync push`.
