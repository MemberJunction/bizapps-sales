import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * WHICH DEAL CREATED THIS ORDER (bc-aidp-next-golive#320 §5).
 *
 * Orders reviews a hand-entered order by its `NoDeal` trigger and lets a deal order confirm without
 * review. `OrderHeader` has no `DealID`, so Orders asks through `RegisterOrderDealLink`, and Sales
 * answers from `Deal.OrderID`. The seam ships in orders-entities 5.36.0 while sales still builds
 * against 5.30.0, so the registration is looked up on the module rather than imported: these tests hand
 * it both shapes.
 *
 * `RunView` is stubbed at the module boundary, the way the close-won routing suite does it, and both
 * log functions are captured so a failed read and a missing seam can be asserted to reach the log.
 */
const runView = vi.fn();
const logged: string[] = [];
const statuses: string[] = [];
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: (message: unknown) => { logged.push(String(message)); },
        LogStatus: (message: unknown) => { statuses.push(String(message)); },
        RunView: class { public RunView = runView; },
    };
});

const { DealOrderLink, FindRegisterOrderDealLink, LoadDealOrderLink, ORDER_DEAL_LINK_MIN_ORDERS_VERSION } =
    await import('../DealOrderLink.js');
type Seam = import('../DealOrderLink.js').DealOrderLinkSeam;
const OrdersEntities = await import('@mj-biz-apps/orders-entities');

/**
 * REAL HEX, because `SafeID` now validates the SHAPE of an id rather than only escaping quotes. The
 * readable placeholder this replaced ('oooooooo-...') is not a valid UUID, and the validator rejects
 * it before it reaches a filter. The deal ids below are only ever read back out of a result, never
 * put into a filter, so they stay as they were.
 */
const ORDER = '0cde0000-0000-4000-8000-000000000001';
const DEAL_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const DEAL_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const USER = { ID: 'user-1' } as never;

afterEach(() => {
    runView.mockReset();
    logged.length = 0;
    statuses.length = 0;
});

function deals(rows: { ID: string; DealNumber: string | null }[]): void {
    runView.mockResolvedValue({ Success: true, Results: rows });
}

describe('the deal for an order', () => {
    it('is none when no deal points at the order', async () => {
        deals([]);
        expect(await new DealOrderLink().DealForOrder(ORDER, USER)).toBeNull();
    });

    it('is the deal whose OrderID is the order, with its number', async () => {
        deals([{ ID: DEAL_A, DealNumber: 'DEAL-000042' }]);
        expect(await new DealOrderLink().DealForOrder(ORDER, USER)).toEqual({ DealID: DEAL_A, DealNumber: 'DEAL-000042' });
    });

    it('reads Deal by OrderID, ordered by ID, as the context user', async () => {
        deals([{ ID: DEAL_A, DealNumber: 'DEAL-1' }]);
        await new DealOrderLink().DealForOrder(ORDER, USER);
        expect(runView).toHaveBeenCalledTimes(1);
        const [args, user] = runView.mock.calls[0];
        expect(args).toMatchObject({
            EntityName: 'MJ_BizApps_Sales: Deals',
            ExtraFilter: `OrderID = '${ORDER}'`,
            OrderBy: 'ID',
            ResultType: 'simple',
        });
        expect(user, 'a read made as nobody answers a different question').toBe(USER);
    });

    it('takes the first by ID when two deals point at one order, so the answer is stable', async () => {
        deals([{ ID: DEAL_A, DealNumber: 'DEAL-1' }, { ID: DEAL_B, DealNumber: 'DEAL-2' }]);
        expect((await new DealOrderLink().DealForOrder(ORDER, USER))?.DealID).toBe(DEAL_A);
    });

    it('reports a blank deal number as none rather than as an empty string', async () => {
        deals([{ ID: DEAL_A, DealNumber: '   ' }]);
        expect(await new DealOrderLink().DealForOrder(ORDER, USER)).toEqual({ DealID: DEAL_A, DealNumber: null });
    });

    it('reads without a user when orders has none to give', async () => {
        deals([]);
        await new DealOrderLink().DealForOrder(ORDER, null);
        expect(runView.mock.calls[0][1]).toBeUndefined();
    });

    /**
     * This used to assert the quote was DOUBLED and the read went ahead. An id that is not a UUID now
     * never reaches a filter at all: the link throws, which is the same answer it already gives for an
     * empty id and what the seam asks for when it cannot tell. Failing closed beats querying with it.
     */
    it('throws on an order id that is not a UUID, instead of escaping it into a filter', async () => {
        await expect(new DealOrderLink().DealForOrder("x' OR 1=1 --", USER)).rejects.toThrow(/not a usable record id/);
        expect(runView, 'and no read was attempted with it').not.toHaveBeenCalled();
    });
});

/**
 * "COULD NOT TELL" IS NOT "NO DEAL". The seam asks for a throw, and orders refuses the confirm naming
 * the fault. Null here would raise a NoDeal review against an order a deal did create.
 */
describe('a deal read that fails', () => {
    it('throws, carrying the reason, rather than answering no deal', async () => {
        runView.mockResolvedValue({ Success: false, ErrorMessage: 'deal view is down', Results: [] });
        await expect(new DealOrderLink().DealForOrder(ORDER, USER)).rejects.toThrow('deal view is down');
    });

    it('logs it, naming the order, because the refused confirm is otherwise the only trace', async () => {
        runView.mockResolvedValue({ Success: false, ErrorMessage: 'deal view is down', Results: [] });
        await new DealOrderLink().DealForOrder(ORDER, USER).catch(() => undefined);
        expect(logged.join(' ')).toContain('DealOrderLink');
        expect(logged.join(' ')).toContain(ORDER);
        expect(logged.join(' ')).toContain('deal view is down');
    });

    it('lets a thrown read through rather than turning it into an answer', async () => {
        runView.mockRejectedValue(new Error('connection reset'));
        await expect(new DealOrderLink().DealForOrder(ORDER, USER)).rejects.toThrow('connection reset');
    });

    it('refuses an empty order id without querying', async () => {
        await expect(new DealOrderLink().DealForOrder('  ', USER)).rejects.toThrow('order id is required');
        expect(runView).not.toHaveBeenCalled();
    });
});

/**
 * A stand-in for orders-entities 5.36.0's seam, written the way #912 writes it: a process-wide slot, a
 * register function, and the resolver orders' review calls. If sales' link fits this, it fits that.
 */
function orders536() {
    let slot: Seam | null = null;
    return {
        RegisterOrderConfirmVeto: () => undefined,
        RegisterOrderDealLink: vi.fn((link: Seam | null) => { slot = link; }),
        HostOrderDealLink: () => slot,
        ResolveOrderDeal: async (link: Seam | null, orderHeaderID: string | null, user: never | null) =>
            !link || !orderHeaderID ? null : link.DealForOrder(orderHeaderID, user),
    };
}

describe('registering with orders', () => {
    it('finds RegisterOrderDealLink on an orders release that has it', () => {
        const mod = orders536();
        expect(FindRegisterOrderDealLink(mod)).toBe(mod.RegisterOrderDealLink);
    });

    it('finds nothing on an orders release that predates it', () => {
        expect(FindRegisterOrderDealLink({ RegisterOrderConfirmVeto: () => undefined })).toBeNull();
    });

    it('finds nothing when the name is there but is not a function', () => {
        expect(FindRegisterOrderDealLink({ RegisterOrderDealLink: 'not a function' })).toBeNull();
    });

    it('registers a DealOrderLink and says so', () => {
        const mod = orders536();
        expect(LoadDealOrderLink(mod)).toBe(true);
        expect(mod.RegisterOrderDealLink).toHaveBeenCalledTimes(1);
        expect(mod.HostOrderDealLink()).toBeInstanceOf(DealOrderLink);
        expect(statuses).toEqual([]);
    });

    it('answers orders through the registered link, end to end', async () => {
        const mod = orders536();
        LoadDealOrderLink(mod);
        deals([{ ID: DEAL_A, DealNumber: 'DEAL-7' }]);
        expect(await mod.ResolveOrderDeal(mod.HostOrderDealLink(), ORDER, USER)).toEqual({ DealID: DEAL_A, DealNumber: 'DEAL-7' });
    });

    it('registers nothing on an older orders, and logs which release it needs', () => {
        expect(LoadDealOrderLink({ RegisterOrderConfirmVeto: () => undefined })).toBe(false);
        expect(statuses.join(' ')).toContain('RegisterOrderDealLink');
        expect(statuses.join(' ')).toContain(ORDER_DEAL_LINK_MIN_ORDERS_VERSION);
    });

    /**
     * Against the orders-entities this workspace actually resolved, the verdict follows what that module
     * exports, not a version number written down here: today 5.30.0 (none), and true once the floor
     * moves to a release that carries the seam.
     */
    it('follows the installed orders-entities without throwing', () => {
        const has = typeof (OrdersEntities as { RegisterOrderDealLink?: unknown }).RegisterOrderDealLink === 'function';
        expect(LoadDealOrderLink()).toBe(has);
    });
});
