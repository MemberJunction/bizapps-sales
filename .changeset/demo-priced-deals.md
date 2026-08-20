---
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-integration-tests': minor
---

The demo now shows a priced deal and a stated one, and provisioning reaches deals that already exist.

`Deal.Amount` became a cache of `OrderHeader.TotalGross`, and the provenance rule holds: a hand-typed
figure is never overwritten. But every seeded deal WAS hand-typed, so the cache was invisible and so was
the argument it makes. `scripts/seed-demo-lines.mjs` now drives the entity layer for five of the seven
seeded deals — lines by product and quantity only, priced by orders — and leaves two stated on purpose.
Run from `seed-demo-data.sh`, separately re-runnable, and allowed to fail without failing the seed.

**It found a real defect.** `provisionEmbeddedOrder()` returned early on `this.IsSaved`, so an order could
only ever be provisioned on a deal's FIRST save — every deal that already existed without one was
permanently unable to acquire one, and reaching for the embedded order built an unstamped record that died
two apps away on `CompanyID cannot be null`. It now asks whether the ORDER is saved, which covers both the
new deal and the old one. Pinned by `save-deal.SD24`, mutant `M-PV1`.

**And the seeded close-won policy named a contract type that has never existed.** It said `Standard`;
contracts ships 'Order Form', 'Statement of Work', 'Payment Link' and 'Change Order'. Every B2B close-won
would have planned a contract the seam could not create. Found because contracts became readable and
`close-won-contract.CT1` resolved against the live table for the first time.

CT0, the tripwire that replaced the earlier CT1–CT4, has done its job and is retired. **CT1 and CT4 are
now real**: contracts mints the `ContractNumber` sales never sends, and an unresolvable type is refused
loudly with nothing written. `M-CT1` proves the second one — flipping one boolean makes the seam report a
successful create for a contract that does not exist, and only CT4 notices.

49 checks, 0 failed, 0 skipped. Thirty-one mutants, twenty isolating exactly one check.
