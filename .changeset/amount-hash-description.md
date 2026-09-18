---
'@mj-biz-apps/sales-entities': patch
---

`Deal.AmountSourceHash`'s column description no longer names an action that does not exist.

Closes #107. It told the reader the UI says *"this figure is stale, reprice"*. The UI has not said that
since golive#230, and **no reprice control exists anywhere in this codebase** — the notice now reads
"The products on this deal changed after the amount was calculated. Save the deal to update it."

It matters because it is not prose. The description is a SQL extended property, which CodeGen syncs into
`__mj.EntityField.Description`, which regenerates into `generated.ts` as the **GraphQL field
description** — so a dead instruction reaches API consumers and Explorer tooltips.

**A new migration, not an edit to the baseline.** The property is set by `V202608042101`, which has been
applied to databases nobody will rebuild — the UAT host among them. Editing an applied migration changes
its checksum and Flyway refuses the run. The repo already states this: `V202609020650` was numbered
before its partner deliberately *"so no already-computed migration checksum changes"*. CLAUDE.md's
BASELINE-IN-PLACE loop is explicitly conditioned on being pre-publish, and this repo left that state at
`V202608251930`, the first `Metadata_Sync`.

**The extended property is the whole fix**, and that is measured rather than assumed:
`EntityField.AutoUpdateDescription` is 1 for this column, and the live row reads "the embedded order's
line set" — the extended property's wording, not the baseline's generated `EntityField` insert ("the
DealLine set"). The schema demonstrably wins, so the metadata row and the GraphQL description follow on
the next CodeGen run. Nothing is hand-written into `__mj.EntityField`: PUBLISHING.md reserves that for
the release `Metadata_Sync`.

Applied against a live database: the old wording is gone, the new wording is present, and a second run
is a clean no-op.

**CLAUDE.md's migration loop is corrected with it.** Its BASELINE-IN-PLACE section still read as current
instruction, and it is what this branch followed into editing an applied migration. The section now leads
with the switch, names the evidence that it had already happened — five additive migrations after the
baseline, the first publish at `V202608251930`, three weeks earlier — and keeps the original note below
as history, since its reasoning is still correct for the phase it described. The `switch to
additive-only at first publish` bullet is struck through and dated.
