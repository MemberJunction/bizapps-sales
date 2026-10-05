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

    function stubConcession(saved: boolean, decidedBy: string | null, message = '') {
        const entity = {
            NewRecord: vi.fn(),
            Save: vi.fn(async () => saved),
            DecidedByUserID: decidedBy,
            LatestResult: { Message: message },
        } as Record<string, unknown>;
        vi.spyOn(Metadata.prototype, 'GetEntityObject').mockResolvedValue(entity as never);
        return entity;
    }

    afterEach(() => vi.restoreAllMocks());

    it('states a Price concession on the line with the rep\'s reason', async () => {
        const entity = stubConcession(true, 'user-1');
        const outcome = await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Retention', Reason: ' keep the account ' });

        expect(entity).toMatchObject({ OrderLineID: LINE, DeliveryForm: 'Price', ReasonCategory: 'Retention', Reason: 'keep the account' });
        expect(outcome).toEqual({ Recorded: true, AwaitingApproval: false });
    });

    it('reports a concession orders left undecided as awaiting approval', async () => {
        stubConcession(true, null);
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: true, AwaitingApproval: true });
    });

    it('passes orders\' refusal through', async () => {
        stubConcession(false, null, 'no one could approve it');
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: 'r' }))
            .toEqual({ Recorded: false, Message: 'no one could approve it' });
    });

    it('refuses a blank reason without asking orders', async () => {
        const spy = vi.spyOn(Metadata.prototype, 'GetEntityObject');
        expect(await RecordDiscountConcession({ OrderLineID: LINE, ReasonCategory: 'Other', Reason: '  ' }))
            .toMatchObject({ Recorded: false });
        expect(spy).not.toHaveBeenCalled();
    });
});
