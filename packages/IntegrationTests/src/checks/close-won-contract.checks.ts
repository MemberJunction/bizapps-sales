/**
 * @fileoverview `close-won-contract` — CT1 and CT4, against contracts' v2 schema.
 *
 * ── HOW THIS BUNDLE GOT HERE, BECAUSE THE HISTORY IS THE ARGUMENT ───────────────────────────────
 *
 * CT1–CT4 were retired on 2026-08-20 and replaced by a tripwire. Two of the four had become unwritable
 * against contracts' clean-sheet rebuild — `ContractTerm` and `ContractLine` deleted, `Contract.Status`
 * gone — and all four were being SKIPPED because contracts was installed nowhere. Four claimed, zero
 * delivered, and nothing said so.
 *
 * The tripwire then fired TWICE, and the second time is the one that mattered:
 *
 *   1. Contracts was installed on the host, so CT1 and CT4 were written — and neither could run.
 *      `vwContracts` was malformed (`more column names specified than columns defined`) and
 *      `ContractType` was unseeded. **"Installed" and "usable" are different facts**, and the first
 *      tripwire had tested the wrong one. It was rewritten to ask whether contracts WORKS.
 *   2. Hours later it fired again, correctly: the view reads and four contract types exist. This file is
 *      the result, and it is transcription rather than rediscovery because the failure message carried
 *      the spec.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS NOT ───────────────────────────────────────────────────────────
 *
 * The two survivors, and only those. `CT2` (the term carries the dates, the line carries the product)
 * has no subject: v2's contract IS the header. `CT3`'s status half has no column to read, and its money
 * half — that sales prices nothing — moved to `save-deal.SD19`, where it is asserted against an order
 * line that exists.
 *
 * ⚠️ **REQUIRES bizapps-contracts** and refuses rather than passing vacuously.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { CompositeKey, Metadata, RunView, type BaseEntity } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { ContractsIsInstalled, LiveContractsSeam, OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import {
    SalesCloseDealOperation,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
} from '@mj-biz-apps/sales-entities';

import { E_DEAL, InRolledBackTransaction, ProviderOf, ResolveSalesFixture, TxOne } from '../fixture.js';
import { SeedDealOnPipeline } from './close-won-order.fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_CONTRACT_TYPE = 'MJ_BizApps_Contracts: Contract Types';

/** Refuses the run when contracts is absent, instead of quietly passing. */
function requireContracts(): void {
    Assert(
        ContractsIsInstalled(),
        'bizapps-contracts is NOT installed on this host, so these checks cannot prove anything — they ' +
            'assert what the seam WRITES. Reporting a pass here would be a vacuous one.',
    );
}

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/**
 * A contract type name DISCOVERED from contracts, never hardcoded — and specifically a STANDALONE one.
 *
 * The host's types are 'Change Order', 'Order Form', 'Payment Link' and 'Statement of Work', and the
 * first version of this check asked for 'Standard', which does not exist and never did. A hardcoded name
 * would pass on one deployment and fail everywhere else, which is the same mistake the vocabulary rule
 * exists to prevent, wearing another app's clothes. Contracts matches on NAME because v2's
 * `ContractType` carries no `Code` column, so the name is what the seam resolves.
 *
 * TWO THINGS ABOUT THE FILTER THAT COST A RUN EACH.
 *
 * `Status` is the column, NOT `IsActive` — contracts spells its lifecycle differently from this app, and
 * asking for the wrong one fails at the SQL layer with `Invalid column name`, which surfaces as the
 * unhelpful `Error executing SQL` through `RunView`.
 *
 * And `ParentStatusRequirement` is why this cannot be "the first active type". 'Change Order' carries
 * `Required`, meaning contracts refuses one without a `ParentContractID` — correctly. A close-won deal
 * creates a fresh agreement with no parent, so the type this check needs is one that can stand alone.
 * Reading the FLAG rather than excluding the name 'Change Order' is the same discipline this app applies
 * to its own vocabulary: contracts put that column there precisely so nobody compares the name, and its
 * own seed comment says the subclass used to do exactly that and broke on a rename.
 */
async function anyContractTypeName(ctx: Ctx): Promise<string> {
    const found = await rows(
        ctx,
        E_CONTRACT_TYPE,
        `Status = 'Active' AND (ParentStatusRequirement IS NULL OR ParentStatusRequirement <> 'Required')`,
    );
    Assert(found.length > 0, 'contracts has no standalone active contract type, so the seam has nothing to resolve');
    const name = String(found[0].Name ?? '');
    Assert(name.length > 0, 'the contract type has no name to resolve on');
    return name;
}

/**
 * Drives the seam exactly as `CloseDealOperation` does.
 *
 * Through `LiveContractsSeam` rather than the whole close, deliberately: what is under test is the
 * payload and what contracts does with it. That a contract is PLANNED at all is `close-deal.CD1`'s job,
 * and a check going through the close would fail for either reason.
 */
async function createContract(ctx: Ctx, typeName: string | null, modified?: boolean) {
    const f = await ResolveSalesFixture(ctx);
    const seam = new LiveContractsSeam(ctx.User, ProviderOf(ctx));
    return seam.CreateContractFromDeal({
        DealID: '00000000-0000-0000-0000-000000000000',
        CompanyID: f.PipelineCompanyID,
        ContractTypeCode: typeName,
        TermMonths: 12,
        AccountID: f.AccountID,
        StartDate: '2026-09-01',
        ...(modified === undefined ? {} : { StandardAgreementModified: modified }),
    });
}

/**
 * CT6 saves a deal, and a deal cannot be saved at all without orders — `DealEntityServer` provisions the
 * embedded order inside `Save()`. So this one check needs BOTH siblings, and says so rather than failing
 * on a missing `OrderNumber` two apps away.
 */
/**
 * `Execute` returns a `RemoteOpResult` ENVELOPE, and the operation's own output sits inside `.Output`.
 * Reading the envelope as if it were the output compiles against nothing and reads as a failed close.
 */
async function closeDeal(ctx: Ctx, input: SalesCloseDealInput): Promise<SalesCloseDealOutput> {
    const op = new SalesCloseDealOperation();
    const result = await op.Execute(input, { provider: ProviderOf(ctx), user: ctx.User });
    const output = (result as { Output?: SalesCloseDealOutput })?.Output;
    Assert(!!output, `Sales.CloseDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesCloseDealOutput;
}

function requireOrdersToo(): void {
    Assert(
        OrdersIsInstalled(),
        'bizapps-orders is not installed, and a deal cannot be SAVED without it — the embedded order is ' +
            'provisioned inside DealEntityServer.Save(). CT6 needs both siblings.',
    );
}

export const CloseWonContractChecks: NamedCheck[] = [
    {
        Id: 'close-won-contract.CT1',
        Name: 'CT1: the seam creates a contract, and CONTRACTS mints its number',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * SALVAGED FROM THE ORIGINAL CT1, still the right claim after the rebuild.
                 *
                 * `ContractNumber` is NOT NULL and minted by `ContractEntityServer.Save()` from a sequence
                 * taken under a lock. Sales must never supply one: two apps generating into one sequence is
                 * how a duplicate contract number reaches a customer's inbox. So the assertion is not "a row
                 * appeared" — it is that the row arrived carrying a number sales never sent.
                 */
                requireContracts();
                const typeName = await anyContractTypeName(ctx);
                const result = await createContract(ctx, typeName);
                Assert(result.Success, `the contract was not created — ${result.Message}`);
                Assert(!!result.ContractID, 'the seam returns the id of what it created');

                const [contract] = await rows(ctx, E_CONTRACT, `ID = '${result.ContractID}'`);
                Assert(!!contract, 'the contract is readable back through the entity layer');
                Assert(
                    !!contract.ContractNumber && String(contract.ContractNumber).trim().length > 0,
                    `contracts minted a number, got '${String(contract.ContractNumber)}'`,
                );

                /**
                 * AND THE PROVENANCE PAIR, which a reader would not guess at. Contracts records what
                 * created a contract polymorphically — `CreatingEntityID` naming the ENTITY,
                 * `CreatingRecordID` the row — and `CK_Contract_CreatingPairBothOrNeither` requires both or
                 * neither. A seam filling one would fail the constraint rather than this assertion, which
                 * is why asserting it here is cheap insurance rather than duplication.
                 */
                const both = !!contract.CreatingEntityID && !!contract.CreatingRecordID;
                const neither = !contract.CreatingEntityID && !contract.CreatingRecordID;
                Assert(both || neither, 'the creating pair is both or neither, never half');
            }),
    },
    {
        Id: 'close-won-contract.CT4',
        Name: 'CT4: the seam refuses honestly — a bad type name fails LOUDLY and writes nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE MORE VALUABLE OF THE TWO. A downstream that fails quietly is worse than one that is
                 * absent: the close reports success, no contract exists, and nobody looks until somebody
                 * asks where the agreement went.
                 *
                 * The count is taken before and after because "no row was written" is the half a
                 * `Success: false` does not prove on its own — a seam could refuse after writing.
                 */
                requireContracts();
                const before = (await rows(ctx, E_CONTRACT, '1 = 1')).length;

                const result = await createContract(ctx, 'not-a-contract-type');
                AssertEqual(result.Success, false, 'an unresolvable contract type must be refused');
                Assert(
                    !!result.Message && result.Message.includes('not-a-contract-type'),
                    `the refusal must name what could not be resolved, got '${result.Message}'`,
                );
                Assert(!result.ContractID, `and must invent no id, got '${result.ContractID}'`);

                AssertEqual(
                    (await rows(ctx, E_CONTRACT, '1 = 1')).length,
                    before,
                    'a refused create leaves no contract behind',
                );
            }),
    },
    {
        Id: 'close-won-contract.CT5',
        Name: 'CT5: the deal answers "standard agreement modified", and the CONTRACT carries the answer',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE ONE CRITERION THAT SPANS TWO STORIES. S-US1 asks the rep whether the deal moved
                 * off the standard agreement; S-US2 copies that answer onto the contract as
                 * `HasModifications`, and contracts' review task branches on it — a true flag means
                 * capture each deviation, a false one means read the document anyway because the rep
                 * may have forgotten to raise it.
                 *
                 * The seam hardcoded `false` until the deal had a column to copy from. BOTH VALUES ARE
                 * ASSERTED, because a hardcoded `false` passes any check that only ever sends `true`
                 * for the wrong reason — and a hardcoded `true` would be the same defect wearing the
                 * opposite value. Two contracts from the same seam, differing only in the flag.
                 *
                 * Read back through the ENTITY LAYER rather than the screen: what matters is the column
                 * contracts stored, not what sales believes it sent.
                 */
                requireContracts();
                const typeName = await anyContractTypeName(ctx);

                const modified = await createContract(ctx, typeName, true);
                Assert(modified.Success, `the modified-agreement contract was not created — ${modified.Message}`);
                const [withMods] = await rows(ctx, E_CONTRACT, `ID = '${modified.ContractID}'`);
                AssertEqual(
                    withMods?.HasModifications,
                    true,
                    'a deal flagged as modified must produce a contract flagged as modified',
                );

                const standard = await createContract(ctx, typeName, false);
                Assert(standard.Success, `the standard-agreement contract was not created — ${standard.Message}`);
                const [noMods] = await rows(ctx, E_CONTRACT, `ID = '${standard.ContractID}'`);
                AssertEqual(
                    noMods?.HasModifications,
                    false,
                    'an unmodified deal must NOT produce a contract claiming modifications',
                );

                /**
                 * And an OLDER CALLER — one that never sends the field — still lands on false. The
                 * column is NOT NULL in contracts and the deal's own flag defaults to no, so false is
                 * the honest reading of silence rather than a shrug.
                 */
                const silent = await createContract(ctx, typeName);
                Assert(silent.Success, `the field-less contract was not created — ${silent.Message}`);
                const [fromSilence] = await rows(ctx, E_CONTRACT, `ID = '${silent.ContractID}'`);
                AssertEqual(fromSilence?.HasModifications, false, 'an absent flag means false, never null');
            }),
    },
    {
        Id: 'close-won-contract.CT6',
        Name: 'CT6: the flag survives the WHOLE close — deal to contract, not just the seam call',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * WHY THIS EXISTS SEPARATELY FROM CT5. The wiring has two hops — the close READS the
                 * deal's flag into the seam payload, and the seam WRITES it onto the contract — and CT5
                 * only covers the second. Mutating the first (`M-CT3`, `buildContractInput` reporting a
                 * constant `false`) left the whole suite green: fifty checks and none of them noticed a
                 * negotiated agreement arriving at finance marked as standard.
                 *
                 * So this drives `Sales.CloseDeal` end to end and reads the contract the close actually
                 * created, found through the `Deal.ContractID` the close stamps. It is the criterion both
                 * S-US1 and S-US2 state, asserted the way a user would experience it.
                 */
                requireContracts();
                requireOrdersToo();
                const f = await ResolveSalesFixture(ctx);

                const seeded = await SeedDealOnPipeline(ctx, f, {
                    PipelineID: f.ContractPolicyPipelineID,
                    StageID: f.ContractPolicyStageID,
                    CompanyID: f.PipelineCompanyID,
                    LineCount: 1,
                });

                // The rep's answer, set the way the workspace sets it: on the deal, before the close.
                const deal = await ProviderOf(ctx).GetEntityObject<BaseEntity>(E_DEAL, ctx.User);
                const key = new CompositeKey();
                key.KeyValuePairs.push({ FieldName: 'ID', Value: seeded.DealID });
                Assert(await deal.InnerLoad(key), 'the seeded deal reloads');
                deal.Set('StandardAgreementModified', true);
                Assert(await deal.Save(), `the flag could not be set — ${deal.LatestResult?.CompleteMessage}`);

                const out = await closeDeal(ctx, {
                    DealID: seeded.DealID,
                    DealStatusTypeID: seeded.WonStatusID,
                });
                Assert(out.Success, `the close failed: ${JSON.stringify(out.Issues)}`);

                /**
                 * THE ROUTE'S OWN VERDICT FIRST, and its reason in the message. When this check first
                 * ran the contract was simply absent, and "no ContractID" says nothing about why —
                 * a policy that routed nothing, a seam that refused, and a renewal taking the other
                 * door all look identical from the deal's column.
                 */
                const route = out.Routing?.find((r) => r.Target === 'Contract');
                Assert(!!route, `the close planned no Contract route: ${JSON.stringify(out.Routing)}`);
                Assert(
                    route?.Executed === true,
                    `the Contract route did not execute — reason: ${route?.Reason ?? '(none given)'}`,
                );

                const stamped = await TxOne<{ ContractID: string | null }>(
                    ctx, `SELECT ContractID FROM __mj_BizAppsSales.Deal WHERE ID = '${seeded.DealID}'`,
                );
                Assert(
                    !!stamped.ContractID,
                    'the close stamped the agreement onto the deal — without that there is nothing to ' +
                        'read the flag off, and this check would pass vacuously',
                );

                const [contract] = await rows(ctx, E_CONTRACT, `ID = '${stamped.ContractID}'`);
                AssertEqual(
                    contract?.HasModifications,
                    true,
                    'the deal said the standard agreement was modified, so the contract must too — a ' +
                        'false here means finance is told to expect standard paper for a negotiated deal',
                );
            }),
    },
];

for (const check of CloseWonContractChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadCloseWonContractChecks(): void {
    void Metadata;
}
