import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A STAGE THAT CONFIRMS THE ORDER ASKS WHAT CLOSE WON ASKS (#426).
 *
 * Close Won refuses a deal with a line for a product the customer already holds and no extend-or-new
 * answer. A stage whose `OrderStatusOnEntry` books the order reached the same confirm without that
 * check, so it extended subscriptions nobody was asked about. The stage move now holds the order back
 * with a warning, keeping the stage change (D-OS1).
 *
 * The line finder is mocked: which lines it returns is orders' rule, pinned in
 * `SubscriptionChoiceAtClose`. What is pinned here is that the stage move consults it, and only for a
 * target that books.
 */
const unanswered = vi.fn();
vi.mock('../subscription-choice.js', () => ({
    FindUnansweredSubscriptionLines: (...args: unknown[]) => unanswered(...args),
}));

const { DealEntityServer } = await import('../DealEntityServer.js');

type Plan = { StageID: string; Target: string };
type Harness = {
    applyStageOrderStatus(plan: Plan): Promise<void>;
    OrderStatusWarnings: readonly string[];
};
type FakeOrder = { ID: string; IsSaved: boolean; Status: string; Save: ReturnType<typeof vi.fn>; LatestResult: null };

function harness(status = 'Quoted', user: object | null = { ID: 'rep' }): { deal: Harness; order: FakeOrder } {
    const order: FakeOrder = { ID: 'order-1', IsSaved: true, Status: status, Save: vi.fn().mockResolvedValue(true), LatestResult: null };
    const deal = Object.create(DealEntityServer.prototype) as Harness;
    const fields: Record<string, unknown> = {
        _orderStatusWarnings: [],
        OrderID_Object: order,
        // A booking stamps the close date onto the order; the entity getter needs metadata this harness lacks.
        ActualCloseDate: null,
        ContextCurrentUser: user,
        ProviderToUse: {
            BeginEntityTransaction: async () => ({ Commit: async () => undefined, Rollback: async () => undefined }),
        },
    };
    for (const [k, v] of Object.entries(fields)) {
        Object.defineProperty(deal, k, { value: v, writable: true, configurable: true });
    }
    return { deal, order };
}

const HELD = { Line: { LineNumber: 2, Product: 'Analytics License' }, Held: {} };

beforeEach(() => {
    unanswered.mockReset();
});

describe('a stage move that would confirm the order', () => {
    it('holds the order back while a held-product line has no answer, and says which', async () => {
        unanswered.mockResolvedValue([HELD]);
        const { deal, order } = harness();
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Save).not.toHaveBeenCalled();
        expect(order.Status).toBe('Quoted');
        expect(deal.OrderStatusWarnings).toHaveLength(1);
        expect(deal.OrderStatusWarnings[0]).toContain('line 2 (Analytics License)');
        expect(deal.OrderStatusWarnings[0]).toContain('The stage change was kept.');
    });

    it('confirms when every such line has an answer', async () => {
        unanswered.mockResolvedValue([]);
        const { deal, order } = harness();
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Save).toHaveBeenCalledOnce();
        expect(order.Status).toBe('Confirmed');
        expect(deal.OrderStatusWarnings).toHaveLength(0);
    });

    it('holds the order back when the lines cannot be read, rather than deciding them', async () => {
        unanswered.mockImplementation(async () => { throw new Error('subscription view is down'); });
        const { deal, order } = harness();
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Save).not.toHaveBeenCalled();
        expect(deal.OrderStatusWarnings[0]).toContain('subscription view is down');
    });

    it('holds the order back when there is no user to read the lines as', async () => {
        const { deal, order } = harness('Quoted', null);
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Save).not.toHaveBeenCalled();
        expect(unanswered).not.toHaveBeenCalled();
    });
});

describe("a new deal's unsaved order", () => {
    it('is inserted Draft, with a warning, while a held-product line has no answer', async () => {
        unanswered.mockResolvedValue([HELD]);
        const { deal, order } = harness('Draft');
        order.IsSaved = false;
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Status).toBe('Draft');
        expect(deal.OrderStatusWarnings[0]).toContain('line 2 (Analytics License)');
    });

    it('takes the booking status when every line is answered', async () => {
        unanswered.mockResolvedValue([]);
        const { deal, order } = harness('Draft');
        order.IsSaved = false;
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Confirmed' });
        expect(order.Status).toBe('Confirmed');
        expect(order.Save).not.toHaveBeenCalled();
    });
});

describe('a stage move that does not book the order', () => {
    it('does not ask about held-product lines', async () => {
        unanswered.mockResolvedValue([HELD]);
        const { deal, order } = harness('Draft');
        await deal.applyStageOrderStatus({ StageID: 'stage-1', Target: 'Quoted' });
        expect(unanswered).not.toHaveBeenCalled();
        expect(order.Status).toBe('Quoted');
    });
});
