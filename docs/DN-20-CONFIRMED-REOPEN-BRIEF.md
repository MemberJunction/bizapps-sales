# DN-20 — a reopen blocked once the order has booked: the brief, not the build

**For Finance and Josue to decide. Nothing here is implemented.** Measured against
`feature/embed-order-on-deal @ 35a0f4d`, with `MJ_V6_Host` for the data.

> **Which DN-20.** This is *"NOT BUILT: a reopen should be hard-blocked when the order is already
> Confirmed"* (`DECISIONS-NEEDED.md:1990`), not the involvement-report DN-20 at `:478`. Two numbering
> series have grown into one file and DN-16, 17, 18, 20 and 21 each appear twice. Not fixed here —
> renumbering someone else's record mid-flight is how a citation in a third document goes stale — but
> **any decision recorded against this should quote the title, not the number.**

The three questions, answered. The short version: **the requirement is cheaper to build than the record
assumes, and the one hard part is not the one the record predicted.**

---

## 1. Can sales read a Confirmed state at all?

**Yes — and better than the record hoped. Two columns exist, and neither is the right thing to read.**

`__mj_BizAppsOrders.OrderHeader` carries both:

| Column | Type | Notes |
|---|---|---|
| `Status` | `nvarchar`, NOT NULL | Constrained by `CK_OrderHeader_Status` to `Draft, Quoted, Confirmed, Posted, Fulfilled, Voided` |
| `ConfirmedAt` | `datetimeoffset`, nullable | The `ConfirmedAt` the record guessed at — it does exist |

**But the right read is a third thing: `IsBooked(status)`, which orders already exports.**

```ts
/**
 * The order has booked — journal entries exist and the receivable is real.
 */
export function IsBooked(status: string): boolean {
    return status === 'Confirmed' || status === 'Posted' || status === 'Fulfilled';
}
```

That is orders' own words for Finance's own condition. The same module states the premise outright:

> `Confirmed` is the irreversible step: it books journal entries (D8), which is why nothing returns to
> an editable state from there.

So the rule Finance is asking for is **already written down in orders** — as a predicate, exported, and
tested there. Sales would not be inventing a policy; it would be asking orders a question orders already
answers.

### Why the obvious reads are both wrong

**`Status === 'Confirmed'` under-blocks.** The lifecycle advances `Confirmed → Posted → Fulfilled`. An
order that has been posted is *past* Confirmed, so an equality test lets it through — the exact case
where the ledger has moved furthest.

**`ConfirmedAt IS NOT NULL` over-blocks, and the data proves it.** Counted on the host:

| Status | rows | `ConfirmedAt IS NULL` |
|---|---|---|
| Confirmed | 31 | 0 |
| Draft | 13 | 13 |
| Quoted | 10 | 10 |
| Voided | 3 | 3 |

The three voided orders were voided from `Draft`/`Quoted`, so their `ConfirmedAt` is null and the two
tests agree *today*. They diverge on the case that matters: **an order confirmed and then voided** keeps
its `ConfirmedAt` forever while its status is `Voided`. `ConfirmedAt IS NOT NULL` would refuse the
reopen; `IsBooked('Voided')` is false and would allow it. Allowing it is correct — orders records that a
void has already given back what it took, with the reversal as its own record (D53). Blocking there
would refuse the one case where the ledger has been *settled*.

**`IsBooked` is the only one of the three that means "the ledger currently stands".**

### Does reading it cross a boundary we have been keeping?

**No. Sales already imports from exactly this module.** `DealEntityServer.ts:60`:

```ts
// ORDERS' OWN RULE, imported rather than restated. `CanTransition` is the same function …
import { CanTransition, type OrderStatus } from '@mj-biz-apps/orders-entities';
```

`IsBooked` sits in the same file (`OrderStatusBehavior.ts`), is re-exported by the package index, and
ships in the built `dist` as `export declare function IsBooked(status: string): boolean`. Adding it to
that import line crosses nothing new.

It also **keeps rule two rather than straining it.** A literal `status === 'Confirmed'` in sales would be
a string comparison against another app's vocabulary — the shape the vocabulary gate exists to catch.
Calling `IsBooked` leaves the vocabulary where it is owned.

**The order is already in hand at the point of the check.** A loaded deal hydrates its embedded peer
(`LoadEager` from `InnerLoad`, per the DN-17 note in `deal-entity.ts`), so `deal.OrderID_Object?.Status`
is a property read, not a query. *Worth confirming at build time rather than trusting this paragraph* —
and a deal with no order simply has no peer, which is the correct "nothing to refuse" case.

---

## 2. What would the refusal say?

**The record predicted the hard part correctly, and the answer is that sales should not name the
remedy — but it does not have to, and can still be useful.**

Sales knows three things and may say all three:

1. this deal is closed and locked;
2. it has an order, and that order's number;
3. orders reports that order as booked.

Sales does **not** know whether the right instrument is a void, a credit note, a change order or a
return — that varies by what has happened downstream, and `OrderStatusBehavior` shows the answer differs
by status (a `Fulfilled` order is *"a void plus a return order"*, a `Confirmed` one is not).

### Draft

> **This deal cannot be reopened: order `{OrderNumber}` has booked, so the ledger has already moved.
> Reopening would edit a deal whose order can no longer be edited. What to do about the order is an
> orders decision — resolve it there first, then reopen this deal.**

Every clause is something sales owns or is quoting: the refusal, the order number, orders' own verdict,
and an explicit handoff. It names **no** instrument.

### The alternative worth considering, and why I did not draft it as the default

Orders *could* be asked to supply the sentence — a `RemedyFor(status)` returning "void this order" or
"void plus a return order". That is strictly better for the rep and it is **orders' work, not sales'**.
If Finance wants the message to name the next step, the honest route is to ask orders for that export
rather than have sales guess it. Sales can then quote it verbatim, the same way it quotes
`CanTransition`'s `Reason` today.

**So: a sentence that stays inside sales is draftable, and it is the one above. A sentence that tells
the rep what to do instead is not, and should not be faked.**

---

## 3. Where would it live?

**One more refusal in the shape that is already there. Three to six lines.**

`ReopenDealOperation.InternalExecute` (`CloseDealOperation.ts:956`) already refuses four things, all in
one form and all **before** `db.BeginTransaction()`:

```ts
if (!input?.DealID)        → issue('deal', 'A deal is required.', 'DealID')
if (!input.Reason?.trim()) → issue('deal', 'A reason is required to reopen a closed deal.', 'Reason')
if (!target)               → issue('deal', 'No open status is available …', 'DealStatusTypeID')
if (target.LocksDeal)      → issue('deal', 'Cannot reopen into a status that locks the deal.', 'DealStatusTypeID')
```

A booked-order check is a fifth of the same kind: after `deal.Load()` (it needs the peer), before the
transaction (nothing to roll back), returning the same `{ ...empty, Issues: [issue(...)] }`.

**Nothing structural changes.** No new operation, no new seam, no schema change, no migration, no
metadata. The import line at `DealEntityServer.ts:60` gains a name — or `CloseDealOperation.ts` gains
the same one-line import.

### What that changes about the decision

The record files this as *"its own cycle"*, which reads as though it were a project. On the evidence it
is a small, well-shaped addition whose cost is dominated by **agreeing the sentence**, not by writing
the code. If Finance is content with a refusal that hands off to orders without naming the instrument,
this is a short piece of work. If the message must name the next step, the critical path runs through
**orders exporting the remedy**, and that is the thing to schedule.

### The one thing to decide that is not in the record

**What should happen to a deal whose order was confirmed and then voided?** `IsBooked` says allow the
reopen; a `ConfirmedAt` test would refuse it. This brief recommends allowing it, because the void has
already reversed the ledger entry — but that is a Finance judgement, not an engineering one, and it is
the only case where the two candidate implementations visibly disagree.

---

## Summary

| Question | Answer |
|---|---|
| Can sales read it? | **Yes.** `IsBooked(status)` from `@mj-biz-apps/orders-entities` — same module sales already imports `CanTransition` from. `ConfirmedAt` exists but over-blocks; `Status === 'Confirmed'` under-blocks. |
| New boundary? | **No.** Same package, same import line, and it keeps the vocabulary in the app that owns it. |
| What does it say? | A refusal naming the order and handing off to orders is draftable **today**. One naming the remedy is not, and needs an export from orders. |
| Where does it live? | **One more pre-transaction refusal** in `ReopenDealOperation`, identical in shape to the four already there. |
| Real cost | Agreeing the sentence, and deciding the confirmed-then-voided case. Not the code. |
