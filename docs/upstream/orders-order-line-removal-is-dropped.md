# bizapps-orders — removing an order line now FAILS THE WHOLE SAVE (was: silently dropped)

**Severity: RAISED 2026-08-21.** This report originally described a silent drop. The behaviour has
changed and is materially worse in one respect and better in another, so please re-read it rather than
skimming the old summary.

| | |
|---|---|
| **Now** | The save is REFUSED. `Violation of UNIQUE KEY constraint 'UQ_OrderLine_OrderHeader_LineNumber'`. |
| **Consequence** | A user cannot remove a line at all — **and loses every other edit staged in that save.** |
| **Was** | `Save()` returned `true`, the removal was dropped, the row reappeared on reload. |
| **Affects** | Every caller. Reproduced through the entity layer, a remote operation, and the Explorer UI. |
| **Reported by** | the bizapps-sales team. Tracked on our side as KI-20. |

## What changed, and why the new shape is worse

The old failure lost ONE intention: the removal. The new one fails the entire unit of work, so a user who
removes a line and also edits a quantity, a discount and a service period loses all of it — and, in our
workspace, cannot save the deal at all while a removal is staged. There is no way to get out of the state
except discarding the edits.

**Better in one way, and worth saying:** it is no longer silent. The old version was the more dangerous
kind of bug because the screen agreed with the user. This one announces itself.

### The exact error

```
Save failed for OrderID_Object (MJ_BizApps_Orders: Order Headers):
  Failed to save order line 1: Error executing SQL
  Violation of UNIQUE KEY constraint 'UQ_OrderLine_OrderHeader_LineNumber'.
  Cannot insert duplicate key in object '__mj_BizAppsOrders.OrderLine'.
  The duplicate key value is (b90e31c3-735b-4262-aff9-251089d66af3, 1).
```

The statement in flight is `spUpdateOrderLine` on the SURVIVING line, with
`ChangesDescription = 'LineNumber changed from 2 to 1'`.

### The mechanism, as far as we can see it from outside

Removing line 1 of 2 makes `savePendingLines` renumber the survivor from 2 → 1 **before the removed row
is deleted**, so the update collides with the row it is meant to replace. Either ordering would work on
its own; it is the interleaving that fails:

- delete first, then renumber → no collision;
- renumber into a temporary range, delete, renumber down → no collision;
- or defer the uniqueness check to the end of the transaction.

We have not changed our calling pattern. The same `Remove()` + `Save()` shown below now produces this
instead of a silent no-op.

### How we noticed, which is a caution for your own tests

Our tripwire for the original defect asserted "the UI reports no error" — the old hazard being that a
dropped removal *looked* like success. That assertion had been passing for the wrong reason: it searched
for CSS classes that do not exist in our own template, so it matched nothing and could never fail. Once
the selector was corrected, the new error appeared immediately. **A test pointed at a selector that
matches nothing is indistinguishable from a passing one**, and it hid a severity change for at least a
week.

---

## What happens

Remove a line from `OrderHeader.Lines` and save. The save reports success. The row is still in
`OrderLine`. Reload and the line is back.

Removing one of the *deal's own* child rows — a `DealPaymentSchedule` instalment — through the identical
pattern deletes correctly. So this is not a misunderstanding of how MJ's related collections work on our
side; it is specific to `OrderHeader.Lines`.

```ts
const order = await md.GetEntityObject<OrderHeaderEntity>('MJ_BizApps_Orders: Order Headers', user);
await order.Load(orderID);
const before = order.Lines.Items.length;

order.Lines.Remove(order.Lines.Items[0]);
const ok = await order.Save();          // → true

// reload
const fresh = await md.GetEntityObject<OrderHeaderEntity>('MJ_BizApps_Orders: Order Headers', user);
await fresh.Load(orderID);
fresh.Lines.Items.length === before;    // → true. The removal did nothing.
```

`Save()` returning `true` is the part that makes this expensive. There is no error, no warning, and no
failed row to find later — the only symptom is a line reappearing, which reads as a UI refresh bug rather
than as a write that never happened.

---

## Cause

Two things in `OrderEntityServer.Save()` combine, and each is individually defensible.

**1. The header is saved with `SkipRelatedCollections: true`.**

```ts
const savedHeader = await super.Save({ ...options, SkipRelatedCollections: true });
```

The comment above it says `SkipRelatedCollections` is load-bearing, and we believe it — the lines need
preparation (promotion and charge decisions) before they can be written, so handing them to the base
class's graph executor would save them in the wrong order. But that flag is also what would otherwise
process **removals**. Skipping the collection skips both halves of it.

**2. `savePendingLines()` iterates the survivors.**

```ts
for (const line of this.Lines.Items) {
    const saved = await line.Save(options);
    ...
}
```

`Items` is what is *left*. A line that was removed is not in it, so nothing iterates it and nothing calls
`Delete()` on it. There is no code path for a removal anywhere in the save.

So the removal is not mishandled — it is **unhandled**. The base class was told not to look, and the
replacement loop only knows how to add.

---

## Four things a fix has to get right

1. **Delete inside the same transaction as the inserts.** A removal and an addition in one save must both
   land or neither. Deleting after the header commits leaves a window where the order is briefly missing a
   line it still references, and if the delete then fails there is nothing to roll back to.

2. **Removals before inserts, or line numbering collides.** If `LineNumber` is unique per order — or is
   merely re-sequenced from collection position, which is what our workspace does — then adding a line and
   removing an earlier one in the same save can produce a transient duplicate. Ordering the deletes first
   avoids needing to reason about it.

3. **A removed line's dependent rows go with it.** Promotion adjustments, charge rows and tax reasons are
   written *after* the line insert and keyed to the line. A delete that does not account for them either
   violates a foreign key or orphans them. `writePromotionRecords` / `writeChargeRecords` /
   `saveTaxReasons` are where to look for what a line owns.

4. **A confirmed or locked order must refuse the removal, not silently ignore it.** The current behaviour
   is indistinguishable from a refusal, and the fix will make the difference visible. If removing a line
   from a `Confirmed` order should be impossible, it needs to fail loudly — otherwise the fix turns a silent
   no-op into a silent deletion of something that was already invoiced.

---

## Verified: `Lines.Dirty` DOES reflect a removal — gate on it safely

This section previously asked the question rather than answering it. It has now been run against a
live order, in-process, inside a rolled-back transaction. **The gate is safe.**

```
order:  8A4391A7-2BD3-4B62-8A5F-112EA20B8893  (3 lines)

Items before removal                     3
Lines.Dirty BEFORE any change            false   ← baseline, or nothing below means anything
Items after Remove()                     2       ← the removal was applied
Lines.Dirty after REMOVAL ONLY           true    ← THE ANSWER

Lines.Dirty after an EDIT                true    (control)
Lines.Dirty after an ADD                 true    (control)
```

So this fix is sound as written, and needs no alternative route:

```ts
if (this.Lines.Dirty) { /* process removals */ }
```

The two controls are why this is a finding rather than a reading. A bare `true` could have meant
`Dirty` is simply always true on a loaded collection; the `false` baseline before any change rules
that out, and the edit and add cases confirm the flag responds to the other operations too. A removal
alone moves it.

### And there is a better handle than the flag

The collection exposes a **`Removed`** member, and it holds the removed entities themselves:

```
Removed                                  length 1
Removed[0] is the line that was removed  yes — ID 3795261C-F335-4E54-9142-4AD12B9EA519
Removed[0] type                          a BaseEntity (has Save)
```

That is more useful than the boolean. A fix does not have to diff against a reload or re-query to work
out what went: `Removed` already carries each removed line as a full entity, so the delete pass can
read primary keys straight off it — or call the entity's own delete path, with whatever server-side
rules that carries. `Dirty` then serves only as the cheap early-out.

### One trap worth passing on

`order.Load()` does **not** populate `Lines.Items`; the collection has its own `Load()`. The first run
of this probe missed that, so it read `Items.length === 0`, called `Remove(undefined)`, and reported
`Dirty === false` — which looked exactly like the answer being sought and was measured over an empty
collection. A removal that never happened cannot dirty anything.

Anyone writing the regression test for this should assert the collection is non-empty before removing,
or the test will pass for the wrong reason on a fix that does not work.

---
## Downstream state, so you know what is waiting on this

The delete-line button in our deal workspace **does not work today**, and we have deliberately left it
that way rather than working around it. The component calls `Lines.Remove()` correctly and stops there;
deleting orders' rows directly from a sales component would put a second app in charge of orders' data,
which is worse than a broken button.

The button will start working the moment this is fixed, with no change on our side.

We have a tripwire check (`save-deal.SD6`) that asserts a removed line is gone from the database. It is
currently the expected-failure marker for this issue; when it passes, this is fixed.
