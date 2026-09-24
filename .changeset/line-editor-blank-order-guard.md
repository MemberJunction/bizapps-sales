---
'@mj-biz-apps/sales-ng': patch
---

The add-product dialog no longer invents an order when the deal's own one cannot be resolved.

`OrderID_EnsureObject()` returns the deal's real order only when MJ's `EmbeddedRecord` has been
exposed, by a load, a save or a wire deserialize. Reached with a deal whose `OrderID` names a real row
but whose peer never hydrated, it calls `NewRecord()` and hands back a BLANK order instead. The dialog
then priced a line against that blank and saved it, which wrote a SECOND order header.

On the deal form the second header has no `CompanyID`, so the insert died two apps away on `Failed to
save order header: Company cannot be null` — a NOT NULL complaint about a column no human can see —
while drawing and rolling back an order number on every attempt.

**Scoped to the add-product dialog.** `DealWorkspaceComponent.AddLine()` reaches `Ensure()` the same
way and is deliberately left alone: that component is rendered by no template, and a resolve-first step
there is not sufficient on its own — the embedded load does not bring the `Lines` collection
(`Load: 'explicit'`), so creating a line against a freshly hydrated order stamps `LineNumber = 1`
against `UQ_OrderLine_OrderHeader_LineNumber`. Doing it properly needs a refusal, an explicit
`Lines.Load(true)` and error handling on a method that currently has none, which is its own change.

`DealEntity.Save()` already resolved the peer after a save (DN-17). Neither path above goes through a
save, so that guard could not reach them. The dialog now resolves the foreign key first, via
`OrderID_LoadObject()` — the safe question `Ensure()` deliberately refuses to answer — and if the deal
names an order that still did not come back, it refuses and says the order could not be READ rather
than that the deal has none.

**Both the load and the refusal happen BEFORE `Ensure()` is allowed to run, and that ordering is the
fix rather than a detail of it.** `Ensure()` is not a read: `NewRecord()` mints a `uuidv4()` for a
single uniqueidentifier primary key and `stampOwnerKey()` writes it into the owner's foreign key. So a
guard that refused afterwards would leave the `DealEntity` shared with the form repointed at a blank,
unsaved order — the user reads "the order could not be loaded", closes the dialog, saves the deal, and
gets `Company cannot be null` against an order they never saw. The same stamping is why a guard phrased
as "the FK is set and the order is not saved" is wrong: after `Ensure()`, a deal that legitimately had
no order has one, so it would refuse the ordinary create case too.

This makes the failure legible; it does not make an unreadable order readable. Where the cause is a
generated type that no longer matches the entity metadata the client builds its query from, that is
MemberJunction/bizapps-orders#238 and it is fixed there.
