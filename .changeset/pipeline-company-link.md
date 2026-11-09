---
"@mj-biz-apps/sales-entities": minor
---

A pipeline can serve several selling companies. The new `Pipeline Companies` entity links a pipeline
to each company that sells through it, with `IsActive` to retire a link without touching existing
deals; `Pipeline.CompanyID` is removed. Every existing pipeline is linked to the company it had.

A deal's company is now the rep's choice: the company is picked first and the pipelines offered are
the ones actively linked to it. The server refuses a deal whose company is not linked to its pipeline,
instead of copying the company from the pipeline. Pipeline lookups by company resolve through the
link table.
