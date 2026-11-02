import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { CloseDealOperation } from '../CloseDealOperation.js';
import { CloseWonTaskService, type CloseWonTaskInput } from '../CloseWonTaskService.js';

/**
 * THE CONTRACT TASK FOLLOWS THE SAME POLICY AS THE CONTRACT (#354).
 *
 * The close decides whether to create a contract from the EFFECTIVE policy: the pipeline's
 * `CloseWonPolicy` with the caller's `PolicyOverrides` merged over it. `CloseWonTaskService` used to
 * re-read the raw pipeline policy for the contract task, so `PolicyOverrides: { CreateContract: true }`
 * on a pipeline set to false made a contract with no task, and the reverse raised a task with no
 * contract. The service now takes the flag from the close.
 *
 * `resolvePolicy` runs for real against a stubbed pipeline read; the other reads are stubbed at the
 * operation's private seams, as `CloseDateBusinessDay` does.
 */

const WON = { ID: 'won', IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true };
const NO_CLOSING = { StageID: null, Probability: null, ForecastCategoryTypeID: null, Issues: [] as never[] };

afterEach(() => {
    vi.restoreAllMocks();
});

async function wonClose(pipelineCreatesContract: boolean, overrides?: { CreateContract: boolean }) {
    let taskInput: CloseWonTaskInput | null = null;
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(CloseWonTaskService.prototype, 'CreateCloseWonTasks').mockImplementation(async (input) => {
        taskInput = input;
        return { Success: true, Tasks: [], Issues: [] };
    });

    const deal = {
        ID: 'd1', Name: 'Override win', DealNumber: 'D-1', CompanyID: 'c1', PipelineID: 'p1', OrderID: 'o1',
        ContractID: null, AccountID: 'a1', DealStatusTypeID: null, PipelineStageID: null,
        LossReasonID: null, LossNotes: null, ClosedAt: null, ClosedByUserID: null, ActualCloseDate: null,
        OrderStatusWarnings: [], LastStageEventID: 'e1',
        DeclareTransition: () => undefined,
        Load: async () => true,
        Save: async () => true,
        BeginClose: async <T>(body: () => Promise<T>): Promise<T> => body(),
    };
    const provider = {
        GetEntityObject: async () => deal,
        BeginTransaction: async () => undefined,
        CommitTransaction: async () => undefined,
        RollbackTransaction: async () => undefined,
        RunView: async () => ({
            Success: true,
            Results: [{ CloseWonPolicy: JSON.stringify({ CreateContract: pipelineCreatesContract }) }],
        }),
    };

    const op = new CloseDealOperation() as unknown as Record<string, unknown> & {
        InternalExecute(input: unknown, provider: unknown, user: unknown): Promise<{ Success: boolean }>;
    };
    op.loadStatusFlags = async () => WON;
    op.validate = async () => ({ Issues: [], LossReasonName: null, RenewalNextTerm: [] });
    op.planRouting = async () => [];
    op.resolveClosing = async () => ({ ...NO_CLOSING, Probability: 100 });
    // The deal's schedule reaching its order has its own checks (close-won-schedule CS1-CS5).
    op.sendScheduleToOrder = async () => null;

    const result = await op.InternalExecute(
        { DealID: 'd1', DealStatusTypeID: WON.ID, PolicyOverrides: overrides },
        provider,
        { ID: 'u1' },
    );
    expect(result.Success, 'the close itself must run').toBe(true);
    return taskInput as CloseWonTaskInput | null;
}

describe('the contract task on a won close', () => {
    it('follows an override that turns the contract ON for a pipeline that has it off', async () => {
        expect((await wonClose(false, { CreateContract: true }))?.CreateContract).toBe(true);
    });

    it('follows an override that turns the contract OFF for a pipeline that has it on', async () => {
        expect((await wonClose(true, { CreateContract: false }))?.CreateContract).toBe(false);
    });

    it('takes the pipeline policy when nothing is overridden', async () => {
        expect((await wonClose(true))?.CreateContract).toBe(true);
        expect((await wonClose(false))?.CreateContract).toBe(false);
    });
});
