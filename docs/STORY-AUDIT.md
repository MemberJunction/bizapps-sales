# Story audit — the code half, on the INTEGRATED branch

**Third pass:** 2026-08-20 · `feature/embed-order-on-deal`, after integrating three feature branches
**Fourth pass:** 2026-08-25 · **`next`**, after PR #25 merged that branch in
**Source:** `MemberJunction/bc-aidp-next-golive`, read-only

> The third pass below stands as written and is not edited. The fourth pass audits the two stories it
> deliberately declined — **S-US9 (#119)** and **S-US10 (#120)** — and revises nothing else, because
> nothing else changed. See **FOURTH PASS** immediately after the verdicts table.

## THIS IS THE THIRD PASS, AND THE FIRST ONE WORTH REPORTING

Both earlier passes audited trees that did not contain the code they were judging, and each got the built
parts right and the absent parts wrong for the same reason.

* **Pass 1**, from `feature/pipeline-board-rebased`, predated `PipelineStage.OrderStatusOnEntry` and
  concluded that no stage was marked as the agreement threshold — so #115, #118 and rows in #35/#117 were
  "all the same unbuilt mechanism". The threshold exists, is seeded, and has coverage.
* **Pass 2**, from this branch before integration, missed `feature/closewon-tasks` entirely and reported
  #35 as *not met*, with #34's task criteria and #116's downstream criterion resting on the same absent
  evidence. S-US3 was built and green the whole time.

**Both errors were "grep found nothing" mistaken for "the feature does not exist".** An absence cannot be
proven by a passing test, and it cannot be proven by a search either — not before establishing that the
tree being searched is the tree being reported on. That is why this pass came after the merges rather
than before them.

## THE ANSWER, IN ONE LINE

**Four of the nine are met outright** — #35, #116, #117, #121. Of the five that are not, **every remaining
gap is now upstream** — nothing outstanding in this audit is ours.

| Issue | Verdict | The remaining gap | Whose |
|---|---|---|---|
| **#33** S-US1 Create a deal | partially met | Line removal only (KI-20). Stage-driven probability/forecast **was** the one gap that was ours; it is now on the write path — `BD5`, `BD6`, mutants `M-BD1`/`M-BD2`/`M-BD3` | orders |
| **#34** S-US2 Contract + tasks | partially met | `ContractType` has no per-type renewal defaults; `ContractTemplate` has no `Status`, so the active template cannot be selected | contracts (D-9, D-10) |
| **#35** S-US3 Order-review task | **met** | — | — |
| **#114** S-US4 Deal line items | partially met | Removing an order line is silently dropped (KI-20) | orders |
| **#115** S-US5 Order status follows | partially met | `Voided` is terminal, so a reopened lost deal's order cannot return | orders |
| **#116** S-US6 Close as Won | **met** | — | — |
| **#117** S-US7 Close as Lost | **met** | — | — |
| **#118** S-US8 Reopen | partially met | The same terminal `Voided` | orders |
| **#121** S-US11 Board + dashboard | **met** | — | — |

**Nothing outstanding is ours any more.** Stage-driven probability and forecast category were the last of
it, and they now run in `DealEntityServer.saveWithinScope` beside the order-status writer, the stage event
and the amount cache — same trigger, same transaction, filling rather than overwriting. Everything still
open is one of three upstream facts: orders drops a line removal, orders treats `Voided` as terminal, and
contracts lacks two columns.

**One verdict I nearly got wrong, and the check stopped me.** I drafted "#114 moves to met, KI-20 no longer
reproduces" — then read `save-deal.SD6`, which asserts `after.length === 2`, i.e. that the removal IS
dropped. It passes. So KI-20 still reproduces and #114 stays partially met. The tripwire did exactly what a
tripwire is for: it refused a verdict I wanted to give.

**These last four merges moved no verdict**, and that is the expected result rather than a disappointment.
They carry #40's read model (now 15 MJ Queries, with the dashboard reading them) and the forecast job moved
from written to proven — none of which is among the nine stories in scope.

Everything below is the detail behind those verdicts.

Integrated across this effort, in order: `feature/closewon-tasks` (187c8a4, then `fbf414d`),
`feature/contracts-seam-v6` (a41473f, then `01b4437`), `feature/activities-and-ingest` (1db90c9, then
`99be05b`), `feature/forecast-query-source` (`d348a88`), `feature/dashboard-queries` (`172a6d8`). Nine
merges, of which **four were corrections for a head that had already moved**.
`docs/INTEGRATION-LOG.md` records which commit each one consumed and the expected shape it was checked
against — which is why the last four were diffs against a stated baseline rather than guesses.

**Evidence base: 121 integration checks across 9 bundles**, 0 failed, 0 skipped, plus E1–E4 from
`scripts/audit-story-evidence.mjs` and `test-harnesses/compare-dashboard-measures.mjs` at 11 agree / 0
differ.

Settled before this run and deliberately not re-examined: **#37/#38/#39** are superseded, **#93** and
**#83** are met, **#120** is strictly broader than #38/#39 combined. S-US9 (#119) and the Outlook ingest
arrived with the third merge and are **not** audited here — they were not in scope, and claiming a verdict
on them would repeat the mistake this pass exists to correct.

## How "met" is established

The rule for this pass was *prove met criteria against the database, not the screen*. Three sources:

1. **The 121 integration checks** across 9 bundles (`node scripts/assert-check-count.mjs`, which now runs
   the suite itself rather than trusting a log off disk). Every check hits a live database with nothing
   mocked and rolls back. Where a criterion maps to a check, the check id **is** the evidence, and
   `docs/CHECK-MUTATION-EVIDENCE.md` records which mutant proves that check can fail — for the **59 of 121**
   it covers. `activities` (22) and `forecast` (13) have no mutant at all, so for those the honest
   statement is that they pass rather than that they work. That document used to claim all of them.
2. **`scripts/audit-story-evidence.mjs`** — four things no check answers, cited below as **E1–E4**.
   E4 exists because WT1–WT10 prove what the close *writes* inside a transaction that rolls back; it asks
   the different question of whether the rows they resolve exist outside one.
3. **Code reading**, for UI behaviour and for absences — with the tree established first, this time.

## Verdicts

| Issue | Verdict |
|---|---|
| **#33** S-US1 Create a deal record | **partially met** — 4 of 5 checklist criteria met; line removal is upstream (KI-20), and the body's stage-driven probability is the one gap in this whole audit that is OURS |
| **#34** S-US2 Contract + tasks on Closed Won (B2B) | **partially met** — contract and both tasks are real; two field-level criteria are upstream gaps |
| **#35** S-US3 Order-review task on Closed Won | **met** |
| **#114** S-US4 Add and manage deal line items | **partially met** — add and edit work; removal is dropped upstream |
| **#115** S-US5 Order status follows the deal | **partially met** — 5 of 6 rules met; reopen is blocked upstream |
| **#116** S-US6 Close a deal as Won | **met** |
| **#117** S-US7 Close a deal as Lost | **met** |
| **#118** S-US8 Reopen a closed deal | **partially met** — 3 of 4; the order cannot come back |
| **#119** S-US9 Log an activity on a deal | **met** — fourth pass. **It was broken until 2026-08-25**, see below |
| **#120** S-US10 Auto-ingest Outlook mail and meetings | **partially met** — fourth pass; 3 of 4, and the fourth is a deliberate design choice |
| **#121** S-US11 Pipeline board and dashboard | **met** |

Four of the nine are met outright. Every remaining gap but one is **upstream of this repo** — orders'
line removal (KI-20), orders' terminal `Voided`, and two columns contracts does not have. The one that is
ours is #33's inline create-and-return.

---

## FOURTH PASS — 2026-08-25, on `next`

The third pass declined S-US9 and S-US10 on the grounds that they arrived with the third merge and were
not in scope: *"claiming a verdict on them would repeat the mistake this pass exists to correct."* That
was right then. They are audited now, against `next` after PR #25, with the same rule — prove it against
the database, not the screen.

**Evidence base has moved**: 132 integration checks across the same bundles, 0 failed, 0 skipped (was
121). The Explorer harness now runs 26 passed / 1 failed / 3 skipped, the single failure being console
noise from an orphaned restored-record reference on the shared dev host, not a product defect.

### #119 — S-US9: Log an activity on a deal → **met** (all three criteria, as of 2026-08-25)

**AND IT WAS BROKEN UNTIL TODAY, WHICH IS THE FINDING THAT MATTERS.** The timeline resolved its action
with `(provider as unknown as { Actions?: ... }).Actions ?? []`. `IMetadataProvider` exposes no `Actions`
member, so the cast produced `undefined`, `?? []` made it an empty array, and the lookup returned null on
every call ever made. The UI then reported *"The Log Activity action is not installed in this
deployment — run `mj sync push --dir metadata`"*, which is specific, actionable and wrong: the row is
present, Active, in the Sales category, identical to a freshly seeded database.

That message cost real time — the metadata push it recommends was performed, changed nothing, and
repointed both pipelines onto a company with no products on the way past (KI-26). Fixed in `ed20da6` by
resolving through a `RunView` against `MJ: Actions`, which is MJ's own pattern from
`interactive-form-apply.service.ts`.

| Criterion | Verdict | Evidence |
|---|---|---|
| An activity can be created from the deal workspace and appears on the deal | **met** | `70-activity-timeline` write path, 17s; **AC1** writes ONE Activity linked `Regarding` |
| Activities link to the deal, account and contact as applicable | **met** | **AC3** links the deal parties under COMMON entities with the shared PK unchanged; **AC4** an unknown participant becomes an identity link rather than a stub Person |
| Activities on a closed deal remain visible; whether new ones can be added follows the same rule as other open-on-purpose fields | **met** — closed 2026-08-25 | `70-activity-timeline`, third test. It resolves a locked deal BY FLAG, proves the lock is genuinely on (Deal name frozen — it sits outside `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`), then asserts the timeline still renders, the log control is still offered, and the activity actually lands with its participant links. Logging stays open for the reason `close-lock.ts` gives for Description and NextStep: "a closed deal still needs notes… without reopening the deal and falsifying its provenance" |

Verified on the host, and it is worth recording what a real ingested item looks like, because it is the
shape the criteria describe: three links per activity — `Regarding` → the Deal, `From` → a Person, and
`To` → **no entity at all**, carried as `IdentityKind=Email` / `IdentityValue=...`. That is not a broken
link. It is the schema's designed answer for a participant who is not a known contact, and it is what
the sync job's `unattributed` counter reports.

### #120 — S-US10: Auto-ingest Outlook mail and meetings → **partially met**, 3 of 4

| Criterion | Verdict | Evidence |
|---|---|---|
| Emails involving a deal's contacts appear without manual entry | **met** | **AC6** relevance by exact ContactMethod match, never by domain; **AC7** an irrelevant batch writes nothing, filter before any write. Two real ingested mails sit on DEAL-9001 |
| Meetings involving a deal's contacts appear without manual entry | **met** | **AC13** a meeting goes through the same pipeline — attendees, dedupe, Meeting by code; **AC14** mail and meetings keep separate watermarks; **AC18** a cancelled meeting stores Cancelled (D-25) |
| Items link to account and contact **even where no deal match exists** | **NOT MET — deliberately** | **AC10**: a known contact on no open deal is *"reported, not filed and not invented"*. Items without a deal match are surfaced, not written. That is a design decision, not an oversight, but it is not what the criterion asks for and should be settled with the story's author rather than quietly counted as met |
| Duplicates are not created on repeated sync runs | **met** | **AC8** the same batch twice writes once, idempotent on `(SourceSystem, ExternalID)`; **AC9** the watermark advances and the next run fetches nothing; **AC20**/**AC22** a failed write or lookup HOLDS the watermark |

### #93 — confirmed still met, with fresh evidence

The third pass listed #93 as settled without re-examining it. It asks that deal lines reference the
catalogue `Product` by ID rather than carrying a product name as text. Re-measured on the host today:
**69 order lines, 69 with a real `ProductID`, 69 resolving to a catalogue row** — no name-text lines
anywhere. The embedded-order redesign satisfies it by construction, since the lines live on the order
and `OrderLine.ProductID` is a real FK.

### What the tracker says versus what is true

Ten of the eleven S-US issues are still OPEN in `bc-aidp-next-golive`, including **#35, #116, #117 and
#121, which this audit calls met**, and now **#119**. The tracker understates what is done. Every
remaining gap is upstream: order-line removal (KI-20) and terminal `Voided` belong to orders, the two
contract field gaps to contracts (D-9, D-10).

---

## #33 — S-US1: Create a deal record → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Creating a deal creates its embedded order in Draft, same action | **met** | `DealEntityServer.ts:480` `provisionEmbeddedOrder()`; declared at `deal-entity.ts:155`. `save-deal.SD18`. **E1: 7/7 seeded deals carry an order**, each Draft unless a stage moved it. |
| Adding a line creates an order line; removing removes it | **partially met** | Add and edit: `save-deal.SD1`, `SD14` (two levels down, one save). **Removal is silently dropped** — `save-deal.SD6` is a tripwire pinned to the current wrong behaviour, cause diagnosed in orders' `savePendingLines`, `docs/KNOWN-ISSUES.md` KI-20. |
| No deal-level line-item records exist anywhere | **met** | **E2: no table matches `%DealLine%`, no entity matches `Deal Line`.** The only surviving occurrence of the name is `Pipeline.RequiresDealLines`, a policy flag choosing priced vs header-only mode — not a record. |
| The rep can create the account or contact inline without leaving the deal workspace | **met, after a fix in this session** | `CreateRelated()` now opens a **slide-in** via `MJFormPresenterService` — the pattern `OpenLineDetail` already established — reads the created record from `AfterSaved()`, reloads the lookups, and selects it into the field it was launched from. The workspace never goes away. See finding (a). |
| The owner column matches the Owner-role team member **and cannot be edited directly** | **met, after a fix in this session** | Matches: `DealEntityServer.ts:1021` `stampOwnerFromTeam()`, `save-deal.SD3`. **Cannot be edited directly: was NOT met, now is** — `ownerStampEditRefusal()`, `SD26`, `M-OW1`. See finding (b). |

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

That reasoning is sound about *silent* selection. It is not an argument against **returning the record**.

**FIXED in this session, and the old reasoning was half right rather than wrong.** The claim that there is
no reliable moment to come back at was a fact about the TAB, not about the problem: a tab has no lifecycle
the component can await, so there genuinely was no moment. A slide-in has exactly that moment.

`CreateRelated()` now uses `MJFormPresenterService.Open` with `Presentation: 'slide-in'` and no
`RecordId` — the presenter's own contract for a new record — which is the same pattern `OpenLineDetail`
established for order lines. `AfterSaved()` resolves with the created `BaseEntity`, so the id is available
without guessing. My earlier note that "MJ offers no app-level create-and-return primitive" was **wrong**:
the primitive was already in use in this file, one method away, for child records.

Three details that are not incidental:

* **The lookups reload BEFORE the value is assigned.** A `<select>` holding a value with no matching
  `<option>` renders blank, so the other order shows an empty picker for one change-detection pass — which
  reads exactly like the create having failed.
* **The label is re-read rather than composed.** `SalesAccount` IS an Organization and `SalesContact` IS a
  Person (same UUID), so a lookup's display name comes from the parent row through the view, and contacts'
  is assembled from `FirstName`/`LastName` by the service. Guessing it locally could disagree with the
  database; re-reading cannot.
* **The half of the old reasoning worth keeping is kept.** An explicit `switch` over a
  `DealRelatedTarget` union writes only the field the rep launched from — never a field they were not
  looking at. The create button is also now hidden when that field is not editable, so a locked deal
  cannot create a record it would then fail to attach; it was previously offered unconditionally.

**EXERCISED IN THE BROWSER, and one half could not be.** Verified by clicking, against the live Explorer:

| Claim | Result |
|---|---|
| It opens a slide-in, not an Explorer tab | **verified** — panel over the workspace, browser tab count unchanged, workspace still visible beneath |
| The title comes from the launching field | **verified** — "New customer" |
| Save left, Cancel right (house convention) | **verified** |
| The create button is gated on `IsFieldEditable` | **verified** — on the WON, locked `DEAL-9005` only `Open account`/`Open contact` render; on a new deal only `New account`/`New contact` |
| The created record is selected back into the picker | **verified**, after KI-23 was repaired and two defects of mine were fixed |
| The picker does not render blank after a successful create | **verified** — the select shows the new name as its selected value |

The first attempt could not create anything at all: `spCreateOrganization` did not exist on this host
(KI-23, since repaired). `SalesAccount` IS an Organization, so the save reached for the parent and found no
insert procedure, and `CreateRelated` correctly returned early rather than inventing a selection — the
failed-save path behaving right, not the success path.

**Once the create worked, the click-through found two defects in my own code that no test would have.**
Both are the kind that only appear when a real save completes:

* **GUID case.** `NewRecord()` generates the key client-side in LOWERCASE; `vwSalesAccounts` returns it
  UPPERCASE. `[ngValue]` compares by value, so nothing matched and **the picker rendered blank with the
  correct option sitting in the list** — the exact failure I had claimed to prevent by reloading first.
  Every part was individually right. Fixed by resolving the id THROUGH the reloaded lookup and binding the
  option's own value, so there is no case question to get wrong.
* **A read-after-write race.** On the next run the record was committed and `LoadLookups()` still did not
  include it — the option appeared moments later. So "reload, then find" is racy by construction, and it
  fails in the ugliest way: the record exists, the rep did nothing wrong, and their field stays empty. The
  reload is now an optimisation; when it has not caught up, the option is synthesised from the record in
  hand, de-duplicated by ID so the insertion is idempotent.

A third defect surfaced on the way and is **pre-existing, not mine**: `SelectTab` never called
`RefreshLock`, and `Lock` is a single component-level field — so opening a closed deal and switching back
left an open deal rendering read-only. It had always disabled the fields on the wrong tab; gating the
create buttons on the same rule is what made it visible, because a missing control is louder than a greyed
input. Fixed in `SelectTab` and in `OpenDeal`'s already-open path.

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

**FIXED, later in the same session.** `ownerStampEditRefusal()` (`DealEntityServer.ts`) refuses the save when
`OwnerEmployeeID` is dirty and the roster did not participate, with a message naming `SetOwner` — the operation
the caller actually wanted. Refusing beats silently re-deriving: quietly correcting a caller who believed they
were setting the owner produces the same wrong outcome with nothing to notice.

`SetOwner()` is untouched by it, and not by coincidence — it calls `Team.Load()` before assigning the stamp, so
the roster IS part of that save and the server re-derives the same value from it. The guard's two conditions
mirror `stampOwnerFromTeam`'s exactly, which is what keeps them from disagreeing.

**`save-deal.SD26`** asserts the refusal, that a refused save writes nothing, AND that the refusal is narrow —
the same header-only shape with an ordinary field must still save, or a guard that refused every header edit
would pass the first two assertions and break the app. Mutant **`M-OW1`** removes the guard and fails SD26
alone. Re-running the probe now reports `save returned false` with the stamp still matching the team row.

---

## #34 — S-US2: Contract and tasks on Closed Won (B2B) → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| A Contract record is created | **met** | `close-deal.CD1` routes it; `close-won-contract.CT1` reads the row back. `test-harnesses/prove-close-won-route.mjs` drives the whole route on live data: 11/11, contract `CTR-000004` created and stamped onto the deal. |
| Customer org, selling company, primary contact from the deal | **met** | `LiveContractsSeam.ts:154-162`. |
| `ContractNumber` — next from the sequence | **met** | **`CT1`** asserts contracts minted it and sales sent none. Two apps generating into one sequence is how a duplicate contract number reaches a customer. |
| `ContractTypeID` defaults to Order Form | **met, and it was broken in THREE places** | The policy named `"Standard"`, a contract type that exists on no host. Found in the metadata file by CT1, in the seeded DB row by CT6, and — during integration — a third time in `scripts/seed-demo-data.sh`'s pipeline `INSERT`, which is guarded by `IF NOT EXISTS` and so only fires on a host with no pipelines: every fresh install, and the one host nobody thinks to check. All three now `Order Form`. |
| `CreatingEntityID` / `CreatingRecordID` typed pair | **met** | `setProvenance()`; CT1 asserts both-or-neither, which is also contracts' own CHECK constraint. |
| `HasModifications` copied from the deal's flag | **met** | Was hardcoded `false` because `Deal` had no column to copy from. Built in this session: `Deal.StandardAgreementModified`. **`CT5`** proves the seam writes both values and reads absence as false; **`CT6`** drives the whole close and reads the contract it created. Mutants `M-CT2` and `M-CT3` cover the two hops separately — and M-CT3 is why CT6 exists, because mutating the close alone left every other check green. |
| A finance contract-processing **Task** | **met** | `CloseWonTaskService`, called at `CloseDealOperation.ts:340`. Task types now resolve by **`Code`** rather than `Name` — `close-won-tasks.WT12` proves the lookup uses `Code` where the column exists and falls back to `Name` only where it does not, so the vocabulary rule holds across the app boundary that KI/PR-#42 previously left open. **`close-won-tasks.WT4`** proves a contract-creating policy raises BOTH tasks; **`WT5`** proves the contract task falls back to the DEAL when no contract exists yet rather than going missing; **`WT6`** proves a missing task type is refused with a reason while the order review still lands. **E4** confirms the `Contract Processing` type exists outside a rolled-back transaction. |
| An order-review **Task** | **met** | See #35. |
| `AutoRenew`, `RenewalNoticeDays`, `CancellationWindowDays`, `AnnualIncreasePercent` defaulted **from the Contract Type record** | **not met, and not buildable from here** | Contracts' `ContractType` is `ID, Name, Description, RequiresExecutedDocument, Status, ParentStatusRequirement` — there are no per-type stored defaults to read. Sales sets three of the four only when the deal carries an explicit override (`setNegotiatedTerms`), and deliberately declines `RenewalNoticeDays` because contracts warns those two fields are not interchangeable. **An upstream ask on contracts**, independently recorded there as `D-9`. |
| `ContractTemplateID` — the `ContractTemplate` where `Status = Active` | **not met** | `LiveContractsSeam.ts:319` returns `input.ContractTemplateID ?? null`; nothing resolves the active template. Contracts' `ContractTemplate` has no `Status` column to select on — recorded upstream as `D-10`. |

**What changed from pass 2:** everything about tasks. Pass 2 reported "no task creation exists anywhere in
this repo" — true of the tree it read, false of the app. The two remaining gaps are both *columns another
app does not have*, which is a materially different kind of not-met from "unbuilt", and both are already
recorded on the contracts side.

---

## #35 — S-US3: Order-review task on Closed Won → **met**

| Criterion | Verdict | Evidence |
|---|---|---|
| An order-review Task is created on Closed Won, for **both** pipelines | **met** | `close-won-tasks.WT1` — created, typed as asked, and linked to the ORDER. `WT3` — a policy that creates no contract raises ONLY this task, which is the D2C half of the scope. `WT10` — raised through `Sales.CloseDeal` end to end. |
| Linked to the deal's embedded Order | **met** | `WT1` asserts the `TaskLink` target is the order, not the deal. `WT8` covers the honest edge: a deal with no order raises no order-review task **and says why** rather than linking to nothing. |
| Routed to finance/AR | **met, with a configuration caveat** | `WT2` asserts an assignment exists with the role it was given. `WT7` asserts the other branch: with no finance assignee configured the task is still created but **UNROUTED and says so**. `prove-close-won-route.mjs` shows that second path live on seeded data — its warning is `created but NOT routed: no finance assignee configured`, a seeded-policy gap rather than a defect. |
| The order is not locked or advanced by the close | **met** | `close-won-order.CO3`, `CO4`, `CO5` — status untouched, no second order, still editable. |
| Task writes participate in the caller's transaction | **met** | `WT9` — a rolled-back scope leaves nothing behind. This is the one that would have gone unnoticed: a task service opening its own transaction would strand orphan tasks behind every failed close. |

**E4** confirms the preconditions hold outside a transaction: `Task`, `TaskLink` and `TaskAssignment` all
exist, and both `Order Review` and `Contract Processing` types are seeded.

**One upstream note, surfaced by the integrated run rather than by reading.** `CloseWonTaskService` reports
that this host predates bizapps-tasks PR #42, so `TaskType` has no `Code` column and `ORDER_REVIEW` was
matched on its `Name`. It warns and proceeds. That is the right behaviour and worth knowing: until that
migration lands, renaming a task type breaks the resolution — the vocabulary rule biting from the far side
of an app boundary, where this app cannot enforce it.

---


## #114 — S-US4: Add and manage deal line items → **partially met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Adding a line creates an order line; editing or removing updates or removes it | **partially met** | Add `save-deal.SD1`; edit `SD14`. **Remove is dropped** — KI-20, cause in orders. `SD6` holds the tripwire. |
| The picker offers active, in-window products from ANY company — **changed by #29** | **met** | `product-picker.PP1` (active), `PP2` (products from other companies ARE offered — this check was INVERTED by #29 and now proves the opposite of what this row used to claim), `PP3` (window at both ends, NULL means always), `PP4` (evaluated *as of* a date), `PP5` (a line books to its product's company, not the deal's). The company clause was removed on 2026-08-26 per Johanna Snider; `DECISIONS.md` D5 records the ratification, and a deal now lives in one company's pipeline while its lines carry their own company. |
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

## #116 — S-US6: Close a deal as Won → **met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Closed Won locks the deal; locked fields refuse edits at the server regardless of path | **met** | `close-deal.CD5` refuses a raw `BaseEntity.Save()`; `CD6` and `CD14` prove the lock is field-by-field against the *shared* editable set, not a wall; `CD13` covers the child collections. |
| An append-only state event with amount and probability stamped | **met** | `close-deal.CD4`; `board-move.BD1/BD2/BD4` for the general case. |
| Downstream creation fires per pipeline | **met** | Contract routing is policy-driven, not status-driven: `CD1`, `CD2` (same won status, different policy, no contract), `CD3` (a caller override beats the pipeline default). The tasks fire per pipeline too: `WT3` (no-contract policy raises order review only) against `WT4` (contract policy raises both). **Pass 2 called this partially met because the tasks were on a branch it could not see.** |
| With a downstream app absent, the close succeeds and records what it could not create and why | **met** | `close-deal.CD7` — a stubbed downstream reports `Executed: false` **with a reason** and fabricates no id. |

**A merge hazard worth recording here, because it is what this criterion is made of.** Both the task
service and the order-status writer report non-fatal warnings, and each branch assigned the close's
`Issues` field alone. Taking either side textually would have silently dropped the other's warnings — a
close that quietly did half its downstream work and reported success. Resolved to one writer with a stated
ordering (tasks, then order status, matching when each actually happens), and both halves are now proven
live in the same run: `WT6`/`WT7` assert the task warnings, `CO5` the order-status one.


## #117 — S-US7: Close a deal as Lost → **met**

| Criterion | Verdict | Evidence |
|---|---|---|
| Locks the deal and writes an append-only event with the loss reason | **met** | `close-deal.CD8` (refused without a reason), `CD9` (a reason flagged `RequiresNotes` is refused without notes and accepted with them), `CD4`. |
| The embedded order is Voided | **met** | E1: `DEAL-9006` → `Voided`. `CO3`. |
| No contract or tasks are created | **met, and no longer vacuously** | `CD2` / `close-won-order.CO1` for the contract. The tasks half USED to be vacuous — nothing created tasks, so nothing had to skip them. Now that tasks are real, **`close-won-tasks.WT11`** asserts the negative directly: a lost close creates no task rows and links nothing to the deal's order. The gate is `if (target.IsWon)` at `CloseDealOperation.ts:338` — a FLAG, so a deployment that calls its losing status "Walked Away" is covered by the same assertion. Mutant `M-WT1` ungates it and fails WT11 alone. |

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

Done during this session, kept here so the trail is legible:

1. ~~`ClosingSoon` should sort what it claims to sort.~~ **DONE** — it sorts on `ExpectedCloseDate` over a
   copy, so the comment is enforced by the code beneath it rather than by an `ORDER BY` two files away.
2. ~~Apply a stage's declared order status when the order is provisioned.~~ **DONE** — `SD25`, `M-PV2`.
3. ~~Refuse a direct `OwnerEmployeeID` edit on a header-only save.~~ **DONE** — `SD26`, `M-OW1`.
4. ~~Assert that a LOST close raises no tasks.~~ **DONE** — `WT11`, `M-WT1`. Found by this pass: the
   criterion existed, the code was right, and nothing checked it.
5. ~~BizApps Tasks integration.~~ **ALREADY BUILT** — this was pass 2's largest backlog item and it was
   an artifact of auditing the wrong tree.

Still open, ours:

6. ~~**Create-and-return for the inline account/contact picker**~~ **DONE** — a slide-in via
   `MJFormPresenterService`, the pattern already in this file. My note that MJ lacked the primitive was
   wrong; it was one method away.
7. **Rename `Pipeline.RequiresDealLines`** → `RequiresOrderLines`. Cosmetic, but it is the last place the
   retired table's name survives, and a reader will misread a policy flag as a pointer to a table.
   Independently raised on the closewon-tasks branch as `D-3`, which is some evidence it misleads.
8. **Server-side derivation of probability and forecast category from the stage** (#33's body). It is
   UI-deep only today, so a deal created by an Action, an agent or the HubSpot import gets whatever the
   caller supplied.

Still open, not ours — and this is most of what is left:

9. **KI-20** — order-line removal is silently dropped. Cause diagnosed in orders' `savePendingLines`.
   Blocks #33 and #114.
10. **`Voided` is terminal in orders** — so a reopened lost deal's order cannot return. Blocks #115 and
    #118. The close warns rather than half-succeeding, which is the right behaviour for a rule this app
    does not own.
11. **Contracts has no per-type renewal defaults and no `ContractTemplate.Status`** — blocks two of #34's
    field criteria. Recorded on the contracts side as `D-9` and `D-10`.
12. **bizapps-tasks PR #42** — `TaskType.Code`. Until it lands, task types resolve by `Name`, so renaming
    one breaks the resolution. The service says so out loud; it cannot do better from here.
