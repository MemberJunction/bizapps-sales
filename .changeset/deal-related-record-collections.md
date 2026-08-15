---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-server': minor
'@mj-biz-apps/sales-ng': minor
---

A deal and its children are Related Record Collections. `DealDraft` and `Sales.SaveDeal` are retired.

`Deal` now declares **`Lines`**, **`PaymentSchedule`** and **`Team`** in `EntityRelationship` metadata, so
CodeGen puts typed, writable collections on the generated entity. The same object graph therefore exists in
the browser and on the server, travels over `MJ.SaveEntityGraph`, and persists through `EntitySavePlan`
inside one transaction — header first, then removals, then children.

**Two things existed only to work around the absence of that, and are gone.** `DealDraft` was a UI-side
model with its own line and instalment arrays; `Sales.SaveDeal` was a remote operation whose whole job was
to rehydrate the draft's payload into a server-side entity tree, because the entity a browser held had no
child collections to save. `DealEntityServer` no longer hand-rolls collections, a deletion queue, a
re-sequencer or an explicit transaction either.

**BREAKING for anyone importing `DealDraft` or `SalesSaveDealOperation`** from
`@mj-biz-apps/sales-entities`, and for any caller of `Sales.SaveDeal`: build a `DealEntity`, add children
through `deal.Lines` / `deal.PaymentSchedule` / `deal.Team`, and call `deal.Save()`.

**Removal is now EXPLICIT, and this is the one behaviour change rather than a refactor.** `Sales.SaveDeal`
treated a submitted `Lines` array as the complete desired set and deleted anything missing from it. A
collection deletes only what was explicitly `Remove()`d — so a header-only save (an Action renaming a deal,
an agent nudging `NextStep`) can no longer destroy children by not mentioning them, which under the old
contract was silent data loss. Integration checks SD6 and SD13 pin both halves.

`DisplayOrder` sequences **contiguously from 1** rather than 10/20/30: the collection's sequencer has no
increment option, and the old step was cosmetic because every add and remove re-sequenced the whole
collection anyway.

**The validation rules moved onto the entities** — `DealEntity`, `DealLineEntity`,
`DealPaymentScheduleEntity` — so they run in the browser *and* on the server, on the one path every write
takes, instead of in a model an Action or an agent bypassed. `DealEntity.SetOwner` is shared for the same
reason. What still needs a database stays server-only: deal numbering, and the `CompanyID` and
`OwnerEmployeeID` stamps — two rules that turned out to be enforced *only* by the retired operation.
