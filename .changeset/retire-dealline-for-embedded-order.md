---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-ng': minor
'@mj-biz-apps/sales-integration-tests': minor
---

**BREAKING — `DealLine` and `DealLineType` are retired.** A deal no longer holds lines. It holds an
`OrderHeader`, embedded and provisioned on the deal's first save, and the lines live on that order
(S-US4). The baseline migration drops both tables; `docs/DECISIONS.md` D-DL1 records the invariant
reconciliation that went with each deletion.

What moved, and what that means for a caller:

- **`deal.Lines` is gone.** Read `deal.OrderID_Object.Lines`, and remember it is declared
  `Load: 'explicit'` on the ORDER — `deal.LoadRelatedRecords(...)` does not reach it. Missing that second
  hop is a deal that renders with no lines rather than an error, which is why `save-deal.SD20` exists.
- **A rep supplies product and quantity, nothing else.** `UnitPrice`, `CompanyID` and `LineNumber` come
  back from orders. The `DealLine.Resolved*` provenance block is gone with the table; Rule 1 is now
  asserted positively by `save-deal.SD19`.
- **A discount is a PERCENT, never an amount** (D-DL2, and `npm run test:discount-gate` enforces the
  conversion in both directions).
- **Close-won no longer creates an order.** The deal already has one, and a won close leaves it alone —
  unchanged in status, still editable, so finance can correct it before the Confirm that books it
  (S-US5/S-US6). `close-won-order` CO1–CO5 assert that inverse; the two bundles that asserted the
  opposite are deleted.
- **Orders is now a HARD dependency, including for the check suite.** A deal cannot be saved without it,
  so every bundle is marked `requires: "orders"` and the coverage gate fails on an empty expectation.

Three live risks this surfaces are recorded rather than papered over: **KI-20** (removing an order line
is silently dropped, so the workspace's delete-line affordance does not work), **KI-21** (a host must
register orders' server package or no deal with an order can be opened) and **KI-22** (orders' generated
resolvers are behind the database). None is fixable from this repo; `DECISIONS-NEEDED.md` carries the
open calls.
