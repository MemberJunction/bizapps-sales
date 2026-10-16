---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

Every company can have its own pipeline, and the pipeline pickers filter by company.

A deal sells as its pipeline's company, and the app seeds its pipelines on one placeholder company, so a deal for any other company had no pipeline with the current stages. The new `Sales.CopyDefaultPipelineToCompanies` Action copies the default pipeline (the one marked `IsDefault`) and all of its stages onto every company that has no pipeline with the same Code. Each company's copy saves in one transaction, the copies are not marked default, and a second run skips companies that already have the pipeline, so it can run again after a company is added.

The deal form, the deal workspace and the board gain a Company control that narrows the pipeline list to that company, with the default pipeline's company first. Choosing a company moves the deal to that company's first pipeline. Each pipeline option names its company, for example "B2B (Acme)". Within a company, its copy of the default pipeline comes first and legacy pipelines follow. The control is hidden when one company owns every pipeline.

The seeded stages now look up their pipeline by ID instead of by Code, because the copies share the Code and MetadataSync resolves a lookup to the first matching row.

`PipelineOption` (deal form) and `PipelineLookup` (workspace) now carry `Code`, `IsDefault` and `DisplayRank`.
