import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata } from '@memberjunction/core';
import { DiscountNeedsConcession, RecordDiscountConcession } from '../discount-concession';

/**
 * A deal line's discount is a concession orders' confirm gate holds on (golive#305). Sales asks only
 * whether the discount went UP, and states the concession; orders values and decides it.
 */
describe('DiscountNeedsConcession', () => {
    it('asks for one when a new line is discounted', () => {
        expect(DiscountNeedsConcession(null, 0.1)).toBe(true);
    });

    it('asks for one when a saved discount is raised', () => {
        expect(DiscountNeedsConcession(0.1, 0.15)).toBe(true);
    });

    it('does not ask when the discount is unchanged, lowered or removed', () => {
        expect(DiscountNeedsConcession(0.1, 0.1)).toBe(false);
        expect(DiscountNeedsConcession(0.15, 0.1)).toBe(false);
        expect(DiscountNeedsConcession(0.1, 0)).toBe(false);
        expect(DiscountNeedsConcession(null, null)).toBe(false);
    });
});

describe('RecordDiscountConcession', () => {
    const LINE = 'aaaaaaaa-0000-4000-8000-000000000001';

    /**
     * Stands in for the provider's `RouteOperation`. The concession is created on the server (golive#340),
     * so the browser-side function must call the operation and never build the entity itself.
     */
    function stubOperation(envelope: { Success: boolean; Output?: Record<string, unknown>; ErrorMessage?: string }) {
        const route = vi.fn(async () => envelope);
        vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue({ RouteOperation: route } as never);
        return route;
    }

    afterEach(() => vi.restoreAllMocks());

    it('asks Sales.RecordDiscountConcession for a concession with the rep\'s trimmed reason', async () => {
        const route = stubOperation({ Success: true, Output: { Success: true, AwaitingApproval: false, ConcessionID: 'c-1' } });
        const outcome = await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Retention', Reason: ' keep the account ' });

        expect(route).toHaveBeenCalledWith('Sales.RecordDiscountConcession', {
            OrderLineID: LINE,
            ReasonCategory: 'Retention',
            Reason: 'keep the account',
        }, {});
        expect(outcome).toEqual({ Recorded: true, AwaitingApproval: false });
    });

    it('never creates the concession entity in the browser', async () => {
        stubOperation({ Success: true, Output: { Success: true, AwaitingApproval: false } });
        const create = vi.spyOn(Metadata.prototype, 'GetEntityObject');
        await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' });
        expect(create).not.toHaveBeenCalled();
    });

    it('reports a concession orders left undecided as awaiting approval', async () => {
        stubOperation({ Success: true, Output: { Success: true, AwaitingApproval: true } });
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: true, AwaitingApproval: true });
    });

    it('passes orders\' refusal through', async () => {
        stubOperation({ Success: true, Output: { Success: false, AwaitingApproval: false, Message: 'no one could approve it' } });
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: false, Message: 'no one could approve it' });
    });

    it('reports an operation that could not run, with its error', async () => {
        stubOperation({ Success: false, ErrorMessage: 'scope sales:write required' });
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: false, Message: 'scope sales:write required' });
    });

    it('refuses a blank reason without calling the operation', async () => {
        const route = stubOperation({ Success: true, Output: { Success: true, AwaitingApproval: false } });
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: '  ' }))
            .toMatchObject({ Recorded: false });
        expect(route).not.toHaveBeenCalled();
    });

    it('turns a thrown operation into a refusal with its message', async () => {
        vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue({
            RouteOperation: vi.fn(async () => {
                throw new Error('network down');
            }),
        } as never);
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: false, Message: 'network down' });
    });
});
