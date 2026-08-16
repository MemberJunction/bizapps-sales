# UI architecture audit — #89 Phase 5

Audited against **`bizapps-accounting/docs/ui-architecture.md`**, the pattern source named in the rework
plan §5. Date: 2026-08-16. Scope: every hand-authored TypeScript file in `packages/Angular`, plus the
shared entity subclasses and the entity-server code they call into. Generated code is excluded — CodeGen
owns it, and editing it is forbidden.

The audit is written as findings, not as a checklist, because two of the four results are only meaningful
with their reasoning attached.

---

## 1. The `ResultType: 'entity_object'` sweep — **clean**

This is the hazard the plan flagged, and the one accounting's guide spends the most words on: `RunView<T>`
takes a caller-supplied `T` with **no relationship to `ResultType`**, so handing an entity type to a
`'simple'` read compiles perfectly and is wrong at runtime — no `BaseEntity` is constructed, and the raw
database shape comes back.

Every `RunView` call site in Sales, outside generated code and tests:

| Call site | `T` | `ResultType` | Verdict |
|---|---|---|---|
| `deal-form.component.ts:87` | `{ LocksDeal, Name }` | `simple` | ✅ structural row type |
| `deal-form.component.ts:125` | `{ __mj_UpdatedAt }` | `simple` | ✅ structural row type |
| `deal-workspace.service.ts:265` | `ProductLookup` | `simple` | ✅ plain interface, not an entity |
| `DealEntityServer.ts:334` | `PipelineCompanyRow` | `simple` | ✅ plain interface |
| `deal-entity.ts:261` | `DealRoleIDRow` | `simple` | ✅ plain interface |

**Not one entity type is passed to a `'simple'` read.** Every call asks for cheap rows and declares a
row-shaped type to match, which is exactly the guide's "reach for `'simple'` only when you want cheap rows
for an aggregate and will treat them as raw database output".

Sales reads whole entities through `GetEntityObject` + `Load` and through declared Related Record
Collections — not through `RunView` — which is why the entity-object case does not appear at all.

**No N+1.** No `RunView` occurs inside a `for`, `forEach`, `while` or `.map()` anywhere in the audited set.

## 2. One real defect, found by this audit and fixed in it

`deal-form.component.ts` typed `__mj_UpdatedAt` as `string` and compared it as one.

MJ v6 returns real `Date` objects where v5 returned ISO strings, and **this repo has already been caught by
that once** — commit `7e55bae`, *"dates arrive as Date, not string — the Sales UI assumed string"*. The
declaration would have compiled forever and been wrong the moment anyone used the value as a string.

It is now `string | Date`, with the reasoning recorded at the call site. `new Date()` accepts either, so
the comparison was already safe; the *type* was the lie. Worth noting because it is the same class of bug
as the sweep above — a caller-supplied type that TypeScript cannot check against runtime reality — and it
was introduced by new code written in this very phase.

## 3. Service layer — **correct, and worth stating why**

The guide's test: *"If a method on it loads, saves, validates or maps entity data, it is in the wrong
place."* `DealWorkspaceService` does load and save, so it deserves the scrutiny.

It passes, because it does not *implement* any of it:

- `LoadDeal` calls `GetEntityObject` + `Load` + `LoadRelatedRecords` and returns the entity. No DTO.
- `Save` calls `deal.Save()`. The transaction, the stamps and the lock are the entity server's.
- `deal-workspace.validation.ts` exposes `ProjectValidation(result: ValidationResult)` — it **projects**
  the entity's own result into a UI shape. It re-implements no rule. The rules live on `DealEntity`, which
  is where the guide puts them, and they run identically in a script or a server job.

Applying the review test directly — *could a non-Angular host do this same work with the same objects?* —
the answer is yes for everything the service touches. What it holds beyond that is Angular-shaped state,
which is what a service is still for.

`LoadProducts` is the one method that queries on its own behalf, and it is a lookup for a picker: cheap
rows, structural type, no entity semantics. That is UI-shaped work.

## 4. The one thing this phase could not do, recorded rather than hidden

**Per-field read-only is not expressible.** `BaseFormComponent` exposes `EditMode` (whole form),
`Validate()` and `SaveRecord()`; there is no field-level hook. MJ metadata has no field-level UI config
either — the upstream JSON contracts cover entities and relationships, and there is no
`IEntityFieldConfiguration`.

`AllowUpdateAPI = 0` looks like the metadata answer and is not: it is CodeGen's *omit-from-`spUpdate`*
flag, used today only for `ID` and the `__mj_*` timestamps. Setting it on a business field would remove
that field from `spUpdateDeal` and break the server code that legitimately writes it — the pricing stamps
and the close stamps are written by exactly that path.

So the three custom forms move the refusal forward to `Validate()` and name the field, rather than forking
a generated template to grey fields out. A fork would drift from CodeGen on the next run, which trades a
visible limitation for an invisible one.

**This is the one item worth raising upstream**: a field-level read-only hint in `EntityField` would let
every app express "the server owns this" declaratively, and would retire all three of these subclasses'
read-only halves.

---

## Verdict

| Area | Result |
|---|---|
| `ResultType` / entity-object hazard | ✅ clean, all five call sites correct |
| N+1 child loops | ✅ none |
| Service layer holding entity logic | ✅ none — projection only |
| Date shape (v6 `Date` vs v5 string) | ⚠️ one defect found **and fixed** in this pass |
| Per-field read-only | ⛔ not expressible today — upstream gap, documented |

No further remediation outstanding. The upstream gap in §4 is a suggestion, not a blocker.
