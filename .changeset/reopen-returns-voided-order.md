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

This also corrects a premise recorded in three places: that "Voided is TERMINAL in orders", so a
reopen into `Proposal` would ask for a move orders refuses and warn. Orders says otherwise by its own
API — `TRANSITIONS.Voided` is `['Draft', 'Quoted']`, `IsTerminal('Voided')` is false, and `Confirmed`
is the terminal status. The refusal that rationale predicted never happens.
