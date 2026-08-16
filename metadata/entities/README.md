# `metadata/entities/` — form chrome

One column, on rows CodeGen already created: `Entity.Configuration`, carrying the JSON that decides how a
generated form is laid out.

## ⚠️ COMMITTED BUT NOT YET APPLIED

**`.form-chrome.json` cannot be pushed against the MJ version this repo currently pins.** `__mj.Entity`
has no `Configuration` column on that version and `MJ: Entities` has no such registered field, so a push
fails on a field that does not exist.

Form chrome arrives in two upstream MJ migrations:

- `V202608141412__v6.1.x__Entity_And_EntityRelationship_Configuration.sql` — adds the columns
- `V202608151200__v6.1.x__Form_Chrome_Rules.sql` — the ranking rules

Both are newer than our pin. **These files are authored, reviewed and committed so they apply the moment
MJ is upgraded** — the work is done, only the push is waiting. Do not delete them as "unused"; run:

```bash
npm run mj -- sync push --dir metadata
```

once the host has those migrations, and verify in the Explorer rather than assuming.

## What is set, and why only these knobs

`Configuration.UI.Form` accepts `Layout` (`accordion` | `left-nav` | `auto`), `AutoLeftNavAt`,
`RelatedRolePolicy` (`keep-all-primary` | `smart`) and `PrimaryRelatedBudget`. The sibling file
`metadata/entity-relationships/.form-chrome.json` sets `inclusion` (`Primary` | `More` | `None`) and
`FormRole` per relationship.

**Nineteen of the twenty-two Sales entities are configured here.** Layout is metadata; it does not belong
in a component. The three that are absent — `Deals`, `Deal Lines`, `Deal Stage Events` — have
hand-authored form components because *behaviour* required it (the close lock, and fields the server owns),
and their layout stays at the generated default **by decision, not by omission**.

**Ruled 2026-08-16: the Deal form stays a contextual record view, and gets no `left-nav` entry.** The deal
**workspace** is the composing surface — where lines are added, products picked and the roster edited. A
Deal form promoted to `left-nav` would read as a second place to build a deal, and two surfaces that must
agree forever is exactly the cost this split exists to avoid. The form's job is to show one record in
context and refuse the edits the server would refuse.

## The two things worth knowing before editing

**`autoCreateMissingRecords` is `false`.** Every record resolves its primary key with `@lookup` by NAME,
because CodeGen re-mints the `Entity` row with a new ID on every `rebuild-db`. A lookup that fails must
fail LOUDLY: with auto-create on, the push would insert a second, half-populated `Entity` row beside
CodeGen's and quietly break the next CodeGen run.

**Sales Contacts is the form that justifies the relationship file.** A contact parents `Deals` twice — as
primary contact and as billing contact — and without explicit `inclusion` both render as grids titled
"Deals", side by side, indistinguishable. Pipeline Stages has the same shape with `Deal Stage Events`
(`ToStageID` and `FromStageID`). Those four entries are the ones to preserve if this file is ever trimmed.
