# bizapps-orders — removing an order line is silently dropped

**Severity:** data loss, silent. `Save()` returns `true` and the row survives.
**Affects:** every caller. Reproduced through the entity layer, a remote operation, and the Explorer UI.
**Reported by:** the bizapps-sales team. Tracked on our side as KI-20.

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

## The one thing to verify rather than trust

**Does `Lines.Dirty` actually become true when an item is removed?**

This matters more than it sounds. The natural fix is to gate the new delete pass on the collection being
dirty:

```ts
if (this.Lines.Dirty) { /* process removals */ }
```

If `Dirty` tracks additions and edits but **not** removals, then that fix does nothing for the bug it was
written for — while passing any test that adds a line and then removes it, because the addition sets the
flag. A test that *only* removes a line is the one that fails, and it is the case the bug is about.

We have not established this either way and are not guessing at it. What we can say:

* Our workspace calls `Lines.Remove(line)` rather than splicing `Items` (which is exposed readonly), and
  the collection **does** record the removal — the line disappears from `Items` and stays gone until
  reload. So removal is tracked *somewhere*.
* Whether that tracking is reflected in `Dirty` specifically is a different claim, and reading it off the
  type declaration is not sufficient — `Dirty` is a getter and what it consults is the question.

**The check is two lines and worth doing before writing the fix:**

```ts
await order.Load(orderID);
order.Lines.Remove(order.Lines.Items[0]);
console.log('Dirty after removal only:', order.Lines.Dirty);   // ← if false, do not gate on it
```

If it comes back `false`, the fix must find removals some other way — a removed-items list on the
collection, or a diff against what was loaded — and the gate has to go.

---

## Downstream state, so you know what is waiting on this

The delete-line button in our deal workspace **does not work today**, and we have deliberately left it
that way rather than working around it. The component calls `Lines.Remove()` correctly and stops there;
deleting orders' rows directly from a sales component would put a second app in charge of orders' data,
which is worse than a broken button.

The button will start working the moment this is fixed, with no change on our side.

We have a tripwire check (`save-deal.SD6`) that asserts a removed line is gone from the database. It is
currently the expected-failure marker for this issue; when it passes, this is fixed.
