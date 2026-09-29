---
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-ng': patch
---

The Deal form's Pipeline Stage control offered every stage in the system, and nothing on the server
checked that the stage belonged to the deal's pipeline (golive #291).

`<mj-form-field>` renders a foreign key as an unfiltered dropdown off the related entity, so Stage
listed D2C's three stages and sixteen legacy pipelines' alongside B2B's six. A B2B deal could be
positioned in another pipeline's process — and the mismatch did not sit inert, because
`applyStageDefaults` then took that stage's probability, forecast category and status.

Pipeline and Stage are now dedicated controls: Stage lists only the chosen pipeline's stages and
clears when the pipeline changes, the way the deal workspace has always behaved and the way this same
panel already handled Status for golive #205. The form does not write `CompanyID` — the server forces
it from the pipeline on every save — and picking a stage does not write its defaults, which would
destroy a rep-typed probability before the server saw it.

`DealEntityServer.Save()` now refuses a stage that belongs to a different pipeline, so imports and
Actions are covered too. It refuses rather than corrects, unlike the company stamp beside it: a wrong
company has one derivable right answer, a wrong stage has none. Keyed on either half moving, so an
existing deal whose pair already disagrees — converted deals sit in legacy pipelines (#257) — is not
blocked from unrelated edits.

No schema change.
