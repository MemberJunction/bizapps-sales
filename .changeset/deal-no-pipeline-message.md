---
"@mj-biz-apps/sales-ng": patch
---

A deal with no pipeline now says why it cannot be saved and what to do: its company has no pipeline (choose another company, or ask a Sales admin to link one), no company has a pipeline, or, with pipelines hidden, choose a company. The Stage panel shows the same warning before saving, the Company picker stays available when the deal's company has no pipeline, and the save lists the problem once instead of also reporting "Pipeline ID cannot be null" and "Company ID cannot be null".
