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

`DealEntityServer.planReopenOrderRecovery` now returns the order to `Draft` when a restored stage
declares nothing, a reopen is in progress, and the order is neither editable nor booked. It lives in
the entity server so the form, the status field, an importer and an agent all get it, and is keyed on
the reopen scope so the ordinary backwards move — Proposal to Qualification — still leaves a live
`Quoted` order alone. Declaring a status on the early stages would have fixed the reopen and broken
that move.

This also sweeps a premise recorded in **eleven** places: that "Voided is TERMINAL in orders", so a
reopen into `Proposal` would ask for a move orders refuses and warn. Orders says otherwise by its own
API — `TRANSITIONS.Voided` is `['Draft', 'Quoted']`, `IsTerminal('Voided')` is false, and `Confirmed`
is the terminal status. The refusal that rationale predicted never happens.

The root cause is KI-27: orders collapsed its order lifecycle on 2026-08-25, which inverted which
status is the dead end. Three checks were repaired at the time — `close-deal.CD24`,
`close-won-order.CO5` and `71-lost-and-reopen`'s step 3 — but the prose around them was not, so two
files ended up asserting the old premise a few paragraphs above the block that disproves it. The
copies were in `CloseDealOperation`, `DealEntityServer`, the seed script's stage commentary, two in the
deal workspace component, the `71-lost-and-reopen` header plus its mutant recipe and its live
rationale, two in the deal form, CO5's intro, `DECISIONS-NEEDED.md` DN-18, eight `STORY-AUDIT.md` rows,
and — the one no count had reached — the `_comments` block on the **Lost stage row in shipped
metadata**, which named it as the reason the reopen warns.

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

`DealStageEvent` has no loss columns and record-change tracking captured nothing for these fields, so
clearing alone would have destroyed the reason rather than moved it. The reopen now folds the reason
and notes into its own append-only event note first, then clears the header fields.
