# `metadata/entities/` — form chrome and search settings

Nothing here creates an `Entity` row; CodeGen creates one per table. Two files fill in columns on those
rows:

- `.form-chrome.json` — `Entity.Configuration`, the JSON that decides how a generated form is laid out.
  The rest of this README is about it.
- `.entities.json` — which entities and fields the user search API covers (`AllowUserSearchAPI`,
  `IncludeInUserSearchAPI`) and HOW each searchable field matches (`UserSearchPredicateAPI`:
  `Contains`, `BeginsWith`, `EndsWith` or `Exact`), with the `AutoUpdate*` flags off so CodeGen
  leaves them as set. The predicate is the difference between finding a record by a word in the
  middle of its name and only from the start, so it is worth setting deliberately: `Contains` for
  a name a person types a fragment of, and a narrower one for a code, a slug or a number, where a
  shared prefix would otherwise match every row (golive#359). Pinning
  `AutoUpdateUserSearchPredicate: false` matters as much as the value — without it CodeGen rewrites
  the predicate whenever the column's type, length, precision, scale or nullability changes. On `Deals`
  it also sets `BaseViewGenerated: false` and `GeneratedBaseViewName: vwDealsGenerated`, the layered
  base view `V202609202353__v6.4.0__Predictive_Deal_Win_Fields.sql` creates. On `Deal Stage Events` it
  sets `AllowUpdateAPI` and `AllowDeleteAPI` to false: stage events are append-only (`docs/DECISIONS.md`
  D-SE1).

## What is set, and why only these knobs

`Configuration.UI.Form` accepts `Layout` (`accordion` | `left-nav` | `auto`), `AutoLeftNavAt`,
`RelatedRolePolicy` (`keep-all-primary` | `smart`) and `PrimaryRelatedBudget`. The sibling file
`metadata/entity-relationships/.form-chrome.json` sets `inclusion` (`Primary` | `More` | `None`) and
`FormRole` per relationship.

**Every Sales entity except `Deal Stage Events` is configured here.** Layout is metadata; it does not
belong in a component. `Deal Stage Events` stays at the generated default because it is a child record
opened from a parent, not a composing surface. `Deals` is first-class: `Layout: left-nav`.

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
(`ToStageID` and `FromStageID`). Those four entries are the ones to preserve if the relationship file is
ever trimmed.
