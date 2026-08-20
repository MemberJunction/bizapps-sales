# DECISIONS NEEDED

Choices made overnight on `feature/embed-order-on-deal` where a second reading was defensible. Each one
was **decided and implemented** — the rule for the run was "if two options are equally defensible, take
the one that touches fewer files, record the other here, and move on." So none of these blocks anything;
they are here so the rejected option is visible rather than lost.

Anything genuinely undecidable without Josue or Amith is marked **OPEN**.

---

## DN-1 — Every check bundle now requires bizapps-orders

**Taken:** flipped `save-deal` and `close-deal` from `requires: null` to `requires: "orders"` in
`scripts/expected-check-counts.json`, and made `save-deal`'s `Setup` refuse a host without orders.

**Why:** `DealEntityServer.provisionEmbeddedOrder()` runs inside `Save()` with no install check, so a
deal cannot be saved at all without orders. `mj-app.json` already declares `mj-bizapps-orders` a hard
dependency, which makes a sales-only host misconfigured rather than minimal. Marking those bundles `null`
would have had the coverage gate demand two bundles that cannot pass there.

**Rejected:** gating the provisioning on `OrdersIsInstalled()`, so a deal on a sales-only host simply has
no order. That is quieter and touches the entity server rather than a manifest — but it produces a deal
missing the thing S-US4 says every deal has, with nothing complaining. Loud beat quiet.

**Consequence, and it is the reason this is written down:** no bundle is unconditional any more, so a host
with nothing linked expects ZERO bundles and the gate would have passed while running nothing. That hole
is now closed — `assert-check-count.mjs` fails on an empty expectation. Worth re-reading if a future
bundle goes back to `requires: null`.

---

## DN-2 — Four save-deal checks retired rather than rewritten

**Taken:** deleted SD4, SD5, SD12 and SD16. Their IDs are **not** reused.

| Check | Asserted | Why it could not move |
|---|---|---|
| SD4 | `DealLine.Resolved*` stayed NULL | those four columns do not exist |
| SD16 | a caller-set `Resolved*` was refused | same, and the rule is orders' now |
| SD5 | a transcribed `Total` was stored verbatim | sales transcribes no line money at all |
| SD12 | a line's type carried `IsRecurring` | `DealLineType` is retired; nothing routes by line kind |

**What replaced the requirement:** Rule 1 (sales never computes money) is now asserted **positively** by
the new **SD19** — sales sends product and quantity, and `UnitPrice`, `CompanyID` and `LineNumber` come
back on a row it never wrote. That is a stronger claim than "the columns we own stayed empty."

**Judgement call inside SD19, worth a second opinion:** it asserts `UnitPrice` is **non-null**, not that
it equals a figure. Asserting a number would mean this repo knowing a price. The cost is that a
catalogue product with no price would store `0` and still pass. Tightening it would mean sales reading
orders' price tables, which is exactly what Rule 1 forbids — so it stands, but it is the softest
assertion in the bundle.

**Also dropped:** SD15's second half, which proved `DealLine.Quantity` defaulted to 1. The line is an
order line now, so that default is orders' metadata. Sales asserting a neighbouring app's column
defaults is a check that fails when another team makes a decision that is theirs to make. The deal half
of SD15 (`PaymentMethod` defaults from metadata) is untouched.

---

## DN-3 — The two-level save graph: insert and edit work, REMOVE does not

**Taken:** rewrote SD6, SD13 and SD14 against `deal.OrderID_Object.Lines` — the collection belongs to the
deal's **embedded order**, while `Save()` is still issued on the **deal**. Then ran them, which is the
part that mattered.

**Result — and the first draft of this entry guessed it wrong, which is why the run happened:**

| Verb | Through `deal.Save()` | Check |
|---|---|---|
| INSERT | ✅ | SD1, SD19, SD20 |
| EDIT | ✅ | SD14 |
| **REMOVE** | ❌ **silently dropped, save returns true** | SD6, now a tripwire |

So an embedded record DOES join the parent's save plan — for two verbs out of three. The third is
**KI-20**, and it is not about embedding at all: the same removal fails through `order.Save()` too, while
removing one of the deal's OWN instalments deletes fine. `test-harnesses/prove-line-removal.mjs` prints
that whole matrix, including the control, and cleans up after itself.

**Cause, located:** `OrderEntityServer.Save()` in bizapps-orders passes `SkipRelatedCollections: true`
(correctly — lines must not insert before they are priced) and its hand-rolled `savePendingLines()`
iterates `this.Lines.Items`. Inserts and updates, off the survivors. Nothing ever asks the collection for
its pending removals.

---

## DN-4 — `CD13` was reading a column it did not select — **fixed, no decision needed**

Recorded because it is worth knowing it happened. An earlier mechanical pass retargeted CD13 from deal
lines onto the payment schedule by replacing `SELECT Quantity` with `SELECT Amount`, and left the type
parameter and the expected value behind: `TxOne<{ Quantity: number }>` over `SELECT Amount`, then
`AssertEqual(Number(row.Quantity), 41)` against a stored `41000`. `Number(undefined)` is `NaN`, so the
check would have failed for a reason that had nothing to do with the close lock. Its `children()` helper
was likewise still reading `DealLine` under a comment that said instalments.

**The lesson, not the fix:** a find-and-replace across a check file changes what is READ without changing
what is ASSERTED, and the two disagree silently. Anything converted that way needs the assertion read
back, not just the query.

---

## DN-5 — OPEN: the header roll-up is still unasserted

The §6 definition-of-done check — `Deal.Amount` for a lined deal equals what `Orders.PreviewOrder`
returns for the same draft — is **still not built**, and the rework changed its shape rather than
removing it. The per-line half is covered by SD19. What nothing asserts is the deal-level number:
`Deal.Amount`, `AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`.

**The question for Josue/Amith:** with the order embedded and orders owning every line figure, is
`Deal.Amount` still a cached PreviewOrder answer with provenance — or is it now simply a read-through of
the order's total, making the three provenance columns dead weight? The answer decides whether that
check gets written or those columns get dropped. Not something to infer from the code.

---

## DN-6 — OPEN, and the one worth waking up to: who fixes KI-20?

**The user-visible consequence:** the deal workspace's delete-line affordance does not work. A rep removes
a line, the row disappears from the grid, the save reports success — and the line is back on reload. This
is in sales' own UI, on a surface that is part of the demo.

Nothing was changed to work around it tonight. Three options, and the choice is not mine to make:

**A. Fix it in bizapps-orders** — `savePendingLines()` (or `persistPreparedLines()`) processes the
collection's pending deletions. Correct place, one app, one method, and it fixes every consumer rather
than just sales. Needs care: it is the booking path, and trigger 51003 freezes a line on a Confirmed
order, so the deletion has to be scoped to the states where it is legal. **My recommendation.**

**B. Work around it in sales** — `DealWorkspaceService` deletes the removed line rows itself. Fast, and
entirely inside this repo. Rejected as a default because it puts a second app in charge of deleting
orders' rows and would silently duplicate whatever rule orders eventually writes. Also does nothing for
any other caller.

**C. Leave it** — SD6 stays a tripwire, the delete affordance stays broken, KI-20 stays open. Defensible
only if line deletion is not in the near-term demo path.

**Why this is not a judgement call I made unilaterally:** option A is a change in another repo, tonight's
brief scopes me to this one, and my one previous rebuild of orders disrupted a second instance's checks.
Option B is a change I could have made and deliberately did not, because it is the kind of workaround that
is very hard to remove later.

---

## DN-7 — The provisioning guard was wrong, and every line check found it at once

**Not a decision — a fix, recorded because the failure shape is worth recognising.**
`DealEntityServer.provisionEmbeddedOrder()` guarded on `IsSaved || OrderID`. But `Ensure()` assigns the
new peer's key to `OrderID` immediately, so any caller that reached the order BEFORE saving — an importer
building a deal and its lines for one `Save()`, or nine of these checks — arrived with `OrderID` already
populated. The guard returned early, the stamps never ran, and the save died inside orders on
`CompanyID cannot be null`: a NOT NULL complaint about a column two apps away from the mistake.

It is now `IsSaved` alone, plus a second guard that leaves an ALREADY-PERSISTED order untouched, so
attaching an existing order stays legitimate. Nine failing checks became zero.

The reason it survived until now: in the UI a deal is always saved before a line is added, so the broken
branch was unreachable from the only path anyone had exercised.
