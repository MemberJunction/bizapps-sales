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

## DN-3 — SD6/SD13/SD14 now assert a two-level save graph

**Taken:** rewrote them against `deal.OrderID_Object.Lines` — the collection belongs to the deal's
**embedded order**, while `Save()` is still issued on the **deal**.

**Why it matters:** this is the one claim in the rework that could not be read off the schema — that an
embedded record contributes its own collections' inserts, edits, sequencing and **deletions** to the
parent's save plan. `prove-line-roundtrip.mjs` established the INSERT half only. SD6 (removal) and SD14
(edit + reposition) are the first assertions of the other two, and the workspace depends on all three
every time a rep edits a line and presses Save.

**If any of them fails on a real run, it is a finding about MJ's save graph, not about these checks.**

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
