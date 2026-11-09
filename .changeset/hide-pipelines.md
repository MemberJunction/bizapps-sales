---
"@mj-biz-apps/sales-ng": minor
---

A new deal starts on its company's default pipeline, and a `HidePipelines` Sales application setting
hides pipelines across the app.

A new deal opened with the default company in the Company picker and no pipeline, so the rep had to
pick one. It now takes the company's default pipeline: the `IsDefault` pipeline when it is linked to
the company, otherwise its lowest `DisplayRank`.

`HidePipelines` ships as "false". An administrator turns it on from the new Settings page in Sales
(listed for users who can edit MJ's Application Settings), or in Application Settings itself. With it on, choosing a deal's company
always puts the deal on that company's default pipeline, and the Pipeline control, the Pipeline filter,
the Pipeline grid column and the Pipeline stats are gone. The board and the Open deals by stage card
name each tab by the companies its pipeline serves. With one pipeline, the board names no pipeline or company at all.

A company's default pipeline links are read oldest first, so when the default pipeline is linked to
every company, a new deal still starts in the company it was first linked to.

`scripts/consolidate-pipelines.sql` moves every deal onto one pipeline, links that pipeline to every
company and retires the others, for a site turning this on. It is a dry run unless run with `Apply=1`.
