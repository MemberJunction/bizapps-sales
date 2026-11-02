import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { SalesRecordDiscountConcessionInput, SalesRecordDiscountConcessionOutput } from '@mj-biz-apps/sales-entities';

vi.mock('../orders-availability.js', () => ({ OrdersIsInstalled: vi.fn(() => true) }));

import { OrdersIsInstalled } from '../orders-availability.js';
import { CONCESSION_REFUSED_WITHOUT_REASON } from '@mj-biz-apps/sales-entities';
import { RecordDiscountConcessionOperation } from '../RecordDiscountConcessionOperation.js';

/**
 * `Sales.RecordDiscountConcession` creates the concession on the server so orders' subclass fills and
 * decides it (golive#340), and hands back orders' own refusal instead of an empty message.
 */
type Harness = {
    InternalExecute(
        input: SalesRecordDiscountConcessionInput,
        provider: IMetadataProvider,
        user: UserInfo,
    ): Promise<SalesRecordDiscountConcessionOutput>;
};

const LINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER = { ID: 'user-1' } as UserInfo;

function concession(saved: boolean, decidedBy: string | null, completeMessage = '') {
    return {
        ID: 'concession-1',
        NewRecord: vi.fn(),
        Save: vi.fn(async () => saved),
        DecidedByUserID: decidedBy,
        LatestResult: { CompleteMessage: completeMessage },
    } as Record<string, unknown>;
}

/** An earlier concession on the line; `withdrawable` is what orders' `Delete` guard answers. */
function earlier(id: string, withdrawable: boolean, log: string[]) {
    return {
        ID: id,
        Delete: vi.fn(async () => {
            log.push(`delete ${id}`);
            return withdrawable;
        }),
        LatestResult: { CompleteMessage: withdrawable ? '' : 'This concession is Approved.' },
    };
}

function providerReturning(entity: Record<string, unknown>, existing: Array<Record<string, unknown>> = [], log: string[] = []) {
    const save = entity.Save as () => Promise<boolean>;
    entity.Save = vi.fn(async () => {
        log.push('save new');
        return save();
    });
    const get = vi.fn(async () => entity);
    const runView = vi.fn(async () => ({ Success: true, Results: existing }));
    const begin = vi.fn(async () => log.push('begin'));
    const commit = vi.fn(async () => log.push('commit'));
    const rollback = vi.fn(async () => log.push('rollback'));
    const provider = {
        GetEntityObject: get,
        RunView: runView,
        BeginTransaction: begin,
        CommitTransaction: commit,
        RollbackTransaction: rollback,
    } as unknown as IMetadataProvider;
    return { provider, get, runView, commit, rollback, log };
}

function run(input: Partial<SalesRecordDiscountConcessionInput>, provider: IMetadataProvider) {
    const op = new RecordDiscountConcessionOperation() as unknown as Harness;
    return op.InternalExecute(
        { OrderLineID: LINE, ReasonCategory: 'Retention', Reason: 'keep the account', ...input },
        provider,
        USER,
    );
}

afterEach(() => vi.mocked(OrdersIsInstalled).mockReturnValue(true));

describe('Sales.RecordDiscountConcession', () => {
    it('creates a Price concession on the line as the calling user, with the trimmed reason', async () => {
        const entity = concession(true, 'user-1');
        const { provider, get } = providerReturning(entity);
        const out = await run({ Reason: '  keep the account ' }, provider);

        expect(get).toHaveBeenCalledWith('MJ_BizApps_Orders: Order Concessions', USER);
        expect(entity).toMatchObject({ OrderLineID: LINE, DeliveryForm: 'Price', ReasonCategory: 'Retention', Reason: 'keep the account' });
        expect(out).toEqual({ Success: true, ConcessionID: 'concession-1', AwaitingApproval: false, Message: null });
    });

    it('reports a concession orders left undecided as awaiting approval', async () => {
        const { provider } = providerReturning(concession(true, null));
        expect(await run({}, provider)).toMatchObject({ Success: true, AwaitingApproval: true });
    });

    it('returns orders\' refusal, including reasons carried only in the result\'s errors', async () => {
        const { provider } = providerReturning(concession(false, null, 'OrderHeaderID cannot be null'));
        expect(await run({}, provider)).toEqual({
            Success: false,
            AwaitingApproval: false,
            ConcessionID: null,
            Message: 'OrderHeaderID cannot be null',
        });
    });

    it('falls back to a fixed message only when orders gives no text at all', async () => {
        const { provider } = providerReturning(concession(false, null, '   '));
        expect(await run({}, provider)).toMatchObject({ Success: false, Message: CONCESSION_REFUSED_WITHOUT_REASON });
    });

    it('refuses a blank reason, a missing line or a missing category without creating anything', async () => {
        const { provider, get } = providerReturning(concession(true, null));
        expect(await run({ Reason: '  ' }, provider)).toMatchObject({ Success: false });
        expect(await run({ OrderLineID: '' }, provider)).toMatchObject({ Success: false });
        expect(await run({ ReasonCategory: '' }, provider)).toMatchObject({ Success: false });
        expect(get).not.toHaveBeenCalled();
    });

    it('refuses a line ID that is not a UUID before reading or deleting anything', async () => {
        const { provider, get, runView } = providerReturning(concession(true, null));
        expect(await run({ OrderLineID: "x' OR '1'='1" }, provider)).toMatchObject({ Success: false });
        expect(runView).not.toHaveBeenCalled();
        expect(get).not.toHaveBeenCalled();
    });

    it('refuses on a host without orders', async () => {
        vi.mocked(OrdersIsInstalled).mockReturnValue(false);
        const { provider, get } = providerReturning(concession(true, null));
        expect(await run({}, provider)).toMatchObject({ Success: false });
        expect(get).not.toHaveBeenCalled();
    });

    it('turns a thrown save into a refusal with its message', async () => {
        const entity = concession(true, null);
        entity.Save = vi.fn(async () => {
            throw new Error('connection reset');
        });
        const { provider, rollback } = providerReturning(entity);
        expect(await run({}, provider)).toMatchObject({ Success: false, Message: 'connection reset' });
        expect(rollback).toHaveBeenCalled();
    });

    describe('a raised discount on a line that already has a concession', () => {
        it('withdraws the earlier one before recording, in one committed transaction', async () => {
            const log: string[] = [];
            const { provider, runView } = providerReturning(concession(true, null), [earlier('A', true, log)], log);
            expect(await run({}, provider)).toMatchObject({ Success: true });
            expect(log).toEqual(['begin', 'delete A', 'save new', 'commit']);
            expect(runView).toHaveBeenCalledWith(
                expect.objectContaining({
                    EntityName: 'MJ_BizApps_Orders: Order Concessions',
                    ExtraFilter: `OrderLineID = '${LINE}' AND DeliveryForm IN ('Price', 'Scope') AND SubscriptionTermID IS NULL`,
                    ResultType: 'entity_object',
                }),
                USER,
            );
        });

        it('keeps one orders will not withdraw, and still records the new one', async () => {
            const log: string[] = [];
            const { provider } = providerReturning(concession(true, 'user-1'), [earlier('decided', false, log), earlier('B', true, log)], log);
            expect(await run({}, provider)).toMatchObject({ Success: true });
            expect(log).toEqual(['begin', 'delete decided', 'delete B', 'save new', 'commit']);
        });

        it('rolls the withdrawal back when orders refuses the new one', async () => {
            const log: string[] = [];
            const { provider, commit } = providerReturning(concession(false, null, 'no tier'), [earlier('A', true, log)], log);
            expect(await run({}, provider)).toMatchObject({ Success: false, Message: 'no tier' });
            expect(log).toEqual(['begin', 'delete A', 'save new', 'rollback']);
            expect(commit).not.toHaveBeenCalled();
        });

        it('records nothing when the earlier concessions cannot be read', async () => {
            const entity = concession(true, null);
            const { provider, runView, rollback } = providerReturning(entity);
            runView.mockResolvedValueOnce({ Success: false, Results: [], ErrorMessage: 'timeout' } as never);
            expect(await run({}, provider)).toMatchObject({ Success: false });
            expect(entity.Save).not.toHaveBeenCalled();
            expect(rollback).toHaveBeenCalled();
        });
    });
});
