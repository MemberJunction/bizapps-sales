---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-entities": minor
---

A pipeline can be flagged out of the forecast (bc-aidp-next-golive#257).

New column `Pipeline.IncludeInForecast` (default 1). When it is 0, that pipeline's open deals are left
out of `Sales: Pipeline Summary`, `Sales: Forecast by Category`, `Sales: Forecast by Owner`,
`Sales: Dashboard Summary` and the dashboard's forecast stack, funnel, close buckets and open counts. The
daily forecast snapshot reads `Sales: Forecast by Category`, so it follows. Won and lost deals in the
pipeline still count toward bookings, win rate and the closed figures, and the board still shows the
pipeline. Passing the pipeline's ID as `PipelineID` includes it.

Previously no query read `Pipeline.IsActive`, so there was no way to keep a pipeline that holds
historical deals out of the live forecast.
