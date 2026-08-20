# Story audit — the code half, re-run on `feature/embed-order-on-deal`

**Date:** 2026-08-20 · **Branch:** `feature/embed-order-on-deal` · **Source:** `MemberJunction/bc-aidp-next-golive`, read-only

## Why this exists as a second audit

The first pass ran from `feature/pipeline-board-rebased`, which **predates `PipelineStage.OrderStatusOnEntry`
entirely**. Its central lifecycle verdict — *"no stage is marked as the agreement threshold, so #115, #118 and
rows in #35/#117 are all the same unbuilt mechanism"* — is **false on this branch**. The threshold exists, it
is a per-stage declaration rather than a flag, it is seeded, and it has integration coverage. Everything that
verdict grouped together has to be re-separated, because the four rows in that status table now have four
different answers.

Settled before this run and deliberately not re-examined: **#37/#38/#39** are superseded, **#93** and **#83**
are met, **#120** is strictly broader than #38/#39 combined.

## How "met" is established

The rule for this pass was *prove met criteria against the database, not the screen*. Three sources:

1. **The 52 integration checks** (`RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs`). Every one hits a
   live database with nothing mocked and rolls back. Where a criterion maps to a check, the check id **is** the
   evidence, and `docs/CHECK-MUTATION-EVIDENCE.md` records which mutant proves that check can fail.
2. **`scripts/audit-story-evidence.mjs`** — written for this audit, for the three questions no check answers.
   Cited below as **E1/E2/E3**.
3. **Code reading**, for UI behaviour and for absences. An absence cannot be proven by a passing test.

---

## Verdicts

| Issue | Verdict |
|---|---|
| **#33** S-US1 Create a deal record | **partially met** — 3 of 5 criteria met, 2 partially (the missing "standard agreement modified" field, listed in the body, was built in this session) |
| **#34** S-US2 Contract + tasks on Closed Won (B2B) | **partially met** — the contract is real; every task is absent |
| **#35** S-US3 Order-review task on Closed Won | **not met** — its one deliverable does not exist |
| **#114** S-US4 Add and manage deal line items | **partially met** — add and edit work; removal is dropped upstream |
| **#115** S-US5 Order status follows the deal | **partially met** — 4 of 5 rules met; the earlier verdict is refuted |
| **#116** S-US6 Close a deal as Won | **partially met** — 3 of 4 criteria met; downstream is half-built |
| **#117** S-US7 Close a deal as Lost | **met** |
| **#118** S-US8 Reopen a closed deal | **partially met** — 3 of 4; the order cannot come back |
| **#121** S-US11 Pipeline board and dashboard | **met** |

---

## #33 — S-US1: Create a deal record → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Creating a deal creates its embedded order in Draft, same action | **met** | `DealEntityServer.ts:480` `provisionEmbeddedOrder()`; declared at `deal-entity.ts:155`. `save-deal.SD18`. **E1: 7/7 seeded deals carry an order**, each Draft unless a stage moved it. |
| Adding a line creates an order line; removing removes it | **partially met** | Add and edit: `save-deal.SD1`, `SD14` (two levels down, one save). **Removal is silently dropped** — `save-deal.SD6` is a tripwire pinned to the current wrong behaviour, cause diagnosed in orders' `savePendingLines`, `docs/KNOWN-ISSUES.md` KI-20. |
| No deal-level line-item records exist anywhere | **met** | **E2: no table matches `%DealLine%`, no entity matches `Deal Line`.** The only surviving occurrence of the name is `Pipeline.RequiresDealLines`, a policy flag choosing priced vs header-only mode — not a record. |
| The rep can create the account or contact inline without leaving the deal workspace | **partially met** | `deal-workspace.component.ts:473` `CreateRelated()` calls `nav.OpenNewEntityRecord()`. **The rep does leave** — it is a new Explorer tab — and the new record is not returned to the picker. See finding (a). |
| The owner column matches the Owner-role team member **and cannot be edited directly** | **partially met** | Matches: `DealEntityServer.ts:1021` `stampOwnerFromTeam()`, `save-deal.SD3`. **Cannot be edited directly: NOT met.** See finding (b). |

**Three more items from the story body, not in its checklist:**

* **"Standard agreement modified" flag — MET, in this session.** `Deal.StandardAgreementModified`, NOT
  NULL defaulting to 0, on the variances pane of the workspace. It is also what #34's `HasModifications`
  copies from. `close-won-contract.CT5` (the seam writes it) and `CT6` (the whole close carries it).
* **Stage drives probability and forecast category — partially met.** Done in the workspace at
  `deal-workspace.component.ts:417-418`. There is no server-side derivation, so a deal created by an Action, an
  agent or a script gets whatever probability the caller supplied. The vocabulary rule is respected either way
  (both values are read off the stage row), but the automation is UI-deep only.
* **Payment schedule blank means standard terms, placeholders not filled defaults — met.** `save-deal.SD15`.

---

## Finding (a) — inline account creation: **CONFIRMED**

> *inline account creation opens an Explorer tab without returning the record to the picker*

`deal-workspace.component.ts:473`:

```ts
public CreateRelated(entityName: string): void {
    this.nav.OpenNewEntityRecord(entityName);
}
```

Its own doc comment states the choice and the reasoning — *"there is no reliable moment to come back at, and a
picker that silently changed while the rep was elsewhere is worse than one they set themselves"* — so this is a
deliberate design position rather than an oversight. **The finding stands anyway**, because the criterion says
*without leaving the deal workspace*, and a new Explorer tab is leaving. The rep must create the account, come
back, reopen the picker, and select it.

That reasoning is sound about *silent* selection. It is not an argument against **returning the record** — a
modal or slide-in resolving to the created id would satisfy both the criterion and the concern. That is real
work (MJ offers no app-level create-and-return primitive this surface can call today), so it is named here
rather than quietly done.

---

## Finding (b) — `OwnerEmployeeID`: **CONFIRMED, and the distinction matters**

> *`OwnerEmployeeID` is overwritten on every save rather than refused — which is not the same as "cannot be
> edited directly"*

**Confirmed — and it is narrower and worse than "overwritten on every save".** `stampOwnerFromTeam()`
(`DealEntityServer.ts:1015-1023`) is *guarded*, for a good reason:

```ts
if (!this.Team.IsLoaded && this.Team.Count === 0) {
    return; // the roster is not part of this save; leave the stamp alone
}
```

Without that guard, an ordinary header edit would derive "no owner" from an unloaded collection and **clear the
stamp**. So the guard is correct. Its consequence is that there are two paths, and neither one refuses:

* **Roster participates in the save** → the stamp is recomputed, and a hand-set value is silently discarded.
* **Header-only save** → the stamp is *not* recomputed, and a hand-set value is silently **kept**.

**E3 proves the second path against the database.** One open deal, `OwnerEmployeeID` set directly to a different
employee, saved through the entity layer without touching `Team`:

```
deal DEAL-9001: owner stamp is E11B6200-0001-4B02-8F22-6C8D4E3A9B02
setting it directly to E0111111-0000-4000-A000-000000000002 ...
save returned true; error: (none)
stamp in the database now: E0111111-0000-4000-A000-000000000002
owner-role team member:    E11B6200-0001-4B02-8F22-6C8D4E3A9B02
-> PERSISTED. The direct edit was NOT refused, and the stamp now disagrees with the team row.
```

(The probe restores the original value and verifies the restore.)

So the app can hold a deal whose owner column and owner-role team row **name different people**, reached by an
ordinary `BaseEntity.Save()` with no error and no warning. The denormalised stamp exists precisely so per-rep
rollups need no join — which means a rollup can now disagree with the roster it was meant to shortcut.
`custom/server-owned-fields.ts` keeps the field off the Explorer form, so the UI is clean; the criterion says
*cannot be edited directly*, and the server is where that has to hold — the same argument the close lock won.

**The fix is small and belongs in `Save()`:** if `OwnerEmployeeID` is dirty and the roster did not participate,
refuse it with a message naming `SetOwner`. Refusing beats silently re-deriving: quietly correcting a caller who
believed they were setting the owner is how the close lock would have gone wrong. Not done here — it needs a
check and a mutant of its own, and it is outside the three items this session carried.

---

## #34 — S-US2: Contract and tasks on Closed Won (B2B) → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| A Contract record is created | **met** | `close-deal.CD1` routes it; `close-won-contract.CT1` proves the row is readable back. |
| Customer org, selling company, primary contact from the deal | **met** | `LiveContractsSeam.ts:154-162`. |
| `ContractNumber` — next from the sequence | **met** | **`close-won-contract.CT1`** asserts contracts minted it and sales sent none. Two apps generating into one sequence is how a duplicate contract number reaches a customer. |
| `ContractTypeID` defaults to Order Form | **met, and it was broken** | The seeded `CloseWonPolicy` named `"Standard"` — a contract type that exists on **no** host (contracts ships Order Form, Statement of Work, Payment Link, Change Order). Every B2B close-won would have planned a contract the seam could not create. Now `Order Form`. Found only because CT1 forced a resolution against the live table. |
| `CreatingEntityID` / `CreatingRecordID` typed pair | **met** | `setProvenance()`; CT1 asserts both-or-neither, which is also contracts' own CHECK constraint. |
| `HasModifications` copied from the deal's flag | **met, in this session** | Was hardcoded `false` because the deal had no column to copy from. Now `input.StandardAgreementModified === true`, reported by `buildContractInput`. **`CT5`** proves the seam writes both values and treats absence as false; **`CT6`** drives the whole close and reads the contract the close created. Mutants `M-CT2` and `M-CT3` cover the two hops separately — and M-CT3 is why CT6 exists: mutating the close alone left all fifty other checks green. |
| `AutoRenew`, `RenewalNoticeDays`, `CancellationWindowDays`, `AnnualIncreasePercent` defaulted **from the Contract Type record** | **not met, and not buildable from here** | Contracts' `ContractType` has no such columns. Its full shape is `ID, Name, Description, RequiresExecutedDocument, Status, ParentStatusRequirement` — there are no per-type stored defaults to read. Sales sets three of the four only when the deal carries an explicit override (`setNegotiatedTerms`), and deliberately declines `RenewalNoticeDays` because contracts warns those two fields are not interchangeable. **This criterion is an upstream ask on contracts.** |
| `ContractTemplateID` — the `ContractTemplate` where `Status = Active` | **not met** | `LiveContractsSeam.ts:319` `templateID()` returns `input.ContractTemplateID ?? null`. Nothing resolves the active template. |
| A finance contract-processing **Task** | **not met** | No task creation exists anywhere in this repo. |
| An order-review **Task** | **not met** | Same. |

**The shape of what is missing is one thing, not four:** there is no BizApps Tasks integration at all. The
contract half of S-US2 is live and proven; the *prompting* half — which is what makes finance act — is absent.

---

## #35 — S-US3: Order-review task on Closed Won → **not met**

Its single deliverable is a Task, and no task is created for either pipeline.

**But the issue's "Related order-status rules" table is now implemented**, which is exactly what the earlier
audit got wrong by folding this row in with the rest. Those rules are #115's subject and are verdicted there —
four of five met. The status behaviour S-US3 describes as *context* is real; the task it actually asks for is not.

---

## #114 — S-US4: Add and manage deal line items → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Adding a line creates an order line; editing or removing updates or removes it | **partially met** | Add `save-deal.SD1`; edit `SD14`. **Remove is dropped** — KI-20, cause in orders. `SD6` holds the tripwire. |
| The picker offers only active, in-window products of the deal's selling company | **met** | `product-picker.PP1` (active), `PP2` (the cross-tenant leak), `PP3` (window at both ends, NULL means always), `PP4` (evaluated *as of* a date, so the same catalogue answers differently in time). |
| No price field is enterable by the rep | **met** | `deal-workspace.component.html:411-412` renders `UnitPrice` read-only. **`save-deal.SD19`** is the real proof: sales sends product and quantity, and everything else on the line comes back from orders. |
| No deal-level line-item records exist anywhere | **met** | E2. |

---

## #115 — S-US5: Order status follows the deal → **partially met** (the earlier verdict is refuted)

The threshold is **not a flag**. It is `PipelineStage.OrderStatusOnEntry` — nullable, CHECK-limited to
`Draft | Quoted | Confirmed | Voided`, declared per stage (`docs/DECISIONS.md` D-OS1). Andrew rejected the
boolean in favour of this, and it is strictly more expressive: the same mechanism carries the win, the loss and
the reopen, and a pipeline can put the threshold wherever its own motion actually reaches agreement.

| Rule | Verdict | Evidence |
|---|---|---|
| Deal created → Draft | **met** | E1: every deal's order is Draft unless a stage moved it. |
| Agreement stage or higher → Quoted | **met** | `planStageOrderStatus()` `DealEntityServer.ts:583`, applied at `:646` inside `saveWithinScope()`. `close-won-order.CO3`. Seeded: Proposal, Negotiation and Signed all declare `Quoted` (`metadata/pipeline-stages/`). |
| Closed Won → unchanged, order still editable | **met** | `close-won-order.CO4` (no second order), `CO5` (still editable). |
| Closed Lost → Voided | **met** | E1: `DEAL-9006` stage `Lost`, order `Voided`. `CO3`. |
| Reopened → Quoted or Draft per stage | **not met, blocked upstream** | `Voided` is terminal in orders' `CanTransition`, so a reopened lost deal's order stays voided. The reopen **succeeds and warns** rather than half-failing — `CloseDealOperation.ts:813-816`, `CO5`. That is the designed outcome, not a tolerated one, but the criterion as written is not met. |
| No manual path for the rep | **met** | No UI control writes order status; `custom/server-owned-fields.ts` keeps it off the generated form. |

### A gap E1 found that no check covered — now fixed

**`DEAL-9003` sat at stage `Proposal`, which declares `Quoted`, with its order at `Draft`.**

```
DEAL-9003  order=yes  status=Draft  stage=Proposal  declares=Quoted  DIVERGES
```

The writer reacted to `PipelineStageID` **changing**, which is right for a move and wrong for a birth. A
deal already at or above the threshold when its order was provisioned never triggered it, so it kept
`Draft` until somebody happened to drag the card — a state the board displays without complaint. Same
class as the provisioning guard fixed earlier the same day (`SD24` / `M-PV1`): correct on the transition,
wrong on the state. It would have hit every open deal the HubSpot import lands past Proposal in S6.

**Fixed in this session.** `_orderJustProvisioned` lets a birth ask the question a move asks
(`DealEntityServer.ts:583`). Pinned by **`save-deal.SD25`**, which gives a stage an opinion, strands a
saved deal without an order, and saves it WITHOUT moving the stage — so a pass cannot come from a move —
and by mutant **`M-PV2`**, which reverts the gate and fails SD25 alone. E1 now reports no divergence on
any of the seven deals, and `seed-demo-lines.mjs` levels every deal with its stage rather than only the
two closed ones.

---

## #116 — S-US6: Close a deal as Won → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Closed Won locks the deal; locked fields refuse edits at the server regardless of path | **met** | `close-deal.CD5` refuses a raw `BaseEntity.Save()`; `CD6` and `CD14` prove the lock is field-by-field against the *shared* editable set, not a wall; `CD13` covers the child collections. |
| An append-only state event with amount and probability stamped | **met** | `close-deal.CD4`; `board-move.BD1/BD2/BD4` for the general case. |
| Downstream creation fires per pipeline | **partially met** | Contract routing is real and policy-driven, not status-driven: `CD1`, `CD2` (same won status, different policy, no contract), `CD3` (a caller override beats the pipeline default). **The tasks do not exist** (#34, #35). |
| With a downstream app absent, the close succeeds and records what it could not create and why | **met** | `close-deal.CD7` — a stubbed downstream reports `Executed: false` **with a reason** and fabricates no id. |

---

## #117 — S-US7: Close a deal as Lost → **met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Locks the deal and writes an append-only event with the loss reason | **met** | `close-deal.CD8` (refused without a reason), `CD9` (a reason flagged `RequiresNotes` is refused without notes and accepted with them), `CD4`. |
| The embedded order is Voided | **met** | E1: `DEAL-9006` → `Voided`. `CO3`. |
| No contract or tasks are created | **met** | `CD2` / `close-won-order.CO1` for the contract. No task exists to create — vacuously true, and it stays true when tasks are built only if the loss path is written to skip them. |

---

## #118 — S-US8: Reopen a closed deal → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Reopening without a reason is refused | **met** | `close-deal.CD10`. |
| The reopen is a new event; the close event remains intact | **met** | `close-deal.CD11` — clears the close stamps and **preserves** the close event. |
| The deal is editable again | **met** | `CD11`; the lock is suppressed only inside `BeginReopen()` (`DealEntityServer.ts:863`), the one audited path, deliberately not public. |
| The embedded order status is restored per S-US5 | **not met, blocked upstream** | As #115 — `Voided` is terminal in orders. |

The story's own open question — what happens to an already-created contract and tasks on reopen — is still
open, and the code takes the proposed position by default: nothing automatic.

---

## #121 — S-US11: Pipeline board and dashboard → **met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Dashboard shows the four answers with live data | **met** | `sales-section.component.ts:301-332` — open pipeline value, open deals, past expected close, won to date. Every count branches on a `DealStatusType` **flag** (`IsOpen`/`IsWon`), never a name. |
| Rows open the deal via Explorer navigation | **met** | `OpenCustomer()` / `nav.OpenEntityRecord()`. |
| Board groups deals by stage within a pipeline | **met** | `deal-board.component.ts:134`. |
| Priced and stated amounts are visually distinguishable | **met** | `deal-board.component.html:102` marks the priced ones; `sales-section.component.html:178-179` tags a hand-typed figure `stated`, titled *"Entered by hand — not priced by the orders engine"*. **E1 confirms the data now supports it: 5 priced, 2 stated.** Before today every seeded deal was stated, so this rendered but proved nothing. |
| No raw IDs anywhere | **met** | No template interpolates an `*ID` field. |

**One fragility worth naming.** `ClosingSoon` (`sales-section.component.ts:356`) is documented as *"soonest
expected close first"* and applies **no sort** — it relies entirely on the roster query's
`OrderBy: 'ExpectedCloseDate ASC, Name ASC'` (`deal-workspace.service.ts:271`). Correct today. It becomes
silently wrong the moment that query's ordering changes, and the comment would still claim otherwise.

---

## What this audit adds to the backlog, smallest first

1. ~~**`ClosingSoon` should sort what it claims to sort.**~~ **DONE** — it sorts on `ExpectedCloseDate` over a
   copy, so the comment is enforced by the code beneath it rather than by an `ORDER BY` two files away.
2. ~~**Apply a stage's declared order status when the order is provisioned**~~ **DONE** — `SD25` and `M-PV2`.
3. **Rename `Pipeline.RequiresDealLines`** → `RequiresOrderLines`. Cosmetic, but it is the last place the retired
   table's name survives, and a reader will misread a policy flag as a pointer to a table.
4. **Refuse a direct `OwnerEmployeeID` edit on a header-only save** (finding (b)). Needs its own check and mutant.
5. **Resolve the active `ContractTemplate`** in the seam (#34).
6. **BizApps Tasks integration** — the whole of #35, and half of #34 and #116. The largest item here by a wide
   margin, and the one a finance user would notice first.
7. **Create-and-return for the inline account/contact picker** (finding (a)). Needs an MJ-level primitive this
   surface does not have.

Two of these are not ours: **KI-20** (line removal, orders) and **#34's per-type contract defaults** (contracts
has no columns to default from).
