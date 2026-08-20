---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

**BREAKING — `CloseWonPolicy.OrderState` is removed from the published input contract.** A deployment
setting it is configuring nothing; what it used to say is now said by the STAGE.

`PipelineStage.OrderStatusOnEntry` (nullable, `Draft | Quoted | Confirmed | Voided`) is the new home for
"what does this mean for the deal's order" — S-US5, ruled by Andrew in `docs/DECISIONS.md` D-OS1. It
mirrors `DealStatusTypeID`, which already answers the same question for the deal's own status from the
same table, and unlike a close-time policy key it speaks on every stage change rather than only at the
moment of a won close.

- **The writer is on the WRITE PATH** — `DealEntityServer.Save()`, keyed on `PipelineStageID` changing,
  beside `provisionEmbeddedOrder()` and inside a transaction that commits with the deal. Not the UI: a
  stage change arrives from the board's drag, an importer or an agent (D-OS3).
- **A refused order update never blocks the stage change** (D-OS2). `CanTransition` — orders' own table
  of legal moves, imported rather than restated — is asked first, so the guaranteed refusal
  (`Voided → Quoted` on a reopened lost deal) costs no write and the warning carries orders' wording.
  Warnings surface as `Issues` with `Severity: 'warning'` from `Sales.CloseDeal` and `Sales.ReopenDeal`.
- **`Posted` and `Fulfilled` are not available to a stage.** They are finance and fulfilment outcomes;
  a stage that could name them would let the board post to the ledger.
- **Seeded:** `Quoted` from Proposal onward including the winning stage, `Voided` on Lost, nothing on the
  early stages. `Confirmed` is seeded nowhere on purpose — see `DECISIONS-NEEDED.md` DN-10, which is one
  field on one row.

This completes S-US7 (a lost deal voids its order) and S-US8 (a reopened deal warns instead of
un-voiding — the intended behaviour, not a gap).
