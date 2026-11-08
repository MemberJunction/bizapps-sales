# Upstream asks not yet filed

Open asks of other repos that have no GitHub issue yet. File each in the owning repo, then delete its
section. Checked against each repo's `next` on 2026-10-11.

Filed from this file on 2026-10-11:

- [bizapps-contracts#95](https://github.com/MemberJunction/bizapps-contracts/issues/95): a fresh install
  has no Published contract template, so close-won contracts are refused. Until it is fixed,
  `scripts/dev/seed-contract-template.sql`, run by `scripts/seed-demo-data.sh`, adds a demo template;
  without it, `close-won-contract` CT6 and CT7 fail.
- [MJ#5494](https://github.com/MemberJunction/MJ/issues/5494): `mj dev workspace doctor` does not report a
  linked package whose `dist` is missing or older than its `src`. Until then, build every member before
  starting Explorer.

The ask that Communication's received messages carry a direction and Bcc is drafted in
[`upstream/MJ-communication-message-no-bcc-no-direction.md`](upstream/MJ-communication-message-no-bcc-no-direction.md).

---

## MJ CodeGen — the only field in a form section renders without a label

Not filed yet.

`generateSectionHTMLForAngular` emits `[ShowLabel]="${section.Fields.length > 1 ? 'true' : 'false'}"`
(`packages/CodeGenLib/src/Angular/angular-codegen.ts:863`), so a section holding one field shows it with
no label: for example `Status`, alone under "Audit & Status" on the generated AI Agent Actions form. 114
fields in MJ's generated forms on `next` render this way. Sales' generated forms have none.

**What we need:** emit the label always, or hide it only when the section name is the field's own
display name.
