---
'@mj-biz-apps/sales-ng': patch
---

Eight more related panels say what to do on an unsaved record, instead of rendering nothing.

golive#216 was filed about ONE panel: a tester creating a deal expanded "What's being sold" and found
it *"empty, with no add button and no message"*, and could not tell whether products were unavailable,
broken, or somewhere else. That panel is fixed separately.

**Eight sibling panels had exactly the same shape**, and were found by sweeping for it rather than by
waiting for the next ticket:

```
@if (Record.IsSaved) { <grid> }     // ...and nothing at all otherwise
```

| panel | an unsaved record now reads |
|---|---|
| Internal team | *Team members are recorded against it once it exists.* |
| Buying team | *Contacts are linked to it once it exists.* |
| Activity | *Activity is logged against it from then on.* |
| Stage history | *Stage changes are recorded from then on.* |
| Payment schedule | *Payments are scheduled against it once it exists.* |
| Deals, on an organization | *Deals are linked to it once it exists.* |
| Deals, on a person | *Deals are linked to them once they exist.* |
| Deal team, on a person | *Their role on a deal is recorded once they exist.* |

Each opens with the instruction the lines panel uses — "Save the deal first." — so a rep meets one
voice across every panel on the form. The three on the Organization and Person forms name **those**
records rather than sales' own vocabulary: they are `MJ_BizApps_Common: Organizations` and `People`,
and a panel contributed onto someone else's form should not rename the record it is sitting on.

**Not one of the eight carried a comment saying the blank was deliberate**, which is what settles them
as the same defect rather than a design choice. The judgement was made per panel rather than by
find-and-replace; Activity is the one where a blank could be argued for, and it gets a message on the
same grounds as the rest — a rep cannot tell "nothing yet" from "broken" by looking at nothing.

**The style is part of the fix, not decoration.** `.mjs-deal-empty` is scoped per component under
emulated encapsulation, so a panel that gains the markup without the style renders the hint as
unstyled body text. `FIELD_STYLES` already records that happening once with `dw-field__hint`. Every
panel touched here therefore carries `EMPTY_STATE_STYLES` in its own decorator, and a test asserts it
per panel — a panel could otherwise pass every copy assertion and still look broken.

17 tests: the message and its branch ORDER for each of the eight, the style for each of the eight, and
a sweep tripwire for the shape itself.

**The tripwire reads the form-panels DIRECTORY, not the two files this changes**, and that distinction
is load-bearing. The next instance is most likely to arrive in a NEW file — which is exactly what
happened while this was open, when `order-related.panel.ts` landed from another PR. A tripwire pinned
to two hardcoded sources would have been watching the wrong place and still reported green. Proved by
dropping a new panel file written to the old shape into that directory: the tripwire fails and names
the file. (That panel is not itself an offender — it renders no labelled section when it has nothing,
so nobody expands it and finds a blank.)
