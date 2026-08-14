---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

Phase 2 — the family's app layout, deal numbering, and a committed integration suite

**`/app/sales` now reads as an app.** A section shell matching bizapps-contracts and bizapps-orders —
`mj-page-layout` > `mj-page-header` > `mj-page-body` row > `mj-left-nav` + one `mj-page-body-interior` —
with three rail pages: a dashboard, a deal roster, and the workspace. Every roster row opens that deal
in the workspace, which closes the Phase 1 gap where a deal could be created but never re-opened. The
information architecture is declared as data in `nav/sales-nav.model.ts`, so adding a section later is a
nav item plus a resource rather than a change to a component.

Nothing new needed vendoring: every shell primitive ships in `@memberjunction/ng-ui-components`, already
a peer dependency. `mj-workspace-card` remains the only vendored component.

**Deals are numbered `DEAL-{seq}` on insert.** A singleton `DealSequence` counter plus an atomic
`spAssignNextDealNumber`, matching contracts' and orders' singletons rather than accounting's
per-company-per-fiscal-year scope — a ledger number must name its legal entity and year, an internal
deal handle should be short and globally unique. The number is taken inside the caller's transaction, so
a rolled-back save releases it and the series stays gap-free, and it is never regenerated: a deal number
travels to contracts, orders and people's email.

**`Sales.SaveDeal` now has a committed integration suite** — `save-deal`, SD1–SD12, against a live
database with nothing mocked. It covers the three-table transaction, the pipeline-derived company, the
owner stamp derived from `DealTeamMember`, the `Resolved*` columns staying NULL, the signed `Total`
stored verbatim, complete-set line semantics, numbering and gap-freedom, and the structured refusal
shape. Each check rolls back, so the suite is re-runnable and leaves no rows.

`RUN_MUTATION_TESTS=1` is mandatory and the guard is inside the runner: selecting zero checks exits
non-zero with an explanation instead of reporting a pass for having done nothing.
