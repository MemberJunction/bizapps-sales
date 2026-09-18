---
'@mj-biz-apps/sales-ng': patch
---

The deal workspace no longer offers Add product on a closed deal.

golive#206 item 1 asks for a line on a closed deal to be refused "whichever screen or API path it comes from", and names the deal **form's** grid for the affordance half. The workspace has its own Add button, which the issue never mentions, and it was gated only on the deal being saved — so a rep could add a product to a Won deal here while the form's grid refused the same gesture one screen over.

The server is the rule and orders enforces it: a line saved through the order graph outside booking is asked, and a frozen deal refuses. This is the affordance half. Without it the gesture is offered, taken, and then fails at save time as a thrown error, which is the shape item 1 exists to replace.

**Removal needs no second rule here.** `ShouldRefuseLineRemoval` is `!!line.IsSaved`, so every saved line is already declined at the gesture — for KI-20's reasons rather than the lock's, but a rep on a closed deal meets the same wall either way, and a second rule would be two messages for one refusal. That is asserted rather than assumed, so if KI-20 is ever fixed and this relaxes, the lock gap it currently hides surfaces as a failing test instead of a silent regression.

The message follows golive#207's voice and gives the same instruction as the header notice and the server refusal: *"This deal is closed. Set the status back to Open before adding a product."* No template change — the button already binds `[disabled]="!CanAddLine"` and renders `AddLineBlockedReason` as its hint.

Six tests, three mutations all killed: removing the gate (which restores the defect exactly), never choosing the lock message, and blocking unconditionally. The third matters because without it a gate that always refused would pass every other assertion.
