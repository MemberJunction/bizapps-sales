---
'@mj-biz-apps/sales-ng': minor
---

A product can be taken off a deal.

The third of golive#206 item 1's three verbs — *"adding, editing or deleting a line on a locked deal"* — and the one that was impossible rather than merely ungated. There was no delete affordance anywhere on the deal form.

**It was blocked by orders, and no longer is.** `OrderEntityServer` did not drain `Lines.Removed` at all, so a removal was silently dropped, and once it started refusing it cost the rep every other edit staged beside it. Sales carried a blanket refusal for that — `ShouldRefuseLineRemoval`, which declines every saved line and still sits in the unmounted workspace. The orders fix landed with golive#187 and `OrderEntityServer` now reads `Lines.Removed`, renumbers the survivors and recomputes the header. `save-deal.SD6` is the tripwire that announced it.

**Through the collection, not a direct delete.** `Lines.Remove()` then `order.Save()` is the path orders drains. Deleting the `OrderLine` record straight from a grid skips the renumbering and the header recompute, which is why the grid's own delete button stays off — the same reason its New button does.

It lives on the restricted line editor rather than as a row control: that dialog already resolves the close lock for itself, so removal inherits the refusal instead of needing its own copy of it. Offered only for a line that exists — a line being composed has nothing to remove, and Cancel already discards it — and never on a closed deal.

Two-step, because removing a product a rep meant to keep costs them a re-entry, and placed apart from Save/Cancel: confirm-left-cancel-right is the rule for the two choices that end the dialog normally, and a destructive third option beside Save is how the wrong one gets clicked.

A refused save puts the line back by re-reading the collection. Leaving it claiming a removal that did not happen would mean the next save retries it against a rep who has moved on.

It emits the same `Saved` event an edit does, because what follows is identical: re-read the grid, and force a deal save so the cached amount follows the order down.
