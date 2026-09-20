---
'@mj-biz-apps/sales-ng': patch
---

Records that KI-20 is fixed, and stops the workarounds written for it reading as current.

`docs/KNOWN-ISSUES.md` KI-20 described removing an order line as impossible — first silently dropped, later refused outright on a unique-key violation. Orders fixed it: `OrderEntityServer.Save()` drains `Lines.Removed`, renumbers the survivors and recomputes the header, with `OrderLineRemoval.test.ts` covering both failures. bc-aidp-next-golive#187 is closed.

`save-deal.SD6` was the tripwire for exactly this, and it worked — `docs/CHECK-MUTATION-EVIDENCE.md` records it firing on `next`. Nobody read it for some weeks, which is the part worth keeping: a red tripwire nobody reads is the same as no tripwire.

The entry is marked closed with the original kept below it, because the shape recurs — a downstream app's save path silently skipping a companion-collection step.

`ShouldRefuseLineRemoval` is annotated as obsolete rather than deleted. Its only caller is the deal workspace, which no template has mounted since 9d6ef9e, so removing it would change the behaviour of a component nobody can reach and cannot be tested end to end, on a surface whose fate is still open. The note says so, and says who should delete it. The same correction is applied where the workspace and its test describe the defect as live — including a citation of `DECISIONS-NEEDED.md` DN-6, a file that does not exist in this repo.

Also restores `Metadata.Provider` after each pricing test. It is a singleton the helper replaces, and the suite went red once on an unrelated test before passing on the next runs — shared global state, caught before it became a recurring mystery.
