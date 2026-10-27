/**
 * The deal's order date follows the business day while the order is Draft, and a booking takes the
 * deal's close date. Orders reads `OrderDate` as the default term start, the price date and the
 * purchase day of every subscription line without its own start; it was the day the deal was created.
 *
 * `Object.create` holds the server entity without metadata; the business day is stubbed on the engine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

// A booking first asks whether any line extends a held subscription (#426); none here.
vi.mock('../subscription-choice.js', () => ({
    FindUnansweredSubscriptionLines: async () => [],
}));

const { DealEntityServer } = await import('../DealEntityServer.js');

const TODAY = '2026-10-16';
const CREATED = new Date('2026-07-01T00:00:00Z');
const CLOSED = new Date('2026-10-14T00:00:00Z');

interface Order {
    IsSaved: boolean;
    Status: string;
    OrderDate: Date;
    Save?: () => Promise<boolean>;
}

type Deal = {
    moveDraftOrderDateToToday(): Promise<void>;
    applyStageOrderStatus(plan: { StageID: string; Target: string }): Promise<void>;
};

function deal(opts: { order: Order | null; onDisk?: { Status: string; OrderDate: Date }; loaded?: Order }): Deal {
    const d = Object.create(DealEntityServer.prototype) as Deal;
    const define = (name: string, value: unknown) => Object.defineProperty(d, name, { value, writable: true });
    define('OrderID', 'order-1');
    define('CompanyID', 'company-1');
    define('ActualCloseDate', CLOSED);
    define('_orderJustProvisioned', false);
    define('_orderStatusWarnings', []);
    define('ContextCurrentUser', { ID: 'u1' });
    define('OrderID_Object', opts.order);
    define('OrderID_LoadObject', async () => opts.loaded ?? null);
    define('ProviderToUse', {
        RunView: async () => ({ Success: true, Results: opts.onDisk ? [opts.onDisk] : [] }),
        BeginEntityTransaction: async () => ({ Commit: async () => undefined, Rollback: async () => undefined }),
    });
    return d;
}

beforeEach(() => {
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Today').mockReturnValue(TODAY);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a deal save moves a Draft order to the business day', () => {
    it('moves an older Draft order date to today', async () => {
        const order: Order = { IsSaved: true, Status: 'Draft', OrderDate: CREATED };
        await deal({ order }).moveDraftOrderDateToToday();
        expect(order.OrderDate.toISOString().slice(0, 10)).toBe(TODAY);
    });

    it('keeps a Quoted order date, since its prices are as of the quote day', async () => {
        const order: Order = { IsSaved: true, Status: 'Quoted', OrderDate: CREATED };
        await deal({ order }).moveDraftOrderDateToToday();
        expect(order.OrderDate).toBe(CREATED);
    });

    it('loads the order only when the row on disk is a stale Draft', async () => {
        const loaded: Order = { IsSaved: true, Status: 'Draft', OrderDate: CREATED };
        await deal({ order: null, onDisk: { Status: 'Draft', OrderDate: CREATED }, loaded }).moveDraftOrderDateToToday();
        expect(loaded.OrderDate.toISOString().slice(0, 10)).toBe(TODAY);
    });

    it('does not load an order that is already dated today', async () => {
        const loaded: Order = { IsSaved: true, Status: 'Draft', OrderDate: CREATED };
        const d = deal({ order: null, onDisk: { Status: 'Draft', OrderDate: new Date(`${TODAY}T00:00:00Z`) }, loaded });
        await d.moveDraftOrderDateToToday();
        expect(loaded.OrderDate).toBe(CREATED);
    });
});

describe('a stage move that books the order', () => {
    it('dates the order on the deal\'s close date', async () => {
        const order: Order = { IsSaved: true, Status: 'Quoted', OrderDate: CREATED, Save: async () => true };
        await deal({ order }).applyStageOrderStatus({ StageID: 's-1', Target: 'Confirmed' });
        expect(order.Status).toBe('Confirmed');
        expect(order.OrderDate).toBe(CLOSED);
    });

    it('leaves the date of a move that does not book', async () => {
        const order: Order = { IsSaved: true, Status: 'Draft', OrderDate: CREATED, Save: async () => true };
        await deal({ order }).applyStageOrderStatus({ StageID: 's-1', Target: 'Quoted' });
        expect(order.OrderDate).toBe(CREATED);
    });

    it('puts the date back when the booking save fails', async () => {
        const order: Order = { IsSaved: true, Status: 'Quoted', OrderDate: CREATED, Save: async () => false };
        Object.assign(order, { LatestResult: { CompleteMessage: 'refused' } });
        await deal({ order }).applyStageOrderStatus({ StageID: 's-1', Target: 'Confirmed' });
        expect(order.Status).toBe('Quoted');
        expect(order.OrderDate).toBe(CREATED);
    });
});
