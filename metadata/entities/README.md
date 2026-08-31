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

**Twenty of the twenty-two Sales entities are configured here.** Layout is metadata; it does not belong
in a component. `Deal Lines` and `Deal Stage Events` stay at the generated default because they are
child records opened from a parent, not composing surfaces. `Deals` is first-class: `Layout: left-nav`.

**Ruled 2026-08-31: the Deal form is the deal.** The in-app workspace tab is retired (same antipattern
Orders and Accounting already left). Opening a deal is `NavigationService.OpenEntityRecord`. The form
gets People/Org chrome: persistent hero, Overview, organized sections, left-nav. `DealFormPolicy`
forces `Layout: 'left-nav'` so the rail appears even before this Configuration row is pushed. The
close lock still lives on the priority-2 form class because that is behaviour, not layout.

## The two things worth knowing before editing

**`autoCreateMissingRecords` is `false`.** Every record resolves its primary key with `@lookup` by NAME,
because CodeGen re-mints the `Entity` row with a new ID on every `rebuild-db`. A lookup that fails must
fail LOUDLY: with auto-create on, the push would insert a second, half-populated `Entity` row beside
CodeGen's and quietly break the next CodeGen run.

**Sales Contacts is the form that justifies the relationship file.** A contact parents `Deals` twice — as
primary contact and as billing contact — and without explicit `inclusion` both render as grids titled
"Deals", side by side, indistinguishable. Pipeline Stages has the same shape with `Deal Stage Events`
(`ToStageID` and `FromStageID`). Those four entries are the ones to preserve if this file is ever trimmed.
