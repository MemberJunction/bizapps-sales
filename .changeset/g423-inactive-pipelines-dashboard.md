---
"@mj-biz-apps/sales-ng": patch
---

A deactivated pipeline stays on the Sales dashboard and board while it is kept in the forecast
(bc-aidp-next-golive#423).

`Pipeline.IsActive` now decides only whether a deal can be put in a pipeline. The Sales section's
pipeline list (dashboard Company and Pipeline filters, stage card, board) reads pipelines that are
active or have `IncludeInForecast = 1`, so a retired pipeline holding won and lost deals can be
deactivated without dropping out of the dashboard. The deal form still offers only active pipelines,
but a deal already in an inactive one keeps showing it, with its company, instead of "—".
