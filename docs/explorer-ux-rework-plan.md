# Explorer UX rework (#89) — approach for sign-off

**Status:** proposal, for Matt (UX), Robert and Amith. **No UI was built for this** — the rework is
blocked on the approach decision below. What *has* been done is the v6/pnpm conversion (#86, done and
green) and a **mechanism validation** proving MJ 6.1 composition works for Sales (results in §6).

**The ask:** confirm the target patterns in §2, and answer the five open questions in §8 — chiefly
**which Deal relationships become composition collections**.

---

## 1. Why this rework exists

Sales was built standalone against MJ v5, before three things existed. Each one is now shipped in v6, and
each one retires a piece of custom code that Sales had to write because there was no alternative:

| v6 capability | What Sales wrote instead | Where |
|---|---|---|
| Related-record collections (`DeclareRelatedRecords`) | a client draft model + a bespoke atomic-save operation + hand-rolled server collections | `deal-draft.ts` (497), `SaveDealOperation.ts` (325), `DealEntityServer.ts` (416) |
| `mj-workspace-card` in MJ core | a **verbatim vendored copy** of accounting's component | `packages/Angular/src/lib/vendored/workspace-tabs/` (7 files, 473 TS lines) |
| Explorer tab/nav surface (`mj-tab-nav`, NavigationService) | a hand-built section shell with its own page switching | `sales-section.component.ts` (375), `sales-nav.model.ts` (165) |

None of that was wrong when written — the vendored copy is a *recorded decision* (D8) whose own
`VENDORED.md` names MJ core as its intended home. The rework is the moment that intent is redeemable.

---

## 2. The target v6 patterns

Verified present in `@memberjunction/*@6.1.0-edge.2` as installed in the conversion worktree.

**a. Composition via related-record collections.** `BaseEntity.DeclareRelatedRecords<TChild>()` in
`@memberjunction/core/dist/generic/baseEntity.d.ts`, configured by JSON on
`EntityRelationship.RelatedRecordCollection`. CodeGen emits a typed, writable collection onto the
**generated** entity class, so browser and server get the same object. Collection API: `Load`,
`LoadEager`, `Create`, `Add`, `Remove`, `Clear`.

**b. Per-entity form sub-class.** `BaseFormComponent` in `@memberjunction/ng-base-forms`, which is also
where `NavigationService` is referenced — record navigation goes through the service rather than through
app-local routing.

**c. The Explorer tabbed shell.** `@memberjunction/ng-ui-components` ships `mj-tab-nav` (with badge
variants) **and — decisively — `lib/workspace-tabs/`**: `workspace-card.component`,
`workspace-tab-strip.component`, `workspace-tab-store`, `workspace-tabs.types`, `workspace-tip.directive`.
That is the same five-file set Sales vendored.

**d. The house guidance is written down.** `bizapps-accounting`, `docs/ui-architecture.md` on
`origin/next` — "bind to the primitives, not to a service layer", with worked examples for read,
list (`IncludeRelatedRecords`), compose-and-save, and browser-side `Validate()`. **Adopt it verbatim
rather than re-deriving it.** It also contains the `ResultType: 'entity_object'` warning that the orders
app shipped wrong for months; Sales should be audited against it during the rework.

---

## 3. Current → target map

Legend: **RETIRE** (delete), **REPLACE** (swap for a core primitive), **KEEP** (still earns its place).

| Piece | Lines | Verdict | Target |
|---|---|---|---|
| `vendored/workspace-tabs/` | 473 TS + 2 CSS | **RETIRE** | import from `@memberjunction/ng-ui-components`. The v6 component's inputs are a **1:1 match** with what `deal-workspace.component.html` already binds — `Tabs`, `ActiveId`, `ShowFooter`, `ConfirmLabel/Icon/Disabled/Title/Busy/BusyLabel`, `ShowDraft`, `DiscardLabel`, and the `TabSelected/TabClosed/NewTabRequested/TabReordered/Confirm/Discard` outputs. A drop-in import swap, not a rewrite |
| `deal-draft.ts` | 497 | **RETIRE** (mostly) | the draft exists because a browser could not hold a deal + children. Composition removes the reason. **Its validation must survive** — see §4 |
| `SaveDealOperation.ts` | 325 | **RETIRE** (mostly) | `deal.Save()` ships the graph in one transaction. **Server-only concerns must survive** — see §4 |
| `DealEntityServer.ts` hand-rolled collections (`_lines`, `_deletedLines`, `_schedule`, `_deletedSchedule`, `AddLine`, `RemoveLine`, `AddScheduleRow`, `RemoveScheduleRow`) | ~90 of 416 | **RETIRE** | replaced by the generated `Lines` / `PaymentSchedule` collections. **This is forced, not optional — see §6** |
| `DealEntityServer.ts` rules (close lock, `SetOwner`/`OwnerEmployeeID` stamp, `DealNumber`, company resolution, stage-event append) | ~326 of 416 | **KEEP** | needs the database; stays server-side per accounting's split |
| `sales-section.component.ts` | 375 | **REPLACE** | rail + page switching moves onto the Explorer shell / `NavigationService`. The *content* of each page is kept |
| `sales-nav.model.ts` | 165 | **KEEP** | IA-as-data is a virtue, not a workaround. Re-point it at the shell's nav contract |
| `deal-workspace.service.ts` | 365 | **PART-KEEP** | per accounting: a service may hold Angular-shaped state (selection, expand/collapse, filter state) but **not** load/save/validate/map entity data. Most of `LoadDraft`/`Save` goes; lookup caching should move to an engine class |
| `deal-workspace.component.ts` | 452 | **KEEP, rebind** | the five panes are the product. They rebind from `DealDraft` to the entity + its collections |
| Board (`board/deal-board.component.ts`) | 253 | **KEEP** | already binds to roster rows and `Sales.SaveDeal`; rebind the move to `deal.Save()` |

---

## 4. What must NOT be lost when `DealDraft` and `SaveDeal` retire

These two files are not pure ceremony; they carry rules. Each needs an explicit new home, and this is the
part most likely to be dropped silently.

| Rule | Today | Target home |
|---|---|---|
| Draft validation — name/pipeline required, probability 0–100, service-period ordering, line quantity/discount bounds, **order-readiness warning** | `DealDraft.Validate()` | **shared entity subclass** `Validate()` (`@mj-biz-apps/sales-entities`), so it runs in the browser — accounting puts the double-entry balance check exactly here |
| `CompanyID` resolved from the pipeline, never trusted from the client | `SaveDealOperation` | `DealEntityServer` (needs the DB) |
| Owner intent → `DealTeamMember` row → denormalized `OwnerEmployeeID` | `SaveDealOperation` + `DealEntityServer.SetOwner` | `DealEntityServer` |
| `DEAL-{seq}` numbering | `DealEntityServer` | unchanged |
| **Stage transition appends a `DealStageEvent`** stamping amount/probability *on the way out* | `SaveDealOperation` | `DealEntityServer.Save()` — **and this resolves the D-BD2 debt**: the stamping was put in the operation only to avoid double-stamping with `CloseDealOperation`. With the operation gone there is one writer again |
| "A present array is the complete desired set" (absent child ⇒ deleted) | `SaveDealOperation` | `OnRemove: 'delete'` on the collection — the same semantics, expressed as metadata |
| Children re-sequenced from array order | `SaveDealOperation` | `Sequence: { Field: 'DisplayOrder', From: 1 }` on the collection |

**The pricing guarantee is unaffected and must stay unaffected.** Nothing in this rework may make Sales
compute money; the `Resolved*` columns stay write-only from an `Orders.PreviewOrder` response.

---

## 5. Reference apps

- **`bizapps-accounting` = the pattern source.** `docs/ui-architecture.md`, and the worked migration in
  `metadata/entity-relationships/` + `JournalEntryEntityServer` / `JournalEntryLineEntityServer` /
  `JournalEntryBatchEntityServer`. Accounting has already retired exactly the hand-rolled collections
  Sales still has, and its comments state the before/after in detail.
- **`bizapps-contracts` = the copy template** for shell/layout conventions. **Caveat:** contracts'
  `origin/next` is still on `package-lock.json` and has not been converted to pnpm/v6 (last commit
  2026-08-06), so copy *layout conventions* from it, not dependency or MJ-version patterns.

---

## 6. Mechanism validation — what was actually proven

Done on `feature/mj6-pnpm-conversion` in the v6 worktree, then **reverted**; the branch is unchanged and
still builds 8/8. Full detail in `EXPLORER-REWORK-RUN-REPORT.md`.

**Proven: composition generates real, typed, writable collections for Sales.** Declaring
`RelatedRecordCollection` on Deal → Deal Lines and Deal → Deal Payment Schedules and re-running CodeGen
emitted onto `mjBizAppsSalesDealEntity`:

```typescript
public readonly Lines = this.DeclareRelatedRecords<mjBizAppsSalesDealLineEntity>({
    Name: 'Lines',
      RelatedEntity: 'MJ_BizApps_Sales: Deal Lines',
      RelatedEntityJoinField: 'DealID',
      OrderBy: 'DisplayOrder ASC',
      Load: 'explicit',
      OnRemove: 'delete',
      Source: 'database',
      Sequence: { Field: 'DisplayOrder', From: 1 },
});
```

…and the same for `PaymentSchedule`. Both on the **generated** class, so the browser gets them too.

**Also proven, and this is the finding that shapes the sequencing: the collections and the hand-rolled
ones cannot coexist.** With both present the build fails with exactly four errors, all in one file:

```
src/DealEntityServer.ts(79,16): error TS2416 / TS2611: 'Lines' is defined as a property in class
'mjBizAppsSalesDealEntity', but is overridden here in 'DealEntityServer' as an accessor.
```

(and the same pair for `PaymentSchedule`). **Nothing else in the app broke** — the incompatibility is
purely that `DealEntityServer` already defines those two names.

**Consequence for planning: turning composition on is not an additive step.** The metadata switch and the
retirement of the hand-rolled collections are a single atomic change, and it ripples to **48 call sites
across 6 files** — `deal-workspace.component.ts`, `deal-workspace.service.ts`, `DealEntityServer.ts`,
`SaveDealOperation.ts`, `deal-draft.ts`, `save-deal.checks.ts`. That is the true size of Phase 2 below.

---

## 7. Phased sequence

Each phase is independently shippable and leaves the app green.

**Phase 0 — unblock (external).** bizapps-common must publish a build whose
`generic-database-provider` floor is `^6.1.0-edge.2` (see §9). Nothing below can be tested end-to-end
until then; everything below can be *written* before then.

**Phase 1 — retire the vendored tabs.** Delete `vendored/workspace-tabs/`, import
`@memberjunction/ng-ui-components`. Lowest risk, immediate 473-line deletion, no behaviour change
expected because the inputs match 1:1. Do it first as a cheap proof the v6 UI surface is usable.

**Phase 2 — composition (the big one).** Atomic, per §6:
1. Move `DealDraft.Validate()` rules onto the shared entity subclass.
2. Declare the collections in `metadata/entity-relationships/` (JSON ready — Appendix A).
3. Delete the hand-rolled collections from `DealEntityServer`; keep its DB-dependent rules.
4. Rebind the 48 call sites; workspace composes `deal.Lines.Create()` and saves with `deal.Save()`.
5. Move stage-event stamping into `DealEntityServer.Save()` and delete `CloseDealOperation`'s own
   append (closes D-BD2).
6. Retire `DealDraft` and `Sales.SaveDeal`.
7. Rewrite `save-deal.checks.ts` against the new path — **the 12 existing checks are the safety net; port
   them, do not drop them.**

**Phase 3 — shell and navigation.** Move the section shell onto the Explorer tabbed shell +
`NavigationService`; keep `sales-nav.model.ts` as the IA source. Trim
`deal-workspace.service.ts` to Angular-shaped state only.

**Phase 4 — per-entity form sub-classes.** Replace remaining generated-form reliance with
`BaseFormComponent` sub-classes where a hand-shaped form earns it.

**Phase 5 — audit against `ui-architecture.md`**, including the `ResultType: 'entity_object'` sweep.

---

## 8. Open questions — the sign-off items

**Q1 (the main one) — which Deal relationships become composition collections?** All five exist and all
join on `DealID`. My recommendation, for confirmation:

| Relationship | Recommendation | Reasoning |
|---|---|---|
| **Deal → Deal Lines** | **Yes — writable**, `OnRemove: delete`, sequenced on `DisplayOrder` | composed with the deal, never exists without it, and `SaveDeal` already treats the array as the complete set. **Validated ✓** |
| **Deal → Deal Payment Schedules** | **Yes — writable**, same config | same reasoning; note the normal case is zero rows, so `Load: 'explicit'` matters. **Validated ✓** |
| **Deal → Deal Stage Events** | **Yes, but `ReadOnly: true` + `OnRemove: 'refuse'`** | append-only provenance. A read-only collection is a *better* expression of that than today's comment-and-convention: accounting uses exactly this shape for `Members`, noting "a convention in a comment is enforced by whoever read it". Writes keep going through the server. **Needs a call** |
| **Deal → Deal Team Members** | **Probably not — or read-only** | membership is a set, not an ordered composition, and `OwnerEmployeeID` is a *derived stamp* maintained server-side. A writable collection would invite a client to add a member without the derivation running. **Needs a call** |
| **Deal → Deal Contact Roles** | **Probably yes — writable**, no `Sequence` | a set, like accounting's line dimensions (which got a collection with no sequence because "stamping an order onto them would invent a meaning the schema does not have"). Lowest stakes of the three undecided. **Needs a call** |

**Q2 — does `Deal.Amount` stay a cached answer during the rework?** It must (rule 1), but composition
makes `deal.Lines` locally enumerable, which is exactly when someone will be tempted to sum it. Should the
plan add an explicit guard (a test, or a lint) so the temptation fails loudly?

**Q3 — how far does the Explorer shell replace the section?** Phase 3 assumes the rail and the
five-pane workspace survive and only their *host* changes. If Matt wants a different IA, Phase 3 is
where that lands and the estimate changes.

**Q4 — do we keep the deal-level tab strip (multiple open deals)?** It is Sales-specific and well-liked,
and v6's `workspace-tab-store` supports it — but confirm it is still the intended UX before porting.

**Q5 — is `bizapps-contracts` the layout template even though it is pre-v6?** If contracts is converted
first, Sales should copy it after; if not, Sales sets the v6 precedent for the family.

---

## 9. External dependency

**MJAPI cannot start on v6** until bizapps-common publishes. Published
`@mj-biz-apps/common-core-entities-server@5.33.2` still imports `UserCache` from
`@memberjunction/sqlserver-dataprovider`, which v6 removed. Common merged the fix (PR #54, `next`,
2026-08-11) but last published 2026-08-10 — and its `next` **does not currently build**, because it
declares `generic-database-provider: ^6.1.0-edge.1` and `UserCache` only appears in `edge.2`.

**Impact on this plan:** Phases 1–5 can all be *written* and unit/CodeGen-verified without the API.
**End-to-end testing of any of it needs the common publish**, so treat that as the critical path.

---

## Appendix A — the collection metadata, ready to apply

Validated in §6, then reverted. Drop into `metadata/entity-relationships/` and
`pnpm mj sync push --dir metadata`. Requires `.mj-sync.json` with
`{"entity": "MJ: Entity Relationships", "filePattern": "**/.*.json"}`.

`lines-collection.json`:

```json
{ "Name": "Lines", "Source": "database", "Load": "explicit", "OnRemove": "delete",
  "OrderBy": "DisplayOrder ASC", "Sequence": { "Field": "DisplayOrder", "From": 1 },
  "ClearAfterSave": false }
```

`payment-schedule-collection.json` — identical but `"Name": "PaymentSchedule"`.

Keyed in `.entity-relationships.json` by entity **names**, never IDs (CodeGen re-mints
`EntityRelationship` IDs on every rebuild):

```json
"primaryKey": { "ID": "@lookup:MJ: Entity Relationships.Entity=MJ_BizApps_Sales: Deals&RelatedEntity=MJ_BizApps_Sales: Deal Lines" }
```

Do **not** set `RelatedEntity` / `RelatedEntityJoinField` in the JSON — they are already columns on the
same row, and duplicating them creates two sources of truth with the JSON copy winning silently.
