# Mutation evidence — every integration check has been proven able to FAIL

A green suite is not evidence. A check can be green because the behaviour it names is correct, or because
it is asserting something that is true no matter what the code does — and the two are indistinguishable
from the outside. This file records the run that told them apart.

**Method.** For each mutation: change the PRODUCT code (never the check), rebuild, run the whole suite,
record which check IDs failed, restore the file from git. The whole suite is run each time rather than one
bundle, so a mutation that breaks something unintended shows up instead of hiding.

**Run on 2026-08-20, against `MJ_V6_Host` with bizapps-orders and bizapps-accounting linked and
bizapps-contracts absent.** 39 checks across 4 bundles: `save-deal` (16), `close-deal` (14),
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

`CO5` carries a documented limit even so. Its real claim is that the deal's close lock stops at the deal,
and the only mutant that could falsify THAT is a guard added in bizapps-orders. It is a regression
tripwire for a widening of the lock, and the mutant above proves it executes and can fail — but the two
are not the same thing, and the difference is worth stating.

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

Twenty-six mutations; sixteen of them failed **exactly one** check.

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

There is no committed driver. The table above is the artifact deliberately: a driver would be a fourth
thing to keep in step with the checks, and each row is a one-line edit plus
`RUN_MUTATION_TESTS=1 pnpm run test:integration`. If you automate it, restore the file from git rather
than by re-editing — a mutation left behind is worse than one never applied.
