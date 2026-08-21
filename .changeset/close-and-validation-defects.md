---
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-ng': patch
'@mj-biz-apps/sales-integration-tests': minor
---

Four UAT-facing defects, each with the check that would have caught it.

**The close raised no order-review task for any deal that did not already have an order.** Provisioning
moved into `DealEntityServer.Save()`; the task call sat twenty lines earlier and read `deal.OrderID`. So
every seeded, legacy and imported deal closed with a warning saying it had no order — while `Save()`
created one a moment later. Finance got nothing and the warning said the opposite of what happened. The
task block now runs after the save, still inside the transaction.

**No contract-processing task ever linked its contract.** `ContractID` was never passed, so the service's
`if (input.ContractID)` branch was unreachable from production and its fallback message was dead code.

**A refused discount did not block Save.** The refusal lived in a map only the template read. A rep typed
`0.5`, saw the refusal, and saved a line still holding `0.10`.

**Every order-line error landed on the wrong pane.** `EmbeddedRecord.prefixError` emits
`OrderID_Object.Lines[3].Quantity` and the parser anchored on `[A-Za-z]+`, so errors fell through to
Party info with no row marked.

New: `close-won-tasks.WT13`/`WT14`, mutants `M-TK1`/`M-TK2`, and `scripts/assert-workspace-validation.mjs`
— wired into `verify` and into CI, which also now runs the discount gate for the first time.
