---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

Close-won now creates a real contract — the D-CF4 stub retires completely.

`LiveContractsSeam` calls `Contracts.SaveContract` and `Contracts.RenewTerm` by ClassFactory key, so both
close-won paths are live. Import-free: no `@mj-biz-apps/contracts-*` import or dependency, and Sales
builds, passes CI and behaves identically when contracts is absent.

The two downstreams now resolve INDEPENDENTLY. All four deployments are real — neither sibling, orders
only, contracts only, both — and a single seam that assumed they arrive together would have disabled the
contract path on any host without orders.

Money boundary holds: Sales sends product, quantity and term structure and sets no price.
`CommittedAmount` is a negotiated commitment stated as zero, never `Deal.Amount` — that is orders' cached
figure for the whole deal and would both overstate the contract and launder an orders number into a
contracts field.

Verified end to end against a seven-app isolated stack: **42/42** integration checks, including new
CT1–CT4. See `docs/KNOWN-ISSUES.md` KI-13 for the contracts-side defects found along the way.
