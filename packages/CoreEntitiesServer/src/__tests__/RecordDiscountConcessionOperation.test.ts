import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { SalesRecordDiscountConcessionInput, SalesRecordDiscountConcessionOutput } from '@mj-biz-apps/sales-entities';

vi.mock('../orders-availability.js', () => ({ OrdersIsInstalled: vi.fn(() => true) }));

import { OrdersIsInstalled } from '../orders-availability.js';
import { CONCESSION_REFUSED_WITHOUT_REASON, RecordDiscountConcessionOperation } from '../RecordDiscountConcessionOperation.js';

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

function providerReturning(entity: Record<string, unknown>) {
    const get = vi.fn(async () => entity);
    return { provider: { GetEntityObject: get } as unknown as IMetadataProvider, get };
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
        const { provider } = providerReturning(entity);
        expect(await run({}, provider)).toMatchObject({ Success: false, Message: 'connection reset' });
    });
});
