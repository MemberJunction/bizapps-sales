# Pipeline board — decisions queued during the run

Calls made while building, each with the reasoning and the option taken. **D-BD1 and D-BD2 are the two
worth a real review**; the rest are recorded so nobody has to re-derive them.

---

## D-BD1 — MJ has no generic kanban component, so the board lays out its own columns

**This contradicts the brief and CLAUDE.md, so here is the evidence.** The brief says to reuse MJ's Angular
Generic kanban and explicitly not to hand-roll a board. At **MJ v5.51.0 that component does not exist**:

- no `@memberjunction/ng-kanban` package;
- no `kanban` match in any `@memberjunction/*/package.json`, nor anywhere in `ng-ui-components` or
  `ng-shared-generic`;
- the other components CLAUDE.md lists in the same sentence **do** exist (`ng-timeline`,
  `ng-filter-builder`, `ng-entity-card`, `ng-join-grid`), so the list is aspirational for kanban rather
  than simply wrong.

**Chosen: lay out the columns in `deal-board.component`, but do not invent the drag.** It uses
`@angular/cdk/drag-drop`, which is already the in-house primitive *in this very package* —
`vendored/workspace-tabs/workspace-tab-strip.component.ts` imports `CdkDropList`/`CdkDrag` for tab
reordering. Same library, same idiom, no new dependency, and nothing novel about the interaction model.

The alternatives were worse: waiting blocks the whole deliverable on an upstream component that may never
land, and adding a third-party board library would put a new dependency in a repo whose standalone-ness is
a stated property. The component header names itself as the thing to delete when a generic kanban arrives.

**For review:** if a kanban is in fact coming in MJ 5.52+, this is the piece to throw away, and it is
deliberately isolated in one directory to make that cheap.

---

## D-BD2 — The stage event is appended in `Sales.SaveDeal`, not in `DealEntityServer.Save()`

The base branch stamped **nothing** on a stage change — `DealEntityServer` only carried a comment saying S4
would. So the board's drag had no provenance at all, and the brief asked me to ensure the move writes one.

`Save()` is the house location for a rule that must catch every writer, and that was my first instinct.
**It is the wrong place here**, for a specific reason: `feature/close-flow`'s `CloseDealOperation` already
writes its own `DealStageEvent` and *then* saves the deal with a changed stage and status. Stamping inside
`Save()` would append a **second, duplicate event on every close** the moment those two branches meet.

**Chosen: append inside `Sales.SaveDeal`** when it observes the stage change, sharing one explicit
transaction with the save.

**The cost, stated plainly:** a raw `BaseEntity.Save()` that changes a stage still stamps nothing. That is
weaker than the "enforced in the entity server, never the UI" pattern the app uses for the close lock.
Every path that matters today goes through the operation — the board, the workspace dropdown, an Action, an
agent — but a hand-written save does not.

**Recommendation:** when the close flow merges, move the stamping into `DealEntityServer.Save()` and delete
`CloseDealOperation`'s own append, so there is one writer. That is a small, mechanical change *after* the
merge and a merge conflict *before* it, which is why it is not done here.

---

## D-BD3 — The board is a rail page, not its own section

The nav model's header said the pipeline board would be "a real section later".

**Chosen: a rail page between All deals and Workspace**, and the header comment is updated to say why: the
board is another way to look at the same deals, alongside the dashboard and the roster — not a different
job. Sections cross jobs; the rail moves within one. Its position follows the order of narrowing: what is
happening, where things stand, then this specific deal.

---

## D-BD4 — A move reuses `LoadDraft` + `Save` rather than a bespoke write

A dedicated `Sales.MoveDealStage` operation was the brief's other suggestion, and it is the tighter API.

**Chosen: reuse the existing path.** A new remote operation needs a metadata row, `mj sync push`, and a
CodeGen pass to emit its shell — and on this machine the live DB still carries `#31`'s `AutomationRule*`
tables *and* `feature/close-flow`'s `Sales.CloseDeal` metadata rows, so a CodeGen run would regenerate both
into this branch and every commit would need hand-filtering. That is a lot of avoidable risk for an
overnight MVP.

Reusing `LoadDraft` → set stage → `Save` also earns the validation, the company resolution, the owner stamp
and the new stage event without the board knowing they exist, and round-trips lines and instalments intact
(the operation treats a present array as the complete desired set, so a partial payload would delete
children).

**The cost:** a move reads and rewrites the whole deal tree to change one field. At demo scale that is
invisible; at thousands of deals it is not. `Sales.MoveDealStage` is the right follow-up once the DB is
clean enough to run CodeGen safely.

---

## D-BD5 — A closing column is shown disabled, not hidden

The brief said to disable drag-to-close with a hint.

**Chosen: render the column dashed and inert with a lock icon and an explanatory title**, refused in *two*
places — the CDK enter-predicate and the drop handler. Hiding the column would make the board lie about the
pipeline's shape, and a rep looking for "where do won deals go" needs to see that the answer is "not by
dragging". Two guards because a lock freezes the deal, its lines and its team, and one guard is one bug
away from an accidental close.

**Queued for design, as the brief asked:** *close from the board.* The obvious shape is that a drop onto a
closing column opens the deal in the workspace with the close dialog primed, so the gesture starts the
close rather than performing it. Not built.

---

## D-BD6 — Deals with no stage get their own row of chips

Not mentioned in the brief; found while building, because a board assembled from stage columns silently
drops them.

**Chosen: a "No stage set" strip below the columns.** On a stage-column board these deals would be
invisible, and "missing from the board" is indistinguishable from "does not exist" — which is the failure
mode most likely to be mistaken for data loss.

---

## D-BD7 — Column totals label their own incompleteness

`SUM(Deal.Amount)` over a column's cards silently ignores deals whose amount is NULL, and 4 of the 6 seeded
demo deals have no amount.

**Chosen: sum what exists and show `+N unpriced` beside it.** A total that quietly omits half its column
reads as a *smaller* total rather than a partial one, which is the more dangerous of the two errors. The sum
is taken over deals, once each — never across `DealTeamMember`, which is the documented attribution
double-count trap.

---

## D-BD8 — The `AmountIsComputed` provenance marker is carried onto the card

**Chosen: a small calculator icon when `Deal.Amount` came from orders' pricing engine**, mirroring the
roster's "stated" flag for the opposite case. A hand-typed amount and a `PreviewOrder` answer are different
kinds of fact, and a board that renders them identically invites treating a transcription as authoritative.

---

## D-BD9 — No schema change, and none was needed

Every column the board reads already existed: `PipelineStage.DisplayOrder` / `.Probability` /
`.ForecastCategoryTypeID` / `.DealStatusTypeID`, `DealStatusType.LocksDeal`, `Deal.PipelineID` /
`.PipelineStageID`, and the whole of `DealStageEvent`. Verified against the live schema before writing any
code. The only additions were **read-only** query fields and lookup properties in the Angular service.

---

## D-BD10 — Column recomputation is not memoized

`Columns` rebuilds on every change-detection read.

**Chosen: leave it.** It matches how `IssuesForPane` and the dashboard tiles already work, and the input
sizes are a handful of stages against tens of deals. If a board ever renders thousands of cards this is the
first thing to cache — but caching it now would add invalidation logic to defend against a load nobody has.
