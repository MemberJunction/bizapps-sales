---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-ng': minor
'@mj-biz-apps/sales-integration-tests': minor
---

`Deal.StandardAgreementModified` — one column that closes a criterion in two stories.

S-US1 lists a "standard agreement modified" flag among the fields a rep supplies, and no such column
existed. S-US2 says the contract's `HasModifications` is copied from it, which is why the contracts seam
hardcoded `false` — there was nothing to copy. Both are now real: `BIT NOT NULL DEFAULT 0` on `Deal`,
on the variances pane of the deal workspace, carried through `buildContractInput` into
`LiveContractsSeam`.

**It is deliberately not derived from `ContractVariances`.** An empty variances box means nobody wrote
anything down, which is a different claim from nothing having been negotiated — and contracts' review
task branches on the difference: a true flag means capture each deviation as a
`ContractTemplateModification`, a false one still means read the document, because the rep may have
forgotten to raise it. Inferring the flag from whether somebody typed a paragraph would hand finance a
guess and call it a fact.

Two checks, because the wiring has two hops. `CT5` proves the seam writes both values and reads an
absent flag as false. `CT6` drives the whole close and reads the contract the close created — and it
exists because mutating the first hop alone (`M-CT3`) left all fifty other checks green.

**CT6 also caught the `'Standard'` contract type a second time**, in the seeded `CloseWonPolicy` the
integration fixture resolves. Same defect as the one CT1 found in the metadata file, in a different
place, and it would have made every B2B close-won plan a contract that could not be created.

51 checks, 0 failed, 0 skipped. Thirty-three mutants, twenty-two isolating exactly one check.
