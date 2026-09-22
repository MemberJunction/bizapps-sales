---
'@mj-biz-apps/sales-core-entities-server': patch
---

A reopened deal could be left pointing at a voided order, in silence.

golive#205 asks that reopening a deal "return the order to Quoted or Draft". The order follows
`PipelineStage.OrderStatusOnEntry`, and a reopen restores the stage the deal was in BEFORE the close
— so the order only came back if THAT stage declared something. `Proposal`, `Negotiation` and
`Signed` declare `Quoted` and did. `Discovery` and `Qualification` declare nothing, so a deal lost
from an early stage reopened with its order still `Voided`, and no Issue said so.

Measured before the fix: DEAL-9002, lost from Qualification, reopened `Open` with ORD-000293 left at
`Voided` and zero Issues raised. That is the silent half of D-OS1 — the deal neither followed nor
complained.

`DealEntityServer.recoverOrderOnReopen` now returns the order to `Draft` when a restored stage
declares nothing, a reopen is in progress, and the order is neither editable nor booked. It lives in
the entity server so the form, the status field, an importer and an agent all get it, and is keyed on
the reopen scope so the ordinary backwards move — Proposal to Qualification — still leaves a live
`Quoted` order alone. Declaring a status on the early stages would have fixed the reopen and broken
that move.

This also sweeps a premise recorded across **nine files**: that "Voided is TERMINAL in orders", so a
reopen into `Proposal` would ask for a move orders refuses and warn. Orders says otherwise by its own
API — `TRANSITIONS.Voided` is `['Draft', 'Quoted']`, `IsTerminal('Voided')` is false, and `Confirmed`
is the terminal status. The refusal that rationale predicted never happens.

The root cause is KI-27: orders collapsed its order lifecycle on 2026-08-25, which inverted which
status is the dead end. Three checks were repaired at the time — `close-deal.CD24`,
`close-won-order.CO5` and `71-lost-and-reopen`'s step 3 — but the prose around them was not, so two
files ended up asserting the old premise a few paragraphs above the block that disproves it.

The files this branch corrects: eight rows in `docs/STORY-AUDIT.md`; the deal workspace component, the
deal form, `71-lost-and-reopen` and `docs/DECISIONS.md` (D-OS2's ruling and its own escape clause), two
lines each; and one each in `CloseDealOperation`, CO5's intro, `DECISIONS-NEEDED.md` DN-18, and — the
one no count had reached — the `_comments` block on the **Lost stage row in shipped metadata**, which
named it as the reason the reopen warns.

**Stated as files because the earlier counts were wrong, which is this section's own defect.** The PR
said "eight places" and this note said "eleven"; the enumeration named `DealEntityServer` and the seed
script's stage commentary, and neither carried the premise at all — `DealEntityServer`'s entire diff
against `next` is one changed import. "Places" was never checkable, and an unverifiable count is how
the premise spread in the first place. Files are countable: `git diff next...HEAD` and grep.

The ruling is now recorded once, in `docs/DECISIONS.md` **D-OS4**, and the comments cite that rather
than KI-27 — KI-27 is the lifecycle collapse that caused the inversion, not the transition fact.

---

**The loss reason is a close stamp too, and a reopen now clears it.**

It stayed set on a reopened deal, which was wrong twice. The form showed "LOSS REASON" on a deal that
is Open, and `validateClose` reads `input.LossReasonID ?? deal.LossReasonID` — so the stale value
satisfied the *next* close. Measured: a deal closed Lost with a reason, reopened, then closed Lost
again supplying **no** reason succeeded with zero Issues and silently re-used `Price`. golive#205 asks
that "Lost should require a loss reason" and `close-deal.CD8` asserts that refusal; both were bypassed
for the rest of the deal's life after its first loss, which is why CD8 never caught it — it opens a
fresh deal that has never been lost.

`DealStageEvent` has no loss columns and record-change tracking captured nothing for this field, so
clearing alone would have destroyed the reason rather than moved it. The reopen now folds the reason
into its own append-only event note first, then clears the header field.

**`LossNotes` deliberately stays.** The symmetry is tempting and wrong: `close-lock.ts` keeps it — and
only it — editable on a locked lost deal, because *"notes are the channel for corrections"*. Clearing
it would destroy the one thing a rep is invited to write after a close, and alongside golive#224 it
turns perverse: that change saves an in-progress note precisely because losing typed work is the bug
it fixes, and this would then null it, leaving the text only in an event the rep never sees.

The stale-value argument does not rescue it either. `validate()` reads
`input.LossNotes ?? deal.LossNotes`, so a stale note can satisfy a `RequiresNotes` reason — but that is
the **same** `??` fallback as the reason's, and clearing on reopen closes one route into a fallback
rather than the fallback. It is ticketed separately and fixes both halves. The reason earned its
clearing on a measured, silent bypass of a field a rep cannot correct by hand; free text they can
overwrite is not the same case. `close-deal.CD32` asserts the notes SURVIVE, so the tidier-looking rule
cannot be reintroduced quietly.

---

**The close event now records which reason was chosen, which `close-lock.ts` already claimed it did.**

`LossReasonID` is frozen on every lost deal on the stated grounds that *"the close event records which
reason was chosen, and rewriting it would make that event dishonest"*. It did not. `routingNote()`
wrote the caller's note and the routing outcomes and nothing else, so the only copy of the reason was
the deal header — one field, frozen on the strength of a record that was never written.

That matters most for the deal this issue does not otherwise touch: one that stays LOST and is never
reopened. It has no reopen event, so before this change nothing recorded what it was lost for at the
moment it was lost.

The name is resolved where the reason is already validated — `validate()` is the only place that reads
the `LossReason` row, so this adds a column to an existing query rather than a query. It is read there
rather than from the denormalized `deal.LossReason` because the id being closed with is
`input.LossReasonID ?? deal.LossReasonID`: when a caller supplies one, the denormalized name still
describes the reason the deal happened to be carrying. `close-deal.CD35` closes with a reason that
differs from the header's and asserts the other name is ABSENT as well as the right one present.

`lossTrailFor` still puts the reason on the reopen event too. That is deliberate: the reopen row
records the CLEARING, and a reader asking why the header is empty should not have to find the close row
to learn what was removed.
