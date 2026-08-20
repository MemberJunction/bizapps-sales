---
'@mj-biz-apps/sales-integration-tests': minor
---

A lost close is now asserted to raise no tasks, and the story audit is re-reported on the integrated tree.

`close-won-tasks.WT11` asserts S-US7's third criterion directly. WT1–WT10 all prove what a WON close
creates; nothing proved what a LOST close does not, and "no tasks are created" was resting on reading
`if (target.IsWon)`. That line is correct — but an unasserted negative is what a later refactor moves a
brace through, and the failure is silent: finance works an order review for a deal nobody won. Mutant
`M-WT1` ungates the task step and fails WT11 alone.

The audit itself is now reported against the integrated branch, which is the first version worth
reporting. Four of the nine stories are met outright; every remaining gap but one is upstream of this
repo.
