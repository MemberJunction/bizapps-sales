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

10 tests, 6 mutations all killed, including the defect as reported and both ways of losing a binding.
**Four of the ten assert the bindings exist**, which is the point: unlike #84, where the button
already bound `[disabled]` and only a getter changed, these bindings are new — and a correct getter
that nothing consumes would pass every behavioural assertion while a rep edited a frozen line.
