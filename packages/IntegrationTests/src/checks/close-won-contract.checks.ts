/**
 * @fileoverview `close-won-contract` — CT1–CT4. The seam where a won deal becomes a real agreement.
 *
 * The contract sibling of `close-won-handoff`. Same discipline: every assertion reads what CONTRACTS
 * wrote, through contracts' own entities, rather than trusting what Sales sent.
 *
 * ── ONE HONEST DIFFERENCE FROM THE ORDER CHECKS ─────────────────────────────────────────────────
 *
 * CW3 asserts that ORDERS priced the lines, because orders has a pricing engine and Sales sends no
 * price. Contracts does not work that way: `ContractLine.ContractedUnitPrice` is a NEGOTIATED price —
 * an input a human sets during redlining — and it is nullable. So there is no "contracts priced it"
 * claim to make, and CT3 does not invent one. What it asserts instead is the thing that actually
 * matters at this boundary: Sales set no price at all, and the term's committed amount is the stated
 * intent (zero) rather than a number Sales derived.
 *
 * ⚠️ **REQUIRES bizapps-contracts.** Held out of the default gate for the same reason `product-picker`
 * and `close-won-handoff` are.
 *
 * ── AND IT REFUSES TO RUN WITHOUT IT, LOUDLY ────────────────────────────────────────────────────
 *
 * An earlier version began each check with `if (!ContractsIsInstalled()) return;`. On a host without
 * contracts the bundle then reported **"4 passed"** having tested nothing — a vacuous pass, which is the
 * exact failure mode `assert-check-count.mjs` exists to catch, and which a tester would reasonably read
 * as "the contract path works here".
 *
 * There is no per-check skip in this harness — `skipped` is driven solely by `RequiresMutation`
 * filtering. So the honest behaviour for a bundle that is ONLY ever run deliberately is to fail with a
 * message naming the precondition. Silence that looks like success is worse than a red line that
 * explains itself.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { ContractsIsInstalled, LiveContractsSeam } from '@mj-biz-apps/sales-core-entities-server';
import { E_ORDERS_PRODUCT, ProductFilterFor } from '@mj-biz-apps/sales-entities';

import { InRolledBackTransaction, ProviderOf, ResolveSalesFixture } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_TERM = 'MJ_BizApps_Contracts: Contract Terms';
const E_LINE = 'MJ_BizApps_Contracts: Contract Lines';

/**
 * Refuses the run when contracts is absent, instead of quietly passing.
 *
 * This bundle is never in the default gate, so reaching it at all means someone asked for it — and the
 * only useful answer on a host without contracts is to say so.
 */
function requireContracts(): void {
    Assert(
        ContractsIsInstalled(),
        'bizapps-contracts is NOT installed on this host, so these checks cannot prove anything. ' +
            'Run this bundle only against a stack that includes contracts — see docs/WORKSPACE-SETUP.md. ' +
            '(Reporting a pass here would be a vacuous one.)',
    );
}

/** A sellable product, chosen by the PICKER's own filter so the fixture cannot drift from it. */
async function sellableProduct(ctx: Ctx, companyID: string): Promise<{ ID: string; Name: string }> {
    const r = await new RunView().RunView<{ ID: string; Name: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(companyID, new Date()),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        },
        ctx.User,
    );
    Assert(r.Success && (r.Results ?? []).length > 0, `setup: no sellable product for company ${companyID}`);
    return (r.Results ?? [])[0];
}

/**
 * A date column as a UTC `YYYY-MM-DD`, whatever shape it arrives in.
 *
 * MJ v6 returns real `Date` objects where v5 returned ISO strings, so `String(value).slice(0, 10)`
 * yields "Mon Aug 31" — and worse, LOCAL-time formatting shifts a UTC 2026-09-01 back a day. This repo
 * has been caught by the v6 shape change once already (7e55bae) and by local-time getters before that;
 * everything stored is UTC and must be compared as UTC.
 */
function isoDate(value: unknown): string {
    return new Date(value as string | Date).toISOString().slice(0, 10);
}

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** Runs the seam exactly as `CloseDealOperation` does, with a deal-shaped payload. */
async function createContract(ctx: Ctx) {
    const f = await ResolveSalesFixture(ctx);
    const product = await sellableProduct(ctx, f.PipelineCompanyID);
    const seam = new LiveContractsSeam(ctx.User, ProviderOf(ctx));
    const result = await seam.CreateContractFromDeal({
        DealID: '00000000-0000-0000-0000-000000000000',
        CompanyID: f.PipelineCompanyID,
        ContractTypeCode: 'Standard',
        TermMonths: 12,
        AccountID: f.AccountID,
        StartDate: '2026-09-01',
        Lines: [{ ProductID: product.ID, Quantity: 2, Description: product.Name }],
    });
    return { result, product };
}

export const CloseWonContractChecks: NamedCheck[] = [
    {
        Id: 'close-won-contract.CT1',
        Name: 'CT1: a won deal CREATES a contract, and its number is minted by contracts',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireContracts();
                const { result } = await createContract(ctx);
                Assert(result.Success, `the contract was not created — ${result.Message}`);
                Assert(!!result.ContractID, 'the seam reported success without a contract ID');

                const [contract] = await rows(ctx, E_CONTRACT, `ID = '${result.ContractID}'`);
                Assert(!!contract, 'the contract ID does not resolve to a row');
                // The NUMBER is contracts' to mint. Sales supplying one would be sales owning
                // contracts' sequence — the same ownership creep CW1 guards against for orders.
                Assert(
                    !!contract['ContractNumber'],
                    'the contract exists but has no ContractNumber — contracts\' server code did not run',
                );
            }),
    },
    {
        Id: 'close-won-contract.CT2',
        Name: 'CT2: the term carries the deal\'s dates and the line carries its product',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireContracts();
                const { result, product } = await createContract(ctx);
                Assert(result.Success, `the contract was not created — ${result.Message}`);

                const terms = await rows(ctx, E_TERM, `ContractID = '${result.ContractID}'`);
                AssertEqual(terms.length, 1, 'one term should have been created for the deal');
                const term = terms[0];
                AssertEqual(
                    isoDate(term['StartDate']),
                    '2026-09-01',
                    'the term must start on the date the deal stated',
                );
                AssertEqual(
                    isoDate(term['EndDate']),
                    '2027-09-01',
                    'the term must end TermMonths after it starts — 12 months, computed from the deal',
                );

                const lines = await rows(ctx, E_LINE, `ContractTermID = '${String(term['ID'])}'`);
                AssertEqual(lines.length, 1, 'one contract line per recurring deal line');
                AssertEqual(
                    String(lines[0]['ProductID']).toLowerCase(),
                    product.ID.toLowerCase(),
                    'the contract line must reference the SAME product the picker set on the deal line',
                );
                AssertEqual(Number(lines[0]['Quantity']), 2, 'the line must carry the deal line\'s quantity');
            }),
    },
    {
        Id: 'close-won-contract.CT3',
        Name: 'CT3: the contract lands in a status that fires nothing, and Sales priced none of it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireContracts();
                const { result } = await createContract(ctx);
                Assert(result.Success, `the contract was not created — ${result.Message}`);

                const [contract] = await rows(ctx, E_CONTRACT, `ID = '${result.ContractID}'`);
                /**
                 * §7.2: a close must never start billing by itself. `Draft` is the status that fires
                 * nothing — `Pending` is a TERM status and violates `CK_Contract_Status` on the contract.
                 */
                AssertEqual(String(contract['Status']), 'Draft', 'a close must not produce a live agreement');

                const terms = await rows(ctx, E_TERM, `ContractID = '${result.ContractID}'`);
                AssertEqual(
                    Number(terms[0]['CommittedAmount']),
                    0,
                    'the committed amount must be the STATED intent (zero = nothing committed), not a derived total',
                );

                /**
                 * THE MONEY BOUNDARY, asserted rather than described. Sales sends product, quantity and
                 * term structure and sets no price. `ContractedUnitPrice` is a NEGOTIATED figure a human
                 * fills in during redlining, so it must be empty on a contract Sales just created — if it
                 * ever arrives populated, something upstream started computing money.
                 */
                const lines = await rows(ctx, E_LINE, `ContractTermID = '${String(terms[0]['ID'])}'`);
                for (const l of lines) {
                    Assert(
                        l['ContractedUnitPrice'] === null || l['ContractedUnitPrice'] === undefined,
                        `Sales must set no contracted price; found ${String(l['ContractedUnitPrice'])}`,
                    );
                }
            }),
    },
    {
        Id: 'close-won-contract.CT4',
        Name: 'CT4: the seam refuses honestly — a bad type code fails LOUDLY, never silently',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireContracts();
                const f = await ResolveSalesFixture(ctx);
                const seam = new LiveContractsSeam(ctx.User, ProviderOf(ctx));

                /**
                 * THE FAILURE THIS PINS ACTUALLY HAPPENED. `RemoteOpResult.Success` means the operation
                 * RAN; contracts carries its own Success/Message in the payload. A first version of this
                 * seam checked only the envelope and returned `Success: true` with a null ContractID for
                 * a contract that was never written — a routing result claiming Executed for nothing.
                 */
                const result = await seam.CreateContractFromDeal({
                    DealID: '00000000-0000-0000-0000-000000000000',
                    CompanyID: f.PipelineCompanyID,
                    ContractTypeCode: 'NoSuchTypeCode',
                    TermMonths: 12,
                    AccountID: f.AccountID,
                    StartDate: '2026-09-01',
                    Lines: [],
                });
                Assert(result.Success === false, 'an unresolvable contract type must NOT report success');
                Assert(!result.ContractID, 'a failed create must not fabricate a contract ID');
                Assert(
                    typeof result.Message === 'string' && result.Message.length > 0,
                    'a refusal must say why — a silent false is indistinguishable from a bug',
                );
            }),
    },
];

for (const check of CloseWonContractChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('close-won-contract', {
    Setup: async () => {
        /* every check creates and rolls back its own contract */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
