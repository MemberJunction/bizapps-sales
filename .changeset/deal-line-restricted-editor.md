---
'@mj-biz-apps/sales-ng': patch
---

Deal form: adding or editing a product line no longer opens the full Order Line form (golive#229).

"What's being sold" was an `mj-explorer-entity-data-grid` bound straight to `OrderLine`, so New and a row
double-click both fell through to whatever form is registered for that entity — in bizapps-orders, the
CodeGen-generated full-entity form. It shows Order Header, Reverses Order Line, Parent Order Line, Journal
Entry, Price Overridden, Fulfillment Status, the ship-to trio and about a dozen related sections, none of
which mean anything to a rep pricing a deal.

**And it renders Unit Price as a plain editable field.** A rep could type any price, with no discount
recorded and no override reason — the exact thing `docs/DECISIONS.md` D-DL2 says must be impossible:
*"S-US4 is explicit that no price field is enterable by the rep."*

A compact restricted editor now opens instead, offering exactly what the deal workspace allowed —
Product, Quantity, Discount percent, Term start — with unit price and line total as read-only displays,
and Order Header set from the deal and never shown.

**Both `ShowNewButton` and `NavigateOnDoubleClick` are off, and the pair is the fix**: either one left on
re-opens the generic form, and the tester reached it both ways.

**Why this is built in the form rather than reusing the deal workspace.** `deal-form.component.ts` says
composing a deal is the workspace's job and that duplicating it here would give us two surfaces that must
agree forever. That was right when written and no longer applies: commit `9d6ef9e` ("Replace the in-rail
deal workspace with Explorer OpenEntityRecord") unmounted `mjs-deal-workspace`, and the selector appears
in no template anywhere in the repo. **So D-DL2's guarantee has been enforced only in unreachable code
since 2026-08-31**, and the deal form is the only live surface — there is no second surface to disagree
with.

The RULES are not re-derived. Product eligibility, the percent/fraction discount conversion and the
term-start question all come from the same `@mj-biz-apps/sales-entities` helpers the workspace called;
only the markup is new. A discount stays a PERCENT and never an amount, per D-DL2 — `DiscountAmount` reads
0 exactly when a percentage discount exists.

#206's requirement that a locked deal offer no way to add a line is preserved and moved onto the new Add
button, since the binding it used to assert is now deliberately gone.

14 checks, including that no input anywhere binds `UnitPrice` or `LineTotalNet`.
