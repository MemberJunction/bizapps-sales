---
"@mj-biz-apps/sales-ng": patch
---

Deal hero: show the deal number on a collapsed header too (#190).

The hero's deal number was gated on the header being expanded. The deal-form UAT batch removed the
Pipeline panel's Deal Number box, which made the hero the only place the number appears anywhere on
the record form — and the header's collapsed state is a persisted per-user setting, sticky across
sessions and across every deal. So anyone who had ever collapsed the header saw no deal number at
all, which is the opposite of what #190 asks for.

Collapsing hides the briefing — account, owner, stage, next step — not the fields that identify the
record. Same reasoning already applied to the Name editor in the UAT batch.
