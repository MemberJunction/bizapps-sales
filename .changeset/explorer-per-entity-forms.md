---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-ng': minor
'@mj-biz-apps/sales-integration-tests': minor
---

Per-entity Explorer forms (#89 P3) — metadata for layout, three subclasses for behaviour.

Nineteen of the twenty-two Sales entities get their form chrome from metadata
(`metadata/entities/.form-chrome.json` plus the relationship file). Layout is data; it does not belong in
a component. Those files are **committed but not yet applied**: `Entity.Configuration` does not exist on
the MJ version this repo pins, so they land when MJ is upgraded. `metadata/entities/README.md` names the
two upstream migrations that add it.

Three entities have a hand-authored form, registered at **explicit priority 2** rather than relying on
bundler import order, and only because behaviour — not layout — required it:

- **Deals** refuses a locked edit before the round trip and says which fields are frozen, and warns when
  `Deal.Amount` predates the lines it claims to describe. The lock's field list now lives in ONE place,
  `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`, read by both the form and `DealEntityServer.Save()`. New check
  **CD14** pins it in both directions, so the constant cannot drift from the wall it protects users from.
- **Deal Lines** refuses edits to the pricing provenance, using the same list the entity server refuses.
- **Deal Stage Events** refuses edit mode outright — the record is append-only.

Honest limitation, recorded rather than papered over: `BaseFormComponent` has no per-field read-only hook
and MJ metadata has no field-level UI config, so these forms cannot grey individual fields out. They move
the refusal to the moment of saving and name the field, instead of forking a generated template that would
drift on the next CodeGen run.
