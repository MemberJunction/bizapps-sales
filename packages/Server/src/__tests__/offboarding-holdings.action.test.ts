/**
 * The offboarding Actions (golive #297) read their params and write the shared-contract outputs.
 * The work is stubbed; its rules are proved in sales-core-entities-server.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunActionParams } from '@memberjunction/actions-base';

const list = vi.fn();
const reassign = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', async () => {
    const real = await vi.importActual<typeof import('../../../CoreEntitiesServer/src/offboarding/OffboardingHoldings.js')>(
        '../../../CoreEntitiesServer/src/offboarding/OffboardingHoldings.js',
    );
    return { ListSalesOffboardingHoldings: list, ReassignSalesOffboardingHoldings: reassign, ParseStringList: real.ParseStringList };
});
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, Metadata: { Provider: {} } };
});

const { ListOffboardingHoldingsAction, ReassignOffboardingHoldingsAction } = await import('../custom/offboarding-holdings.action.js');

class ListHarness extends ListOffboardingHoldingsAction {
    public Run(params: RunActionParams) { return this.InternalRunAction(params); }
}
class ReassignHarness extends ReassignOffboardingHoldingsAction {
    public Run(params: RunActionParams) { return this.InternalRunAction(params); }
}

function params(inputs: Record<string, unknown>): RunActionParams {
    return {
        Params: Object.entries(inputs).map(([Name, Value]) => ({ Name, Value, Type: 'Input' })),
        ContextUser: { ID: 'user-1' },
    } as never;
}
const output = (p: RunActionParams, name: string) => p.Params.find((x) => x.Name === name && x.Type === 'Output')?.Value;

afterEach(() => {
    list.mockReset();
    reassign.mockReset();
});

describe('MJ run authorization', () => {
    it('both classes declare AuthorizesCaller as their own static property, which is what MJ reads', () => {
        for (const cls of [ListOffboardingHoldingsAction, ReassignOffboardingHoldingsAction]) {
            expect(Object.getOwnPropertyDescriptor(cls, 'AuthorizesCaller')?.value).toBe(true);
        }
    });
});

describe('Sales.ListOffboardingHoldings', () => {
    it('passes the leaver ids and writes Holdings as a JSON string', async () => {
        list.mockResolvedValue({ Outcome: 'SUCCESS', Holdings: [{ Kind: 'DEAL_OWNER' }], Message: '1 sales item(s) held.' });
        const p = params({ LeaverUserID: ' u-1 ', LeaverEmployeeID: '' });
        const result = await new ListHarness().Run(p);
        expect(list).toHaveBeenCalledWith({ LeaverUserID: 'u-1', LeaverEmployeeID: null }, p.ContextUser);
        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(JSON.parse(String(output(p, 'Holdings')))).toEqual([{ Kind: 'DEAL_OWNER' }]);
    });

    it('fails INVALID_INPUT as the operation says', async () => {
        list.mockResolvedValue({ Outcome: 'INVALID_INPUT', Holdings: [], Message: 'no leaver' });
        const result = await new ListHarness().Run(params({}));
        expect(result).toMatchObject({ Success: false, ResultCode: 'INVALID_INPUT' });
    });
});

describe('Sales.ReassignOffboardingHoldings', () => {
    it('parses Kinds and RecordIDs and writes Moved and Skipped', async () => {
        reassign.mockResolvedValue({ Outcome: 'SUCCESS', Moved: 2, Skipped: [{ Kind: 'ACCOUNT_OWNER', Reason: 'refused' }], Message: 'Moved 2' });
        const p = params({ LeaverUserID: 'u-1', SuccessorUserID: 'u-2', Kinds: '["DEAL_OWNER"]', RecordIDs: '' });
        const result = await new ReassignHarness().Run(p);
        expect(reassign.mock.calls[0][0]).toEqual({ LeaverUserID: 'u-1', LeaverEmployeeID: null, SuccessorUserID: 'u-2', Kinds: ['DEAL_OWNER'], RecordIDs: null });
        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(output(p, 'Moved')).toBe(2);
        expect(JSON.parse(String(output(p, 'Skipped')))).toHaveLength(1);
    });

    it('refuses a Kinds value that is not a JSON array, without calling the operation', async () => {
        const result = await new ReassignHarness().Run(params({ SuccessorUserID: 'u-2', Kinds: 'DEAL_OWNER' }));
        expect(result).toMatchObject({ Success: false, ResultCode: 'INVALID_INPUT' });
        expect(reassign).not.toHaveBeenCalled();
    });

    it('reports NOT_AUTHORIZED as a failed run', async () => {
        reassign.mockResolvedValue({ Outcome: 'NOT_AUTHORIZED', Moved: 0, Skipped: [], Message: 'Only the supervisor or a Sales Admin' });
        const result = await new ReassignHarness().Run(params({ SuccessorUserID: 'u-2' }));
        expect(result).toMatchObject({ Success: false, ResultCode: 'NOT_AUTHORIZED' });
    });
});
