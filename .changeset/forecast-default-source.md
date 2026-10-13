---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-server": patch
---

The daily forecast snapshot now writes rows. The forecast source factory defaulted to none and nothing replaced it outside tests, so every scheduled `Sales.CaptureForecastSnapshot` run reported success and wrote no `ForecastSnapshot` rows. The default now reads the `Sales: Forecast by Owner` query (exported as `DEFAULT_FORECAST_QUERY`), so each run writes one row per company, pipeline and owner for the current month. The no-source messages now say the default was replaced rather than that the queries do not exist.
