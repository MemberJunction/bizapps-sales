/**
 * A re-closed Won deal reuses its contract instead of creating a second one (#278).
 *
 * Two halves. The seam's `UpdateContractFromDeal` decides what happens to the contract (refresh while
 * unsigned, leave alone once signed, refuse when unreadable); the close's contract route decides that
 * a deal already naming a contract goes there and never to `CreateContractFromDeal`.
 *
 * Contracts' metadata is stubbed at the `@memberjunction/core` boundary, and the provider hands back a
 * fake contract that records what was set and whether it was saved. The full close against a database
 * is `close-won-contract.CT9`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ContractsCreateFromDealSeamInput,
    ContractsSeamResult,
    ContractsUpdateFromDealSeamInput,
    ContractsUpdateSeamResult,
    IDownstreamSeam,
    SalesCloseIssue,
    SalesCloseRoutingResult,
} from '@mj-biz-apps/sales-entities';

const entityNames: string[] = [];
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        Metadata: class { public get Entities() { return entityNames.map((Name) => ({ Name })); } },
    };
});

const { LiveContractsSeam } = await import('../LiveContractsSeam.js');
const { CloseDealOperation, ResetDownstreamSeam, SetDownstreamSeam } = await import('../CloseDealOperation.js');

const USER = { ID: 'user-1' } as never;
const CONTRACT_ID = 'CCCCCCCC-0000-4000-8000-000000000001';

/** The deal-sourced fields a create writes, which a refresh must write the same way. */
const DEAL_TERMS: ContractsUpdateFromDealSeamInput = {
    ContractID: CONTRACT_ID,
    DealID: 'DDDDDDDD-0000-4000-8000-000000000001',
    CompanyID: 'company-1',
    AccountID: 'account-1',
    PrimaryContactID: 'person-2',
    ContractVariances: 'Net 45 instead of Net 30',
    StandardAgreementModified: true,
    AutoRenew: true,
    CancellationNoticeDaysOverride: 15,
    AnnualIncreasePctOverride: 4,
};

/** The contract type's renewal defaults, as contracts' own seed would fill them. */
const TYPE_DEFAULTS: Record<string, unknown> = { AutoRenew: false, CancellationWindowDays: 30, AnnualIncreasePercent: 3 };

/**
 * A provider holding one contract, or none when `row` is null.
 *
 * The first object handed out is that contract. Any later one is a fresh contract, which is what the
 * refresh asks for when it needs contracts to seed a field the deal no longer states; `seeding: false`
 * makes it a contracts build without the seed methods.
 */
function providerWith(row: Record<string, unknown> | null, saveResult = true, opts: { seeding?: boolean } = {}) {
    const sets: Record<string, unknown> = {};
    const scratch: { sets: Record<string, unknown>; marked: string[]; saves: number }[] = [];
    let saves = 0;
    let handedOut = 0;
    const provider = {
        Entities: [],
        async GetEntityObject() {
            if (handedOut++ === 0) {
                return {
                    InnerLoad: async () => row !== null,
                    Get: (k: string) => (k in sets ? sets[k] : row?.[k] ?? null),
                    Set: (k: string, v: unknown) => { sets[k] = v; },
                    LatestResult: { CompleteMessage: 'refused by contracts' },
                    async Save() { saves++; return saveResult; },
                };
            }
            const fresh = { sets: {} as Record<string, unknown>, marked: [] as string[], saves: 0 };
            scratch.push(fresh);
            return {
                NewRecord: () => true,
                Get: (k: string) => fresh.sets[k] ?? null,
                Set: (k: string, v: unknown) => { fresh.sets[k] = v; },
                async Save() { fresh.saves++; return true; },
                ...(opts.seeding === false
                    ? {}
                    : {
                          MarkRenewalFieldEdited: (field: string) => { fresh.marked.push(field); },
                          async SeedRenewalDefaultsFromType() {
                              for (const [field, value] of Object.entries(TYPE_DEFAULTS)) {
                                  if (!fresh.marked.includes(field)) {
                                      fresh.sets[field] = value;
                                  }
                              }
                              return true;
                          },
                      }),
            };
        },
    };
    return { provider: provider as never, sets, saves: () => saves, scratch };
}

beforeEach(() => {
    entityNames.length = 0;
    entityNames.push('MJ_BizApps_Contracts: Contracts');
});

describe('LiveContractsSeam.UpdateContractFromDeal', () => {
    it('refreshes an unsigned contract with the same deal-sourced fields a create writes', async () => {
        const { provider, sets, saves } = providerWith({ ID: CONTRACT_ID, ContractNumber: 'CT-0007', ExecutedDate: null });
        const result = await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);

        expect(result.Success).toBe(true);
        expect(result.Signed).toBeFalsy();
        expect(result.ContractID).toBe(CONTRACT_ID);
        expect(result.ContractNumber).toBe('CT-0007');
        expect(saves()).toBe(1);
        expect(sets).toEqual({
            PrimaryContactPersonID: 'person-2',
            Description: 'Net 45 instead of Net 30',
            HasModifications: true,
            AutoRenew: true,
            CancellationWindowDays: 15,
            AnnualIncreasePercent: 4,
        });
    });

    it('gives an override the deal cleared the contract type\'s default, not the previous close\'s number', async () => {
        const { provider, sets, saves, scratch } = providerWith({
            ID: CONTRACT_ID,
            ContractNumber: 'CT-0007',
            ContractTypeID: 'type-1',
            ExecutedDate: null,
            CancellationWindowDays: 15,
            AnnualIncreasePercent: 9,
        });
        const cleared = { ...DEAL_TERMS, CancellationNoticeDaysOverride: null, AnnualIncreasePctOverride: null };
        const result = await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(cleared);

        expect(result.Success).toBe(true);
        expect(sets.CancellationWindowDays).toBe(30);
        expect(sets.AnnualIncreasePercent).toBe(3);
        expect(sets.AutoRenew, 'a stated No is the deal\'s answer, not a gap').toBe(true);
        expect(saves()).toBe(1);

        expect(scratch).toHaveLength(1);
        expect(scratch[0].sets.ContractTypeID).toBe('type-1');
        expect(scratch[0].marked).toEqual(['AutoRenew']);
        expect(scratch[0].saves, 'the seed runs on a contract that is never saved').toBe(0);
    });

    it('clears an override the deal cleared when this contracts build cannot seed, as a create would', async () => {
        const { provider, sets } = providerWith(
            { ID: CONTRACT_ID, ContractNumber: 'CT-0007', ExecutedDate: null, AnnualIncreasePercent: 9 },
            true,
            { seeding: false },
        );
        await new LiveContractsSeam(USER, provider).UpdateContractFromDeal({ ...DEAL_TERMS, AnnualIncreasePctOverride: null });
        expect(sets.AnnualIncreasePercent).toBeNull();
        expect(sets.CancellationWindowDays).toBe(15);
    });

    it('asks contracts for nothing when the deal states every renewal term', async () => {
        const { provider, scratch } = providerWith({ ID: CONTRACT_ID, ContractNumber: 'CT-0007', ExecutedDate: null });
        await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);
        expect(scratch).toHaveLength(0);
    });

    it('never rewrites which agreement this is: type, company, customer and provenance stay', async () => {
        const { provider, sets } = providerWith({ ID: CONTRACT_ID, ContractNumber: 'CT-0007', ExecutedDate: null });
        await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);
        for (const field of ['ContractTypeID', 'CompanyID', 'CustomerOrganizationID', 'CreatingEntityID', 'CreatingRecordID']) {
            expect(sets, `${field} must not be written by a refresh`).not.toHaveProperty(field);
        }
    });

    it('leaves a signed contract untouched and returns a warning', async () => {
        const { provider, sets, saves } = providerWith({
            ID: CONTRACT_ID,
            ContractNumber: 'CT-0007',
            ExecutedDate: new Date('2026-09-30T00:00:00Z'),
        });
        const result = await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);

        expect(result.Success).toBe(true);
        expect(result.Signed).toBe(true);
        expect(result.Message).toContain('CT-0007');
        expect(result.Message).toMatch(/signed/i);
        expect(sets).toEqual({});
        expect(saves()).toBe(0);
    });

    it('reports a contract it cannot load as unreadable, writing nothing', async () => {
        const { provider, saves } = providerWith(null);
        const result = await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);

        expect(result.Success).toBe(false);
        expect(result.Unreadable).toBe(true);
        expect(result.Message).toContain(CONTRACT_ID);
        expect(saves()).toBe(0);
    });

    it('reports a refused save as a failure, not as unreadable', async () => {
        const { provider } = providerWith({ ID: CONTRACT_ID, ContractNumber: 'CT-0007', ExecutedDate: null }, false);
        const result = await new LiveContractsSeam(USER, provider).UpdateContractFromDeal(DEAL_TERMS);

        expect(result.Success).toBe(false);
        expect(result.Unreadable).toBeFalsy();
        expect(result.Message).toContain('refused by contracts');
    });
});

/** A seam that answers `UpdateContractFromDeal` as told and records every call. */
class FakeSeam implements IDownstreamSeam {
    public readonly Calls: string[] = [];
    public constructor(private readonly update: ContractsUpdateSeamResult) {}
    public async CreateContractFromDeal(_input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {
        this.Calls.push('Create');
        return { Success: true, ContractID: 'NEW-CONTRACT' };
    }
    public async UpdateContractFromDeal(_input: ContractsUpdateFromDealSeamInput): Promise<ContractsUpdateSeamResult> {
        this.Calls.push('Update');
        return this.update;
    }
    public async RenewContractTerm(): Promise<ContractsSeamResult> {
        this.Calls.push('Renew');
        return { Success: false };
    }
    public async LinkOrderToContract(): Promise<ContractsSeamResult> {
        this.Calls.push('Link');
        return { Success: true };
    }
}

type Executor = {
    execute(
        plan: SalesCloseRoutingResult,
        deal: Record<string, unknown>,
        policy: Record<string, unknown>,
        provider: unknown,
        user: unknown,
    ): Promise<SalesCloseIssue[]>;
};

/** Drive the close's contract route; the deal names `contractID` (the default) or no contract at all. */
async function closeAgain(update: ContractsUpdateSeamResult, contractID: string | null = CONTRACT_ID) {
    const seam = new FakeSeam(update);
    SetDownstreamSeam(seam);
    const deal: Record<string, unknown> = { ID: 'deal-1', ContractID: contractID, CompanyID: 'company-1', AccountID: 'account-1' };
    const plan: SalesCloseRoutingResult = { Target: 'Contract', Planned: true, Executed: false, LineCount: 0 };
    const op = new CloseDealOperation() as unknown as Executor;
    let issues: SalesCloseIssue[] = [];
    let thrown: Error | null = null;
    try {
        issues = await op.execute(plan, deal, { CreateContract: true }, {}, USER);
    } catch (err) {
        thrown = err as Error;
    }
    return { seam, deal, plan, issues, thrown };
}

describe('the close reuses the contract a re-closed deal already names', () => {
    afterEach(() => ResetDownstreamSeam());

    it('refreshes an unsigned contract and keeps the deal pointing at it', async () => {
        const r = await closeAgain({ Success: true, ContractID: CONTRACT_ID, ContractNumber: 'CT-0007' });

        expect(r.seam.Calls).toEqual(['Update']);
        expect(r.deal.ContractID).toBe(CONTRACT_ID);
        expect(r.plan.Executed).toBe(true);
        expect(r.plan.RecordID).toBe(CONTRACT_ID);
        expect(r.issues).toEqual([
            expect.objectContaining({ Severity: 'info', Message: 'Reused contract CT-0007.' }),
        ]);
    });

    it('reuses a signed contract unchanged and warns that the deal and paper may differ', async () => {
        const r = await closeAgain({
            Success: true,
            Signed: true,
            ContractID: CONTRACT_ID,
            ContractNumber: 'CT-0007',
            Message: 'Contract CT-0007 is signed; the deal may differ.',
        });

        expect(r.seam.Calls).toEqual(['Update']);
        expect(r.deal.ContractID).toBe(CONTRACT_ID);
        expect(r.plan.Executed).toBe(true);
        expect(r.issues.map((i) => i.Severity)).toEqual(['info', 'warning']);
        expect(r.issues[1].Message).toContain('signed');
    });

    it('refuses the close when the contract cannot be read, and creates nothing', async () => {
        const r = await closeAgain({ Success: false, Unreadable: true, Message: 'contract could not be read' });

        expect(r.thrown?.name).toBe('CloseRefusal');
        expect(r.thrown?.message).toBe('contract could not be read');
        expect(r.seam.Calls, 'no second contract may be created in its place').toEqual(['Update']);
        expect(r.deal.ContractID).toBe(CONTRACT_ID);
    });

    it('reports a refresh that did not run as a route that did not execute, not as a refusal', async () => {
        const r = await closeAgain({ Success: false, Message: 'bizapps-contracts is not installed' });

        expect(r.thrown).toBeNull();
        expect(r.plan.Executed).toBe(false);
        expect(r.plan.Reason).toContain('not installed');
        expect(r.deal.ContractID).toBe(CONTRACT_ID);
        expect(r.issues).toEqual([]);
    });
});

describe('the first close Won creates the contract', () => {
    afterEach(() => ResetDownstreamSeam());

    it('creates one and stamps it onto a deal that names none', async () => {
        const r = await closeAgain({ Success: true }, null);

        expect(r.seam.Calls).toEqual(['Create']);
        expect(r.deal.ContractID).toBe('NEW-CONTRACT');
        expect(r.plan.Executed).toBe(true);
        expect(r.plan.RecordID).toBe('NEW-CONTRACT');
        expect(r.issues).toEqual([]);
    });
});
