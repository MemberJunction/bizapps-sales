---
"@mj-biz-apps/sales-ng": minor
---

A new deal starts on its company's default pipeline, and a `HidePipelines` Sales application setting
hides pipelines across the app.

A new deal opened with the default company in the Company picker and no pipeline, so the rep had to
pick one. It now takes the company's default pipeline: the `IsDefault` pipeline when it is linked to
the company, otherwise its lowest `DisplayRank`.

`HidePipelines` ships as "false". Set to "true" in MJ's Application Settings, choosing a deal's company
always puts the deal on that company's default pipeline, and the Pipeline control, the Pipeline filter,
the Pipeline grid column and the Pipeline stats are gone. The board and the Open deals by stage card
name each tab by the companies its pipeline serves.
