/**
 * The daily relink of won deals' orders to their contracts (contracts#77).
 *
 * Metadata and RunView are stubbed at the `@memberjunction/core` boundary; the provider hands back fake
 * link entities that record what was set and saved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runView = vi.fn();
const runViews = vi.fn();
const entityNames: string[] = [];
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogStatus: () => undefined,
        Metadata: class { public get Entities() { return entityNames.map((Name) => ({ Name })); } },
        RunView: class { public RunView = runView; public RunViews = runViews; },
    };
});

const { RelinkWonDealOrdersToContracts } = await import('../ContractOrderRelink.js');

const USER = { ID: 'user-1' } as never;
const WON = 'AAAAAAAA-0000-4000-8000-000000000001';
const C1 = 'CCCCCCCC-0000-4000-8000-000000000001';
const C2 = 'CCCCCCCC-0000-4000-8000-000000000002';
const O1 = 'OOOOOOOO-0000-4000-8000-000000000001';
const O2 = 'OOOOOOOO-0000-4000-8000-000000000002';

function makeProvider(refuse: string[] = []) {
    const saved: Array<Record<string, unknown>> = [];
    const provider = {
        async GetEntityObject() {
            const fields: Record<string, unknown> = {};
            return {
                NewRecord: () => true,
                Set: (k: string, v: unknown) => { fields[k] = v; },
                LatestResult: { CompleteMessage: 'refused' },
                async Save() {
                    if (refuse.includes(fields.ContractID as string)) {
                        return false;
                    }
                    saved.push({ ...fields });
                    return true;
                },
            };
        },
    };
    return { provider: provider as never, saved };
}

/** First RunView answers the Won statuses, the second the deals. */
function givenDeals(deals: Array<{ ID: string; ContractID: string; OrderID: string }>) {
    runView
        .mockResolvedValueOnce({ Success: true, Results: [{ ID: WON }] })
        .mockResolvedValueOnce({ Success: true, Results: deals });
}

beforeEach(() => {
    runView.mockReset();
    runViews.mockReset();
    entityNames.length = 0;
    entityNames.push('MJ_BizApps_Contracts: Contracts', 'MJ_BizApps_Contracts: Contract Orders');
});

describe('RelinkWonDealOrdersToContracts', () => {
    it('skips, successfully, while contracts has no order links', async () => {
        entityNames.splice(1);
        const { provider, saved } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'SKIPPED' });
        expect(runView).not.toHaveBeenCalled();
        expect(saved).toEqual([]);
    });

    it('links only the pairs with no link, matching IDs in any case', async () => {
        givenDeals([
            { ID: 'D1', ContractID: C1, OrderID: O1 },
            { ID: 'D2', ContractID: C2, OrderID: O2 },
        ]);
        runViews.mockResolvedValue([{ Success: true, Results: [{ ContractID: C1.toLowerCase(), OrderID: O1.toLowerCase() }] }]);
        const { provider, saved } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'LINKED', Found: 2, AlreadyLinked: 1, Linked: 1, Failed: 0 });
        expect(saved).toEqual([{ ContractID: C2, OrderID: O2 }]);
    });

    it('reads deals by the IsWon flag and both IDs, never a status name', async () => {
        givenDeals([]);
        const { provider } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'NONE_MISSING', Found: 0 });
        expect(runView.mock.calls[0][0].ExtraFilter).toBe('IsWon = 1');
        expect(runView.mock.calls[1][0].ExtraFilter).toBe(
            `ContractID IS NOT NULL AND OrderID IS NOT NULL AND DealStatusTypeID IN ('${WON}')`,
        );
        expect(runViews).not.toHaveBeenCalled();
    });

    it('creates one link when two deals share a contract and order', async () => {
        givenDeals([
            { ID: 'D1', ContractID: C1, OrderID: O1 },
            { ID: 'D2', ContractID: C1, OrderID: O1 },
        ]);
        runViews.mockResolvedValue([{ Success: true, Results: [] }]);
        const { provider, saved } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Found: 2, AlreadyLinked: 0, Linked: 1 });
        expect(saved).toHaveLength(1);
    });

    it('keeps going past a refused link and fails the run so the job log shows it', async () => {
        givenDeals([
            { ID: 'D1', ContractID: C1, OrderID: O1 },
            { ID: 'D2', ContractID: C2, OrderID: O2 },
        ]);
        runViews.mockResolvedValue([{ Success: true, Results: [] }]);
        const { provider, saved } = makeProvider([C1]);
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'LINK_FAILED', Linked: 1, Failed: 1 });
        expect(result.Issues[0]).toContain('D1');
        expect(saved).toEqual([{ ContractID: C2, OrderID: O2 }]);
    });

    it('creates nothing when the existing links cannot be read', async () => {
        givenDeals([{ ID: 'D1', ContractID: C1, OrderID: O1 }]);
        runViews.mockResolvedValue([{ Success: false, ErrorMessage: 'timeout', Results: [] }]);
        const { provider, saved } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'QUERY_FAILED' });
        expect(result.Issues[0]).toContain('timeout');
        expect(saved).toEqual([]);
    });

    it('fails without linking when the won deals cannot be read', async () => {
        runView
            .mockResolvedValueOnce({ Success: true, Results: [{ ID: WON }] })
            .mockResolvedValueOnce({ Success: false, ErrorMessage: 'deadlock', Results: [] });
        const { provider, saved } = makeProvider();
        const result = await RelinkWonDealOrdersToContracts(provider, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'QUERY_FAILED' });
        expect(result.Issues[0]).toContain('deadlock');
        expect(saved).toEqual([]);
    });
});
