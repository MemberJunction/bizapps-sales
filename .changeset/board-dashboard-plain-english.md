---
'@mj-biz-apps/sales-ng': patch
---

Pipeline board and command-center dashboard: the plain-English pass from golive#207, on the two surfaces it did not reach.

#207 is written about the Deal form, and every row of its replacement table landed there. The same strings were still live elsewhere, so the form read **"Entered manually"** while the board's Amount icon said **"Stated by a person, not priced by the orders engine"** about the same number — which is the complaint #207 was filed about, one screen over. The board's other provenance tooltip said "Priced by the orders engine" where the form says "Priced by Orders"; the dashboard's owner chart bucketed ownerless deals under "Unowned" where the form's Situation card now says "No owner".

**One of these was not a copy problem.** The lock icon on a closing board column carried:

> Arriving here closes and locks the deal — close it from the deal form.

That is not developer voice, it is wrong. `planStageDefaults` gates the stage-derived status on `LocksDeal` and contributes nothing when it is set, so a deal moved into such a stage keeps the status it had — its own comment says "the deal keeps whatever status it had and only `Sales.CloseDeal` can change that". And the move cannot happen anyway: `CanDropInto` returns false for a closing column, with a second guard behind it. A rep reading the old text would have believed a drag closes a deal, which is the same wrong belief golive#205 was filed about. It now says what the lock icon means — the column is not a destination — and points where the empty state below it already points.

Scope is deliberately narrow: four user-visible strings. Left alone on purpose are `sales-section.component.ts`, where "Unowned" is in a code comment, and `metadata/queries/.forecast-by-owner.json`, which renders ownerless deals as "(unassigned)" with its own documented reasoning and would need a metadata migration to change. Both are worth a decision, neither is this change.

7 tests, five mutations checked, all killed: reverting each of the four strings, plus swapping the owner fallback from `||` to `??` — which keeps the label correct but stops a blank owner name reaching it, and is the one that proves the blank-owner check is not vacuous. The dashboard half is tested through `OwnerCoverage` itself rather than against the source, because it is a pure function and the label can be read off what it returns.
