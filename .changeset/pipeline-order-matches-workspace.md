---
"@mj-biz-apps/sales-ng": patch
---

The Deal form orders its pipeline list by `DisplayRank`, the way the deal workspace already does.

The form listed pipelines alphabetically while `deal-workspace.service.ts` lists them by `DisplayRank ASC, Name ASC`, so a rep who uses both sees the same pipelines in two orders on any host where rank and alphabet do not coincide — and `DisplayRank` exists so a seed can say which pipeline a team reaches for first.

Every other vocabulary list in that file and in the workspace service already sorted this way; the pipeline list was the only one that did not. Stages are unchanged: a stage sequence is a process, not an alphabet.
