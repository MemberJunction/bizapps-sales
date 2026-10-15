---
"@mj-biz-apps/sales-core-entities-server": patch
---

A pipeline can no longer lose its last active won stage or its last active lost stage.

A close moves a deal into the active stage on its pipeline whose status declares the outcome. A new server-side `PipelineStageEntityServer` refuses a stage save or delete that would take that stage away: deactivating it, giving it a status that does not declare the outcome, moving it to another pipeline, or deleting it, when no other active stage on the pipeline declares the same outcome. The refusal names the pipeline and the outcome.

Pipelines that never had such a stage are not blocked; a close on them still succeeds and warns that the deal stayed in its stage.
