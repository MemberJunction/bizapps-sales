/**
 * Linking a won deal's order to its contract (contracts#77).
 *
 * Contracts' metadata and RunView are stubbed at the `@memberjunction/core` boundary; the provider
 * hands back a fake link entity that records what was set and saved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runView = vi.fn();
const entityNames: string[] = [];
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        Metadata: class { public get Entities() { return entityNames.map((Name) => ({ Name })); } },
        RunView: class { public RunView = runView; },
    };
});

const { LinkOrderToContract } = await import('../LiveContractsSeam.js');

const USER = { ID: 'user-1' } as never;
const INPUT = { ContractID: 'CCCCCCCC-0000-4000-8000-000000000001', OrderID: 'OOOOOOOO-0000-4000-8000-000000000001' };

function makeProvider(saveResult = true) {
    const saved: Array<Record<string, unknown>> = [];
    const provider = {
        async GetEntityObject() {
            const fields: Record<string, unknown> = {};
            return {
                NewRecord: () => true,
                Set: (k: string, v: unknown) => { fields[k] = v; },
                LatestResult: { CompleteMessage: 'duplicate link' },
                async Save() { saved.push({ ...fields }); return saveResult; },
            };
        },
    };
    return { provider: provider as never, saved };
}

beforeEach(() => {
    runView.mockReset();
    entityNames.length = 0;
    entityNames.push('MJ_BizApps_Contracts: Contracts', 'MJ_BizApps_Contracts: Contract Orders');
});

describe('LinkOrderToContract', () => {
    it('creates the link when none exists', async () => {
        runView.mockResolvedValue({ Success: true, Results: [] });
        const { provider, saved } = makeProvider();
        const result = await LinkOrderToContract(INPUT, provider, USER);
        expect(result.Success).toBe(true);
        expect(saved).toEqual([{ ContractID: INPUT.ContractID, OrderID: INPUT.OrderID }]);
    });

    it('leaves an existing link alone, so a reclosed deal does not trip the unique pair', async () => {
        runView.mockResolvedValue({ Success: true, Results: [{ ID: 'L-1' }] });
        const { provider, saved } = makeProvider();
        const result = await LinkOrderToContract(INPUT, provider, USER);
        expect(result.Success).toBe(true);
        expect(saved).toEqual([]);
    });

    it('reports an older contracts release that has no order links', async () => {
        entityNames.splice(1);
        const { provider, saved } = makeProvider();
        const result = await LinkOrderToContract(INPUT, provider, USER);
        expect(result.Success).toBe(false);
        expect(result.Message).toMatch(/no order links/);
        expect(saved).toEqual([]);
        expect(runView).not.toHaveBeenCalled();
    });

    it('reports a refused save with the entity message', async () => {
        runView.mockResolvedValue({ Success: true, Results: [] });
        const { provider } = makeProvider(false);
        const result = await LinkOrderToContract(INPUT, provider, USER);
        expect(result.Success).toBe(false);
        expect(result.Message).toContain('duplicate link');
    });

    it('reports a failed lookup instead of creating a second link', async () => {
        runView.mockResolvedValue({ Success: false, ErrorMessage: 'timeout', Results: [] });
        const { provider, saved } = makeProvider();
        const result = await LinkOrderToContract(INPUT, provider, USER);
        expect(result.Success).toBe(false);
        expect(result.Message).toContain('timeout');
        expect(saved).toEqual([]);
    });
});
