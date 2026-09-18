---
'@mj-biz-apps/sales-ng': patch
---

A new deal's "What's being sold" panel says what to do, instead of rendering nothing.

golive#216, the first half. A tester creating a deal reported: *"It is empty, with no add button and no
message"* — and could not tell whether products were unavailable, broken, or somewhere else.

The panel had two branches:

```
@if      (Record.IsSaved && Record.OrderID)  -> the lines grid
@else if (Record.IsSaved)                    -> "Save the deal to add products."
```

So a **saved** deal was told to save, and a **brand-new** one — the only case that hint exists for —
matched neither branch and rendered empty. The condition was inverted against its own message.

Three branches now, covering every combination of the two fields it reads: the grid when there is a
saved deal and an order to hang lines on; *"Save the deal first. Products are added to the order it
creates."* when it is not saved; and, for a saved deal with no order, a message that says that rather
than repeating the wrong instruction one case over. That last case is the legacy row that closed before
deals minted their own order — `DealEntityServer` deliberately does not mint one for a deal whose whole
point has passed — so telling that rep to save would be the same error again.

Five tests, four mutations all killed, including the defect restored exactly. The tests are anchored on
the branch conditions **and their order**, so a message moved under the wrong condition fails even
though every string is still present — which is the failure this panel actually had.

**This is the panel half of #216 only.** The other two halves are covered elsewhere and are not in this
PR: the silent `Save()` refusals that produce *"Unknown error creating record"* are converted to
readable messages by #81, and the Owner and Company fields that the form offers while the server
refuses or overwrites them are made read-only by #92.
