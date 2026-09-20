---
'@mj-biz-apps/sales-ng': patch
---

A closed deal's existing product lines can no longer be edited from the workspace.

**This is the half sales#84 missed, and its reviewer caught it.** #84 stopped this pane *offering*
Add on a closed deal. The review then pointed out that the same pane still let a rep change product,
quantity, discount and term start on one — and golive#206 item 1 covers edits, not just additions:
*"Adding, **editing** or deleting a line on a locked deal should be refused at the server, whichever
screen or API path it comes from."*

Those four inputs carried no `disabled` binding at all. `UnitPrice` and `LineTotalNet` were already
read-only — Sales must not price — so the gap was exactly the four a rep can type into.

**Not gated on `IsSaved`, deliberately, and that is the difference from `CanAddLine`.** Adding needs a
saved deal because the order is minted on first save. An unsaved deal is precisely where a rep
composes its lines, and nothing is frozen until a status locks it, so gating edits the same way would
break normal composition. A test pins that difference rather than leaving it to be re-derived.

**No second visible paragraph.** On a locked deal `AddLineBlockedReason` already renders *"This deal
is closed…"* beneath this grid. A second sentence saying the same thing about a different gesture
would be two messages for one condition — the reasoning #84 used to leave removal alone. The refusal
reaches a rep who hovers a greyed field through `title`, and the pane-level explanation is already on
screen. The product select keeps `ProductLabel` while editable, since the product name is what is
wanted there, and falls back to the refusal only while locked.

The wording is `This deal is closed. Set the status back to Open before changing what was sold.` —
golive#207 row 17's sentence, shared with the deal form's field refusal and this pane's Add hint, and
word-for-word what the server-side `DealLockRefusal('update')` produces in sales#98. A rep meets one
sentence wherever the same lock refuses them.

**Removal still needs nothing here.** `ShouldRefuseLineRemoval` is `!!line?.IsSaved`, so every saved
line is already declined at the gesture — for KI-20's reasons rather than the lock's, but the wall is
the same either way.

**Two more ways into the same fields, found in review of this PR.** Disabling what a rep can *type
into* left two controls that write without typing, and the requirement quoted above covers both:

- **The term-start reset.** The date input beside it was disabled; the button that clears it was not.
  `ResetTermStart` nulls `ServicePeriodStart` **and** `ServicePeriodEnd`, so the one control this
  change first missed was the one that wrote most. It now carries the same binding, keeping its own
  hint while editable exactly as the product select keeps `ProductLabel`.
- **The full line detail.** `OpenLineDetail` opened the generated Order Line form with
  `EditMode: true` unconditionally — the service period, term, product reference and description,
  every one of them editable on a frozen line. It now passes `EditMode: this.CanEditLines`.

  The button is still **offered** on a closed deal, and read-only rather than withheld: a closed deal
  is what people go back and inspect, and those four fields have no other surface, so withholding it
  would cost the reading to prevent the editing. `CreateRelated` already gated a `forms.Open` the same
  way, stated the other way round — *a locked deal must not create a record it then cannot attach.*

  This stops the **workspace** from requesting edit on a frozen line. Whether the generated form's own
  chrome still offers an Edit toggle in view mode is an MJ-level question, identical in every
  read-only context; `DealLockOrderLineVeto` (sales#98) refuses the save either way.

13 tests, 8 mutations all killed, including the defect as reported and both ways of losing a binding.
**Five of the thirteen assert the bindings exist**, which is the point: unlike #84, where the button
already bound `[disabled]` and only a getter changed, these bindings are new — and a correct getter
that nothing consumes would pass every behavioural assertion while a rep edited a frozen line. The
slide-in is asserted on **behaviour** instead, because there the defect is not a missing binding but a
value handed to a service: a version that read `CanEditLines` and passed `true` anyway would survive
any grep of the template.
