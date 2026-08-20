# Mutation evidence — every integration check has been proven able to FAIL

A green suite is not evidence. A check can be green because the behaviour it names is correct, or because
it is asserting something that is true no matter what the code does — and the two are indistinguishable
from the outside. This file records the run that told them apart.

**Method.** For each mutation: change the PRODUCT code (never the check), rebuild, run the whole suite,
record which check IDs failed, restore the file from git. The whole suite is run each time rather than one
bundle, so a mutation that breaks something unintended shows up instead of hiding.

**First run 2026-08-20 with 26 mutations, extended the same day with `M-OS1`–`M-OS3` for the stage →
order-status writer.** Against `MJ_V6_Host`, with bizapps-orders and bizapps-accounting linked and
bizapps-contracts absent. 39 checks across 4 bundles: `save-deal` (16), `close-deal` (14),
`product-picker` (4), `close-won-order` (5). `close-won-contract` needs contracts and was not expected on
this host.

## Result: 39 of 39 checks were made to fail

Three rounds were needed, and the reason there were three is the point of the exercise — round 1's
misses were findings, not retries.

---

## What the campaign FOUND, which is why it was worth running

### 1. `close-deal.CD4` was asserting nothing — fixed in the same commit

It read:

```ts
Assert('AmountAtTransition' in last, 'the event stamps AmountAtTransition');
```

`last` is a row from a `RunView` whose `Fields` names that column, so the key is **always** present. The
check held whether the close stamped the deal's amount, stamped a null, or stamped nothing — and
replacing `event.AmountAtTransition = deal.Amount` with `= null` left all 39 green.

It was invisible for a second reason worth knowing: a seeded deal carries **no** amount, so
null-versus-null was indistinguishable even to a stricter assertion. CD4 now gives the deal real figures
(`Amount = 123456.78`, `Probability = 42`), saves it while it is still open, and compares the stamped
values. The same mutation now fails it and nothing else.

### 2. `IsDealFieldEditableWhileLocked()` is not what the server calls

Mutating that exported helper to `return true` changed nothing — 39 passed. `DealEntityServer` reads the
`DEAL_FIELDS_EDITABLE_WHILE_LOCKED` **set** directly (`LOCK_EDITABLE_FIELDS`), so the helper is used only
by the Angular workspace. Not a defect — but anyone reasoning about the lock from the helper is reading
the wrong half, and a mutation aimed at it proves nothing.

### 3. The line checks are sensitive to the CATALOGUE, not just to the save

Widening the product filter (`M-PP1`, `M-PP3`) failed PP1/PP3/PP4 **and** all seven order-line checks:
they discover their products through that same filter, so a non-sellable product gets selected and orders
refuses the line. That is the picker rule and the line checks agreeing about what "sellable" means, which
is exactly the coupling `ProductFilterFor` exists to create.

### 4. Two checks can only be falsified by ADDING deleted behaviour

`CO2` ("a header-only deal closes cleanly, routing nothing") and `CO5` ("the order stays editable after
the deal is locked") are absence-assertions. Planning a phantom Order route was not enough for CO2 —
correctly, because it counts orders rather than plans. Both needed a mutant that re-instates what S-US5
removed: a close that CREATES a second order (CO2) or CONSUMES the deal's order (CO5). Both then failed.

`CO5` carried a documented limit even so: its claim that the deal's close lock stops at the deal could
only be falsified by a guard added in bizapps-orders.

**Both were superseded the same day.** D-OS1 gave a stage the power to name an order status, which made
"untouched" and "stays editable" accidents of the seed rather than requirements. CO3 and CO5 were
reframed onto the mechanism, and `M-OS1`–`M-OS3` below are mutants that falsify them from INSIDE this
repo — which is what the old pair could not manage. CO5 still also asserts the lock-stops-at-the-deal
claim, and that half still has the limit described above.

---

## The mutation table

Each row is one mutation, applied to the file named, then reverted. "Also failed" is not noise — it
records which other checks share the behaviour, which is information a per-check table would hide.

| # | File · change | Target | Also failed |
|---|---|---|---|
| M-PP1 | `product-filter.ts` · `Status = 'Active'` → `Status <> 'not-a-status'` | PP1 | SD1, SD6, SD7, SD13, SD14, SD17, SD19, SD20 |
| M-PP2 | `product-filter.ts` · drop the `CompanyID` clause | PP2 | — |
| M-PP3 | `product-filter.ts` · `AvailableTo >= today` → `>= '1900-01-01'` | PP3, PP4 | the same eight line checks |
| M-SD2 | `DealEntityServer` · `stampCompanyFromPipeline()` returns early | SD2 | — |
| M-SD3 | `DealEntityServer` · `OwnerEmployeeID = null` | SD3 | — |
| M-SD8 | `deal-entity.ts` · disable the `Name` rule | SD8 | — |
| M-SD9 | `SequenceService` · return `DEAL-0{seq}` (seven digits) | SD9 | — |
| M-SD10 | `DealEntityServer` · always take `saveWithNewDealNumber` | SD10 | — |
| M-SD11 | `SequenceService` · call the sproc twice | SD11 | SD17 |
| M-SD15 | `DealEntityServer` · clear `PaymentMethod` before saving | SD15 | — |
| M-SD18 | `DealEntityServer` · `OrderType = 'Return'` | SD18 | — |
| M-CD1 | `CloseDealOperation` · never plan a Contract | CD1 | CD12 |
| M-CD2 | `CloseDealOperation` · always plan a Contract | CD2, CO1 | CD3 |
| M-CD4 | `CloseDealOperation` · `AmountAtTransition = null` | CD4 | — |
| M-CD5 | `DealEntityServer` · `checkCloseLock()` returns early | CD5, CD13, CD14 | — |
| M-CD6 | `DealEntityServer` · `LOCK_EDITABLE_FIELDS = {'NextStep'}` | CD6, CD14 | — |
| M-CD7 | `downstream-seams.ts` · stub reports `Success: true` | CD7 | — |
| M-CD8 | `CloseDealOperation` · skip the loss-reason requirement | CD8 | — |
| M-CD9 | `CloseDealOperation` · `RequiresNotes === false` | CD9 | — |
| M-CD10 | `CloseDealOperation` · skip the reopen-reason requirement | CD10 | — |
| M-CD11 | `CloseDealOperation` · reopen does not clear `ClosedAt` | CD11 | — |
| M-CD13 | `DealEntityServer` · lock ignores dirty companions | CD13 | — |
| M-CD14 | `DealEntityServer` · `LOCK_EDITABLE_FIELDS = {'Description'}` | CD14 | — |
| M-CO2 | `CloseDealOperation` · the close creates a second order | CO2, CO4 | — |
| M-CO3 | `CloseDealOperation` · the close voids the order | CO3 | — |
| M-CO5 | `CloseDealOperation` · the close deletes the order | CO5 | CO1, CO2, CO3, CO4 |

### Added 2026-08-20 with the stage → order-status writer (D-OS1)

CO3 and CO5 were reframed onto the MECHANISM, so their old mutants no longer apply. These replace them.

| # | File · change | Target | Also failed |
|---|---|---|---|
| M-OS1 | `DealEntityServer` · the writer never plans anything | CO3, CO5 | — |
| M-OS2 | `DealEntityServer` · a NULL `OrderStatusOnEntry` treated as `'Draft'` | CO3 | — |
| M-OS3 | `DealEntityServer` · the refusal happens but the warning is swallowed | CO5 | — |
| M-AM1 | `DealEntityServer` · the amount cache is never refreshed | SD21 | — |
| M-AM2 | `DealEntityServer` · a hand-typed amount is overwritten | SD22 | — |
| M-AM3 | `DealEntityServer` · "nothing priced" becomes "priced at nil" | SD23 | — |
| M-PV1 | `DealEntityServer` · provisioning only ever on a deal's first save | SD24 | — |
| M-CT1 | `LiveContractsSeam` · an unresolvable type reported as a success | CT4 | — |

`M-AM2` is the one to keep pointed at: it deletes the guard that protects a human's figure, and only
SD22 notices. A cache that quietly overwrites a negotiated number is found by the person whose number
changed, from a report, days later.

M-OS2 is the one worth keeping: treating "this stage has no opinion" as "set it back to Draft" is the
naive reading of a nullable column, and CO3's second half exists solely to catch it. M-OS3 proves CO5
asserts the WARNING and not merely the absence of a change — without it, a version that silently did
nothing would pass.

Thirty-one mutations across both tables; **twenty** of them failed exactly one check.

M-PV1 is the only mutant in either table that is a REAL DEFECT REPLAYED rather than an invented one:
that was the shipped code until 2026-08-20, and it meant a deal that already existed without an order
could never acquire one. It failed two apps away, inside orders, on `CompanyID cannot be null`. SD24
asks the question from the sales side, where the cause actually is.

## `close-won-contract` — CT0 is gone, CT4 has a mutant, CT1 cannot have one

CT0 was a tripwire asserting bizapps-contracts was not usable, and it had no mutant BY CONSTRUCTION: its
failure condition was an environment fact rather than a code path, so there was nothing in the product to
mutate — the check *was* the code. Its failure path was demonstrated by hand instead, on 2026-08-20, by
pointing its entity constant at an entity that does exist. It then fired for real, twice, and is retired.

**CT4 has M-CT1**, and it is the more valuable of the pair. Flipping one `false` to `true` makes the seam
report a successful create for a contract type that does not resolve, and only CT4 notices. That is the
worst of the three ways a downstream can fail — worse than throwing — because the close reports success,
no contract exists, and nothing looks wrong until somebody asks where the agreement went.

**CT1 has no mutant, for a different reason than CT0 did.** What it asserts is CONTRACTS' behaviour: that
`ContractNumber` arrives minted by a sequence sales never touched. The code that could break it lives in
another repo, and mutating it from here would edit a package this branch is not allowed to change. The
honest position is that CT1 is a *contract test against a peer app*, and its guarantee is only as strong
as that peer's own suite.

## Checks with no single-check mutation, and why

* **SD1, SD6, SD7, SD13, SD14, SD17, SD19, SD20** — the order-line checks. They failed under the
  catalogue mutations above, and every one of them also failed for real earlier the same night, on its
  own assertion, before the `provisionEmbeddedOrder` guard was fixed (see `DECISIONS-NEEDED.md` DN-7).
  Both are evidence; neither is a mutation isolating one of them, because they share one seeding path by
  design.
* **CD3** — failed under `M-CD2` rather than `M-CD1`. Its subject is the caller override, which only
  matters when the pipeline default disagrees with it.
* **CD12** — failed under `M-CD1`, because a preview reports the plan; a plan that changes changes the
  preview.

## Re-running it

```bash
node test-harnesses/mutate-checks.mjs            # every mutation, ~70s each
node test-harnesses/mutate-checks.mjs M-OS1      # one
node test-harnesses/mutate-checks.mjs --list     # the table, no runs
```

**The driver is committed now, and the reason it is worth committing is the reason it nearly was not.**
This file used to say a driver would be "a fourth thing to keep in step with the checks" — true, but the
alternative turned out to be worse: the throwaway version restored mutated files with
`git checkout -- <path>`, which restores to **HEAD**, and it deleted an entire uncommitted feature
(DN-13). A tool whose job is to break things on purpose must not be able to break the thing it is
testing.

It now copies each file aside before touching it, restores from that copy byte for byte, and VERIFIES
the restore — exiting with the backup path if it ever fails. Which means it is safe against a dirty
working tree, and that is exactly when you want it: the moment a check is written is the moment to ask
whether it can fail.

Proven, not assumed: appending a comment to `DealEntityServer.ts`, running `M-SD18`, and comparing the
file's checksum before and after — identical, with the mutation applied and reverted in between.
