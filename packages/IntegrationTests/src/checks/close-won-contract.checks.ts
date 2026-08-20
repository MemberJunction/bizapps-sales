/**
 * @fileoverview `close-won-contract` — CT0, a tripwire on whether contracts is USABLE.
 *
 * ── THE HISTORY, BECAUSE IT IS WHAT THE CHECK ENCODES ───────────────────────────────────────────
 *
 * CT1–CT4 were retired on 2026-08-20: two had become unwritable against contracts' clean-sheet rebuild
 * (`ContractTerm` and `ContractLine` deleted, `Contract.Status` gone), and all four were SKIPPED because
 * contracts was installed on neither development database. Four claimed, zero delivered. A tripwire
 * replaced them, asserting that contracts was ABSENT so that the day it arrived, the check would go red
 * carrying the list of what to write.
 *
 * **It fired the same day** — and the lesson is in what happened next. CT1 and CT4 were duly written
 * against the v2 schema, and neither could pass:
 *
 *   · `View or function '__mj_BizAppsContracts.vwContracts' has more column names specified than
 *     columns defined` — contracts' generated view is malformed on this host, so the entity cannot be
 *     READ at all.
 *   · `No contract type matches 'Standard'` — its `ContractType` table is unseeded, so the seam has
 *     nothing to resolve.
 *
 * So **"installed" and "usable" are different facts**, and the first tripwire tested the wrong one:
 * seven entities registered and sixteen objects in the schema, and not one row readable. That is the
 * same shape as KI-21 and KI-22 — a schema migrated onto a host whose metadata never followed — and it
 * is why this version asks whether contracts WORKS rather than whether it is present.
 *
 * When this goes red, contracts is genuinely usable and the two checks below become writable. They are
 * described precisely rather than left as an exercise, because the person who sees this fail is the
 * person who needs the list.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView } from '@memberjunction/core';
import { Assert, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';

const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_CONTRACT_TYPE = 'MJ_BizApps_Contracts: Contract Types';

/**
 * The two checks this bundle owes, kept as prose because prose survives a schema change.
 *
 * Both were written in full on 2026-08-20 and reverted when they could not run; the wording below is
 * what they asserted, so restoring them is transcription rather than rediscovery.
 */
const WHAT_TO_WRITE = [
    'CT1 — the seam creates a contract and CONTRACTS mints its number. `ContractNumber` is NOT NULL and ' +
        'assigned by `ContractEntityServer.Save()` from a sequence taken under a lock, so the assertion is ' +
        'that the row arrives carrying a number sales never sent. Also assert the polymorphic provenance ' +
        'pair — `CreatingEntityID` and `CreatingRecordID` — is both or neither, which is what ' +
        '`CK_Contract_CreatingPairBothOrNeither` requires.',
    'CT4 — the seam refuses HONESTLY. A bad `ContractTypeCode` must return `Success: false` with a ' +
        'message naming what could not be resolved, invent no id, and leave no row behind. Count contracts ' +
        'before and after: a `Success: false` alone does not prove nothing was written. This is the more ' +
        'valuable of the two — a downstream that fails quietly is worse than one that is absent.',
    'NOT CT2 or CT3. CT2 (the term carries the dates, the line carries the product) has no subject: v2\'s ' +
        'contract IS the header. CT3\'s status half has no column to read, and its money half — that sales ' +
        'prices nothing — already moved to `save-deal.SD19`, asserted against an order line that exists.',
].join('\n      · ');

/** Can this host actually READ a contract? Registered entities are not the same as working ones. */
async function contractsAreReadable(ctx: Parameters<NamedCheck['Fn']>[0]): Promise<string | null> {
    const md = new Metadata();
    if (!md.Entities.some((e) => e.Name === E_CONTRACT)) {
        return 'contracts is not installed on this host';
    }
    const read = await new RunView().RunView({ EntityName: E_CONTRACT, ResultType: 'simple' }, ctx.User);
    if (!read.Success) {
        return `contracts is installed but its rows cannot be read (${read.ErrorMessage ?? 'unknown error'})`;
    }
    const types = await new RunView().RunView({ EntityName: E_CONTRACT_TYPE, ResultType: 'simple' }, ctx.User);
    if (!types.Success || (types.Results ?? []).length === 0) {
        return 'contracts is installed and readable, but its ContractType table is unseeded, so the seam ' +
            'has nothing to resolve';
    }
    return null;
}

export const CloseWonContractChecks: NamedCheck[] = [
    {
        Id: 'close-won-contract.CT0',
        Name: 'CT0: TRIPWIRE — contracts is not USABLE yet, so the contract checks cannot exist',
        // Reads only. `RequiresMutation` would have it skipped on a bare host, which is where it matters.
        RequiresMutation: false,
        Fn: async (ctx) => {
            const reason = await contractsAreReadable(ctx);
            Assert(
                reason !== null,
                'CONTRACTS IS NOW USABLE, and this check has done its job by failing.\n\n' +
                    '    Its entities resolve, a contract can be read, and at least one ContractType exists — ' +
                    'which is the whole precondition CT1 and CT4 were missing. Write these two and delete ' +
                    'this check:\n\n' +
                    `      · ${WHAT_TO_WRITE}\n\n` +
                    '    Drive `LiveContractsSeam.CreateContractFromDeal` directly rather than the whole ' +
                    'close: routing is already `close-deal.CD1`\'s job, and a check going through the close ' +
                    'would fail for either reason. Move the count in ' +
                    '`scripts/expected-check-counts.json` in the SAME commit, and set `requires: "contracts"`.',
            );
            // Recorded rather than silent: the reason is the useful half on a host where it passes.
            console.log(`      (CT0: ${reason})`);
        },
    },
];

for (const check of CloseWonContractChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadCloseWonContractChecks(): void {
    void Metadata;
}
