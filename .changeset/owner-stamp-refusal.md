---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

`Deal.OwnerEmployeeID` now refuses a direct edit instead of silently keeping it.

S-US1 says the owner column "cannot be edited directly", and it could. `stampOwnerFromTeam()` only
re-derives the stamp when the roster took part in the save — which is correct, because otherwise an
ordinary header edit would read an unloaded collection as "no owner" and clear it. The consequence was
two paths and a refusal on neither: a save carrying the roster silently discarded a hand-set stamp, and a
header-only save silently **kept** one. So the app could hold a deal whose owner column and owner-role
team row named different people, reached by a plain `BaseEntity.Save()` with no error. The stamp exists so
per-rep rollups need no join, which means a rollup could disagree with the roster it was meant to
shortcut.

`ownerStampEditRefusal()` refuses the save, with a message naming `SetOwner` — the operation the caller
actually wanted. Refusing beats silently re-deriving: quietly correcting someone who believed they were
setting the owner produces the same wrong outcome with nothing to notice.

`SetOwner()` is unaffected, and not by luck: it loads the roster before assigning the stamp, so the roster
is part of that save. The guard's conditions mirror `stampOwnerFromTeam`'s exactly.

`save-deal.SD26` asserts the refusal, that nothing was written, and that the refusal is **narrow** — the
same header-only save with an ordinary field must still succeed. Mutant `M-OW1` removes the guard and
fails SD26 alone.

53 checks, 0 failed, 0 skipped. Thirty-five mutants, twenty-four isolating exactly one check.
