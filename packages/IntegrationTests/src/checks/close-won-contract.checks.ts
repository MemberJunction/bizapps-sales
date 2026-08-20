/**
 * @fileoverview `close-won-contract` — CT0, a TRIPWIRE where four real checks used to be.
 *
 * ── WHY CT1–CT4 ARE GONE ────────────────────────────────────────────────────────────────────────
 *
 * They were wrong AND skipped, which is the worst combination available: wrong, so they could not be
 * trusted; skipped, so nothing said they were wrong. From every angle — the manifest, the runner's
 * output, the coverage gate — the bundle read as four checks' worth of coverage. The real number was
 * zero, and had been since contracts' clean-sheet rebuild on 2026-08-18.
 *
 * Measured against `origin/next` at `d2f64e3`, the commit contracts' seam rewrite was verified against:
 *
 * | Check | What it asserted | State |
 * |---|---|---|
 * | CT1 | a won deal creates a contract; the NUMBER is minted by contracts | still true |
 * | CT2 | the TERM carries the deal's dates, the LINE carries its product | **unwritable** — `ContractTerm` and `ContractLine` are deleted |
 * | CT3 | the contract lands in a status that fires nothing; sales priced none of it | **half unwritable** — `Contract` has no `Status` column, and there is no line to check a price on |
 * | CT4 | the seam refuses honestly — a bad type code fails LOUDLY | still true |
 *
 * v2's contract is a HEADER. The seven tables are `ContractTemplateType`, `ContractTemplate`,
 * `ContractTemplateProvision`, `ContractType`, `ContractSequence`, `Contract` and
 * `ContractTemplateModification`. The lifecycle that `Status` used to name is DERIVED.
 *
 * ── WHY THE SURVIVORS WERE NOT SIMPLY REWRITTEN HERE ────────────────────────────────────────────
 *
 * Because they could not be RUN. Contracts is installed in neither database this app is developed
 * against — not `MJ_V6_Host`, not `MJ_BizAppsSales_V6` — so a rewrite would be four more checks that
 * nobody can execute, written against a payload shape that is itself being rewritten on
 * `feature/contracts-seam-v6`. That is how this bundle got into its previous state. Writing
 * unverifiable checks to replace unverifiable checks is not progress; it is the same mistake with a
 * fresher date on it.
 *
 * ── WHAT REPLACES THEM, AND WHEN ────────────────────────────────────────────────────────────────
 *
 * CT0 asserts the PREMISE — that contracts is absent — so the day it stops being true this check goes
 * red and names what has to be written. It is the `close-deal.CD7` pattern: a check whose failure is a
 * work order rather than a defect. Until then it runs everywhere, in the default gate, and the manifest
 * says 1 because 1 is the number of things being checked.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata } from '@memberjunction/core';
import { Assert, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';

const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';

/**
 * The four requirements CT1–CT4 covered, kept as prose because prose is what survives a schema change.
 *
 * Written into the failure message rather than a comment on purpose: whoever sees this check go red is
 * the person who needs the list, and they should not have to find this file to read it.
 */
const WHAT_TO_WRITE = [
    'CT1 (still valid): a won deal on a contract-creating policy produces a Contract, and ContractNumber ' +
        'is minted by contracts under its own lock — sales must never supply one.',
    'CT4 (still valid): the seam refuses LOUDLY on a bad ContractTypeCode — Success:false with a reason, ' +
        'and no contract row left behind.',
    'CT2 is unwritable as it stood: ContractTerm and ContractLine no longer exist. The surviving question ' +
        'is whether the HEADER carries the dates and negotiated terms the deal actually agreed.',
    'CT3 is half unwritable: Contract has no Status column, so "lands in a status that fires nothing" has ' +
        'no subject. The money half stands and is the more important one — sales sends product, quantity ' +
        'and term structure and sets NO price. Assert it on whatever the v6 seam sends.',
].join('\n      · ');

export const CloseWonContractChecks: NamedCheck[] = [
    {
        Id: 'close-won-contract.CT0',
        Name: 'CT0: TRIPWIRE — contracts is not installed, so the contract checks cannot exist yet',
        // Not a mutation: it reads metadata and writes nothing. That is deliberate — it must run on a
        // bare host, and `RequiresMutation` would have it skipped exactly where it is most needed.
        RequiresMutation: false,
        Fn: async () => {
            const installed = new Metadata().Entities.some((e) => e.Name === E_CONTRACT);
            Assert(
                !installed,
                'CONTRACTS IS NOW INSTALLED, and this check has done its job by failing.\n\n' +
                    '    CT1–CT4 were retired on 2026-08-20: two of the four had become unwritable against ' +
                    "contracts' clean-sheet rebuild, and all four were being SKIPPED because contracts was " +
                    'installed nowhere — so the bundle reported four checks of coverage and delivered none.\n\n' +
                    '    Now that it is here, write these and delete this check:\n\n' +
                    `      · ${WHAT_TO_WRITE}\n\n` +
                    "    The reference for the payload is `LiveContractsSeam` on the v6 entity path — it drives " +
                    'GetEntityObject -> set -> Save() rather than a remote operation, because contracts ships ' +
                    'none. Move the count in `scripts/expected-check-counts.json` in the SAME commit.',
            );
        },
    },
];

for (const check of CloseWonContractChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/**
 * No lifecycle hooks, and no `requireContracts()` guard any more.
 *
 * The old bundle refused to run without contracts, which was the right call for checks that needed it
 * and is the wrong call for a check whose entire subject is that it is missing.
 */

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadCloseWonContractChecks(): void {
    void Metadata;
}
