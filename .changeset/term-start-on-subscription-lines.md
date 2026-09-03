---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": minor
---

A term start on subscription lines, defaulting to the order date (#32).

A subscription line on a deal now carries its own **Term start**. It displays the embedded order's
`OrderDate` as a default, writes `OrderLine.ServicePeriodStart` when the rep sets one, and stops
following the order date once set. A reset action returns it to the default. Non-subscription lines do
not show the field.

**`sales-entities`** gains `term-start.ts` — `IsSubscriptionProduct`, `ShouldOfferTermStart`,
`EffectiveTermStart`, `HasExplicitTermStart` — as pure rules with no Angular dependency, so the
integration suite can check them without standing up a component. `ProductLookup` gains
`SubscriptionTypeID`, and `PRODUCT_LOOKUP_FIELDS` is exported so the picker's query and the check that
guards it read one list rather than two copies. That constant now carries an `as const satisfies`
completeness check against `keyof ProductLookup`, because rebasing this branch onto #29 showed how the
list fails: it produced no merge conflict at all — `next` had never carried the constant — so git took
this branch's version whole and silently dropped the two fields #29 had added. Nothing would have
failed until a line booked to the wrong company.

**A note on the bump level.** `SubscriptionTypeID` is a REQUIRED member of the exported `ProductLookup`
interface, so strictly any external code constructing one stops compiling. It is declared `minor` here
anyway, and the reason is that the level makes no difference to what ships: #29's changeset is still
pending in this same release, it declares `major`, and `.changeset/config.json` groups all six packages
as `fixed` — so everything moves to **6.0.0 together** and this interface change goes out under a major
either way.

Were it deciding the number on its own, `minor` would still be the call: no consumer of this type exists
outside this repository — verified across `bizapps-orders`, `bizapps-accounting`, `bizapps-contracts`,
`bizapps-common`, `bizapps-tasks` and MJ — and Robert Kihm confirmed on 2026-08-29 that there is leeway
on major/minor before LTS. Recorded rather than assumed, because the next required member added to this
interface may not have a major already travelling with it.

**This field has no effect until bizapps-orders#121 lands, and that is worse than it sounds.** Orders
today overwrites `ServicePeriodStart` at confirm from `SubscriptionBehavior.ComputeStartDate`, whose
context carries no field for a requested start at all — so the rep's date is discarded AND orders writes
its own computed date back into the column. Reopening the deal then shows that computed date as though
someone had deliberately chosen it, complete with the reset button and no "order date" hint. Sales and
orders need testing together, which is what Andrew's note on both issues asks for.
