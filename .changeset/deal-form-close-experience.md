---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-entities": patch
---

Deal form: close a deal through the close action, and stop offering columns the server owns (#205, #206).

**The Status control offers the open lifecycle only.** Picking a closing status from the dropdown
locked the deal without running any of the close — no stage event, no contract, no finance tasks, and
for a Lost deal no loss reason and a live order left behind. The control now lists the statuses that
do not lock, and the deal closes through a Close action on the Close panel, which calls
`Sales.CloseDeal` and collects the loss reason and notes the operation requires.

**The close stamps are read-only.** `ActualCloseDate`, `ClosedAt`, `ClosedByUserID` and
`LossReasonID` are written by `Sales.CloseDeal` and cleared by `Sales.ReopenDeal`, and were rendered
as ordinary editable fields — so a close date could be typed onto a deal nobody had closed. All three
bookings queries select on `ActualCloseDate IS NOT NULL`, so that deal would then have appeared in
the revenue figures. `DealEntityServer` now refuses a caller write to any of them unless a transition
has been declared, and the form renders them read-only so the refusal is not the first the user hears
of it. Loss Notes stays editable — it is the correction channel.

Two columns in the same shape are frozen with them: `CompanyID`, which
`stampCompanyFromPipeline` overwrites on every save (an editable box there was a silent discard), and
`OwnerEmployeeID`, which `ownerStampEditRefusal` refuses outright.

The field list lives in `sales-entities` so the form and the server cannot drift.
