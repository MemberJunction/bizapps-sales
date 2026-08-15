# Explorer UX rework (#89) — approach for sign-off

**Status:** re-synced 2026-08-14 against `next` + the Related Record Collection conversion (`b309a07`).

> ### ⚠️ WHY THIS DOCUMENT WAS REWRITTEN, AND WHAT THAT MEANS FOR READING IT
>
> The first draft was written on `feature/mj6-pnpm-conversion` **before** the RRC conversion landed, and
> it was checked against a *different branch's* code. Several of its claims were wrong for this lineage —
> not stale-by-drift, but wrong when written, because the branch it described is not the branch we build
> on. Two examples, both of which would have caused real damage if planned against:
>
> - It lists a **pipeline board** as a component to keep and rebind. There is no board on this lineage;
>   it lives on `feature/pipeline-board`.
> - It says stage-event stamping lives in `SaveDealOperation` and that moving it "closes D-BD2". Nothing
>   on this lineage stamps a stage event at all, so there was nothing to move — and the file it was
>   supposedly in has now been deleted. See **KI-9**.
>
> **Every RETIRE / REPLACE / KEEP verdict below is now checked against the working tree**, and each says
> how it was checked. Where the original was wrong, the correction is stated rather than quietly fixed.

**The ask:** confirm §3's remaining verdicts and answer the open questions in §8. Q1 and Q2 are **answered
by what shipped** and need ratification rather than a decision.

---

## 1. Why this rework exists

Sales was built standalone against MJ v5, before three v6 capabilities existed. Each retires code Sales
had to write because there was no alternative.

| v6 capability | What Sales wrote instead | Status |
|---|---|---|
| Related-record collections | a client draft model, a bespoke atomic-save operation, hand-rolled server collections | ✅ **DONE** — `b309a07`, −1109 lines |
| `mj-workspace-card` in MJ core | a **verbatim vendored copy** of accounting's component (7 files, 473 TS lines) | ⬜ **the next step** — see §7 Phase 1 |
| Explorer tab/nav surface | a hand-built section shell with its own page switching (`sales-section.component.ts`, 398 lines) | ⬜ Phase 3 |

---

## 2. The target v6 patterns — verified against the PUBLISHED package

The original said "verified present in `@memberjunction/*@6.1.0-edge.2` **as installed in the conversion
worktree**". That is a weaker check than it appears, because this dev environment resolves
`@memberjunction/ng-ui-components` through a **symlink into the local MJ checkout** (`mj dev workspace`),
while CI installs from the registry with `--frozen-lockfile`. Anything present only in the local source
would build here and break in CI.

**Re-verified by downloading the actual tarball**
(`registry.npmjs.org/@memberjunction/ng-ui-components/-/ng-ui-components-6.1.0-edge.2.tgz`, 308 KB):

- `dist/lib/workspace-tabs/` ships all five files — `workspace-card.component`,
  `workspace-tab-strip.component`, `workspace-tab-store`, `workspace-tabs.types`,
  `workspace-tip.directive`.
- All five are exported from `dist/public-api.d.ts` (lines 33–37).
- `mj-tab-nav` is present (`lib/tab-nav/`), as is the whole page-chrome set the shell already uses.

**So Phase 1 is safe for CI, not merely safe locally.** The lockfile records a registry resolution of
`6.1.0-edge.2`, which is what a clean install gets.

**One correction to the original's Phase 1 claim.** It said the vendored files are byte-identical to
upstream, making the swap "a drop-in import swap, not a rewrite". They are **no longer identical** —
MJ core's copies have moved on:

| File | Drift vs MJ core |
|---|---|
| `workspace-card.component.ts` | 55 changed lines |
| `workspace-tab-strip.component.ts` | 157 |
| `workspace-tab-strip.component.css` | 200 |
| `workspace-tab-store.ts` | 22 |
| `workspace-tabs.types.ts` | 20 |
| `workspace-tip.directive.ts` | 9 |
| `workspace-card.component.css` | identical |

**The conclusion survives anyway, for a better reason than byte-identity: the BINDING SURFACE is a
superset.** MJ core's `WorkspaceCardComponent` has all 23 `@Input`/`@Output` members the vendored one
exposes — every one the workspace template binds — plus one new optional input (`AllowReorder`). So the
swap is still an import change with no template edits; the drift is internal implementation and styling,
which is exactly the part we *want* to inherit. Expect visual differences and review them.

---

## 3. Current → target map, re-checked against the tree

Legend: **RETIRE** (delete) · **REPLACE** (swap for a core primitive) · **KEEP** (still earns its place).

| Piece | Lines | Verdict | Status |
|---|---|---|---|
| `vendored/workspace-tabs/` | 473 TS + 2 CSS | **RETIRE** | ⬜ **next** — import from `@memberjunction/ng-ui-components`. Surface verified compatible (§2) |
| `deal-draft.ts` | was 497 | **RETIRE** | ✅ done — validation relocated onto the entities, §4 |
| `SaveDealOperation.ts` | was 325 | **RETIRE** | ✅ done — plus its metadata row and `@file:` type definitions |
| `DealEntityServer.ts` hand-rolled collections | was ~90 of 416 | **RETIRE** | ✅ done — file is now 243 lines |
| `DealEntityServer.ts` DB-dependent rules | ~180 of 243 | **KEEP** | ✅ kept, and **grew**: it gained the `CompanyID` stamp that only the retired operation enforced |
| `sales-section.component.ts` | 398 | **REPLACE** | ⬜ Phase 3. **Already imports `@memberjunction/ng-ui-components`** and uses `mj-page-layout`, `mj-page-header`, `mj-page-body`, `mj-left-nav` — so this is narrower than the original implied: the chrome is already MJ's; what is hand-built is the *page switching* |
| `sales-nav.model.ts` | 165 | **KEEP** | IA-as-data. Re-point at the shell's nav contract |
| `deal-workspace.service.ts` | 331 | **PART-KEEP** | ✅ partly done — `LoadDraft`/draft mapping gone. Lookup caching still wants an engine class |
| `deal-workspace.component.ts` | 600 | **KEEP, rebound** | ✅ done — the five panes bind to the entity and its collections |
| ~~Board~~ | — | — | ❌ **DOES NOT EXIST HERE.** The original listed it as KEEP; it is on `feature/pipeline-board`. Any board rebinding is that branch's convergence work, not #89's |

---

## 4. What must NOT be lost — reconciled, all seven rules

Full reconciliation with evidence is in the RRC work; the summary:

| Rule | Verdict | Where |
|---|---|---|
| Draft validation | **relocated** — 15 of 16 rules verbatim | `DealEntity` / `DealLineEntity` / `DealPaymentScheduleEntity` |
| `CompanyID` from the pipeline | **relocated** | `DealEntityServer.stampCompanyFromPipeline()` |
| Owner intent → team row → stamp | **relocated, split** | `DealEntity.SetOwner()` + `DealEntityServer.stampOwnerFromTeam()` |
| `DEAL-{seq}` numbering | **preserved** | `DealEntityServer.saveWithNewDealNumber()` |
| Stage-event append | **premise false on this lineage** | nothing to move — **KI-9** |
| "Present array = complete set" | **deliberately changed** | D-RRC1; SD6 + SD13 |
| Children re-sequenced | **preserved, values changed** | `Sequence`; `1,2,3` not `10,20,30` |

**Two corrections to the original §4.**

1. It lists an **"order-readiness warning"** among the draft's validations. That warning is **not on this
   lineage** — it belongs to `feature/deal-line-product-ref`. The original was checked against that
   branch's draft, which is the clearest evidence that it was written against different code.
2. It asserts `OnRemove: 'delete'` reproduces delete-by-omission — *"the same semantics, expressed as
   metadata"*. **It does not.** `OnRemove` governs what *removal* means, not what *omission* means, and no
   collection option reproduces the old behaviour. This was the single most consequential error in the
   document, because it made a behaviour change look like a configuration detail.

**The 16th rule was genuinely dropped and had to be restored:** the per-line "no type set" advisory
cannot live on the entity, because `RelatedRecordCollection.Validate()` discards a child's warnings when
the child otherwise validates. It is now a UI advisory in the component.

---

## 5. Reference apps

- **`bizapps-accounting` = the pattern source.** `docs/ui-architecture.md` and its
  `metadata/entity-relationships/` + `JournalEntry*EntityServer` migration. Adopt verbatim.
- **`bizapps-contracts` = the layout template**, with the caveat that its `next` is still pre-v6/pnpm —
  copy *layout conventions*, not dependency or MJ-version patterns.

---

## 6. Mechanism validation — superseded by the real thing

The original reported a spike that declared two collections, proved they generate, and was reverted. That
is now history: **the conversion shipped.** Two of its numbers were wrong and are worth correcting,
because both understated the work:

| Original claim | Actual |
|---|---|
| "48 call sites across 6 files" | **136 references across 12 files** |
| "the 12 existing checks are the safety net" | 12 at the time; the suite is now **SD1–SD16** |
| Two collections (`Lines`, `PaymentSchedule`) | **three** — `Team` was required too, and `PaymentSchedule` was not in the approved shape list but had to convert or the payment-schedule pane would have lost its save path |

The one finding that held up exactly: **the generated collections and the hand-rolled ones cannot
coexist** (TS2416/TS2611), so turning composition on was atomic, not additive.

---

## 7. Phased sequence — where we actually are

**Phase 0 — external unblock.** ❌ **STALE. The original said "MJAPI cannot start on v6" pending a
bizapps-common publish, and called it the critical path.** That was resolved during the v6 host work
(D-XR7: peer floor, root devDeps anchor, `pnpm.overrides`). The host API runs on v6 today, loads
`@mj-biz-apps/sales-server`, and serves the Explorer — every gate in the RRC conversion ran end-to-end
against it. **There is no external blocker.**

**Phase 1 — retire the vendored tabs.** ⬜ **Next, and now the cheapest remaining win.** Delete
`vendored/workspace-tabs/`, import from `@memberjunction/ng-ui-components`. Verified safe for CI (§2).
Expect visual change from the drift; that is the point.

**Phase 2 — composition.** ✅ **DONE** (`b309a07`). Item 5 of the original — "move stage-event stamping
and delete `CloseDealOperation`'s append" — **was not done and must not be attempted here**: nothing on
this lineage stamps a stage event. It is convergence work, recorded as **KI-9**.

**Phase 3 — shell and navigation.** ⬜ Narrower than described: the page chrome is already MJ's; what is
hand-built is page switching and the rail wiring.

**Phase 4 — per-entity form sub-classes.** ⬜ Unchanged.

**Phase 5 — audit against `ui-architecture.md`**, including the `ResultType: 'entity_object'` sweep. ⬜
Partly pre-empted: the v6 date sweep already covered the shape hazard that doc warns about.

---

## 8. Open questions

**Q1 — which Deal relationships become collections?** **ANSWERED BY WHAT SHIPPED — ratify or object.**

| Relationship | Original recommendation | What shipped |
|---|---|---|
| Deal → Deal Lines | writable, sequenced | ✅ as recommended |
| Deal → Deal Payment Schedules | writable, sequenced | ✅ as recommended |
| Deal → Deal Team Members | *"probably not — or read-only"* | ⚠️ **shipped WRITABLE, as a set** (no `Sequence`). The stated worry — "a writable collection would invite a client to add a member without the derivation running" — is met by `stampOwnerFromTeam()`, which re-derives `OwnerEmployeeID` on every save and is guarded so a save that never touched the roster cannot clear it. The roster is the one surface that must be editable from the workspace, so read-only was not viable |
| Deal → Deal Stage Events | read-only + `OnRemove: 'refuse'` | ⬜ **no collection at all.** A read-only collection still invites `Remove()` at the type level; leaving it plain says "server writes this, one event at a time" more clearly. Open to the original's view |
| Deal → Deal Contact Roles | probably writable | ⬜ no collection — no surface needs it yet |

**Q2 — does `Deal.Amount` stay a cached answer?** **Answered, and hardened beyond the question.** The
original asked whether to add a guard against someone summing `deal.Lines` now that it is locally
enumerable. Retiring `Sales.SaveDeal` turned out to remove a *different* pricing guard — its field
whitelist was the only thing stopping a caller writing `ResolvedUnitPrice` — so the rule moved onto
`DealLineEntity` and is pinned by **SD16**. `Deal.Amount` itself is still unguarded against local
summing; a check for that remains worth adding.

**Q3 — how far does the Explorer shell replace the section?** ⬜ Still open, and now cheaper than
estimated (§3).

**Q4 — keep the deal-level tab strip?** ⬜ Still open. Note it now works against MJ's own
`workspace-tab-store`, so keeping it costs nothing extra.

**Q5 — is contracts the layout template though it is pre-v6?** ⬜ Still open.

---

## 9. External dependency — RESOLVED

The original's §9 described an unpublishable `bizapps-common` blocking MJAPI on v6 and called it the
critical path. **It is resolved and this section is retained only so the claim is not re-imported from an
old copy of this file.** See D-XR7.

---

## Appendix A — the collection metadata

**Superseded — it is applied.** The live configuration is `metadata/entity-relationships/`, and its
`README.md` explains why the three shapes differ, why `Team` carries no sequence, and why the rows are
updated by `@lookup` rather than created.

Two details from the original appendix proved right and are worth keeping in mind for any future
collection: do **not** repeat `RelatedEntity` / `RelatedEntityJoinField` inside the JSON (they are columns
on the same row), and key by `@lookup` on entity **names**, because CodeGen re-mints `EntityRelationship`
IDs on every rebuild.
