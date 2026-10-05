import { describe, expect, it, vi } from 'vitest';
import type { IRunViewProvider, RunViewParams, UserInfo } from '@memberjunction/core';
import type { DealEntityServer } from '../DealEntityServer.js';
import {
    AnswerAsNextTerm,
    FindUnansweredSubscriptionLines,
    SubscriptionChoiceIssue,
} from '../subscription-choice.js';

/**
 * CLOSE WON ASKS BEFORE A LINE IS MOVED A YEAR (golive #318).
 *
 * A deal line for a product the customer already holds becomes the next term at confirm unless it says
 * otherwise. The close refuses such a line with no answer, and a renewal deal answers it as the next
 * term. These pin which lines are found, the refusal's wording and attribution, and the answer's save.
 */

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const ORG = '33333333-3333-4333-8333-333333333333';
const SUB = '44444444-4444-4444-8444-444444444444';
const LINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user = { ID: 'u1' } as unknown as UserInfo;

type FakeLine = {
    ID: string;
    LineNumber: number;
    Product: string;
    ProductID: string;
    ShipToOrganizationID: string | null;
    ShipToPersonID: string | null;
    RenewsSubscriptionID: string | null;
    SubscriptionAction: 'ExtendExisting' | 'CreateNew' | null;
    Save: ReturnType<typeof vi.fn>;
    LatestResult?: { CompleteMessage: string };
};

function line(overrides: Partial<FakeLine> = {}): FakeLine {
    return {
        ID: LINE,
        LineNumber: 2,
        Product: 'Analytics License',
        ProductID: PRODUCT,
        ShipToOrganizationID: null,
        ShipToPersonID: null,
        RenewsSubscriptionID: null,
        SubscriptionAction: null,
        Save: vi.fn().mockResolvedValue(true),
        ...overrides,
    };
}

function deal(lines: FakeLine[], status = 'Draft', orderID: string | null = 'order-1'): DealEntityServer {
    const order = {
        Status: status,
        ShipToOrganizationID: null,
        ShipToPersonID: null,
        BillToOrganizationID: ORG,
        BillToPersonID: null,
        Lines: { Load: vi.fn().mockResolvedValue(undefined), Items: lines },
    };
    return { OrderID: orderID, OrderID_Object: order, OrderID_LoadObject: vi.fn() } as unknown as DealEntityServer;
}

function provider(holds = true): IRunViewProvider {
    const rows: Record<string, unknown[]> = {
        'MJ_BizApps_Orders: Products': [{ ID: PRODUCT, SubscriptionTypeID: 'type-1' }],
        'MJ_BizApps_Orders: Subscriptions': holds
            ? [{ ID: SUB, SubscriptionNumber: 'SUB-000024', Status: 'Active', ProductID: PRODUCT, HolderOrganizationID: ORG, BeneficiaryPersonID: null }]
            : [],
        'MJ_BizApps_Orders: Subscription Terms': [{ SubscriptionID: SUB, TermNumber: 1, EndDate: '2027-09-30' }],
    };
    return {
        RunView: vi.fn(async (p: RunViewParams) => ({ Success: true, Results: rows[p.EntityName ?? ''] ?? [] })),
    } as unknown as IRunViewProvider;
}

describe('FindUnansweredSubscriptionLines', () => {
    it('finds a line for a product the customer holds that has no answer', async () => {
        const found = await FindUnansweredSubscriptionLines(deal([line()]), provider(), user);
        expect(found).toHaveLength(1);
        expect(found[0].Held.Holding.SubscriptionNumber).toBe('SUB-000024');
    });

    it('leaves an answered line alone', async () => {
        const found = await FindUnansweredSubscriptionLines(deal([line({ SubscriptionAction: 'CreateNew' })]), provider(), user);
        expect(found).toEqual([]);
    });

    it('finds nothing when the customer holds nothing', async () => {
        expect(await FindUnansweredSubscriptionLines(deal([line()]), provider(false), user)).toEqual([]);
    });

    it('skips a booked order, whose lines its own confirm already decided', async () => {
        expect(await FindUnansweredSubscriptionLines(deal([line()], 'Confirmed'), provider(), user)).toEqual([]);
    });

    it('skips a deal with no order', async () => {
        expect(await FindUnansweredSubscriptionLines(deal([line()], 'Draft', null), provider(), user)).toEqual([]);
    });
});

describe('SubscriptionChoiceIssue', () => {
    it('is an error on the line choice that names the line, product, subscription and coverage end', async () => {
        const [entry] = await FindUnansweredSubscriptionLines(deal([line()]), provider(), user);
        const issue = SubscriptionChoiceIssue(entry);
        expect(issue).toMatchObject({ Section: 'lines', Field: 'SubscriptionAction', Severity: 'error' });
        expect(issue.Message).toContain('Line 2 (Analytics License)');
        expect(issue.Message).toContain('SUB-000024, covered through 2027-09-30');
    });
});

describe('AnswerAsNextTerm', () => {
    it('sets ExtendExisting and saves the line', async () => {
        const l = line();
        const found = await FindUnansweredSubscriptionLines(deal([l]), provider(), user);
        await AnswerAsNextTerm(found);
        expect(l.SubscriptionAction).toBe('ExtendExisting');
        expect(l.Save).toHaveBeenCalledTimes(1);
    });

    it('throws when the save is refused, so the close rolls back', async () => {
        const l = line({ Save: vi.fn().mockResolvedValue(false), LatestResult: { CompleteMessage: 'locked' } });
        const found = await FindUnansweredSubscriptionLines(deal([l]), provider(), user);
        await expect(AnswerAsNextTerm(found)).rejects.toThrow(/order line 2 .*locked/);
    });
});
