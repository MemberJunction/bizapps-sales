import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * golive #485: a deal's MRR and ARR are copies of orders' recurring totals, beside Amount, and none of
 * the three may be typed once the deal's money comes from its order.
 *
 * `Object.create` holds the server entity without metadata, as `DefaultCurrencyOnCreate.test.ts` does.
 * Only what the methods under test touch is shadowed.
 */

const ORDER_HEADER_ENTITY = 'MJ_BizApps_Orders: Order Headers';
const DEAL_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORDER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

type Row = { TotalGross: number | null; RecurringMonthlyTotal?: number | null; RecurringAnnualTotal?: number | null };

type Opts = {
    /** Order Headers fields the host's metadata lists. */
    orderFields?: string[];
    row?: Row;
    values?: Record<string, unknown>;
    oldValues?: Record<string, unknown>;
    dirty?: string[];
    isSaved?: boolean;
};

type Harness = {
    refreshAmountFromOrder(): Promise<void>;
    orderPricedEditRefusal(): string | null;
};

function deal(opts: Opts = {}) {
    const values: Record<string, unknown> = {
        ID: DEAL_ID, OrderID: ORDER_ID, Amount: null, AmountIsComputed: false, AmountSourceHash: null,
        MRR: null, ARR: null, ...(opts.values ?? {}),
    };
    const oldValues = opts.oldValues ?? {};
    const dirty = new Set(opts.dirty ?? []);
    const requested: string[][] = [];
    const statements: { sql: string; params: Record<string, unknown> }[] = [];

    const instance = Object.create(DealEntityServer.prototype) as Harness;
    for (const name of ['ID', 'OrderID', 'Amount', 'AmountIsComputed', 'AmountComputedAt', 'AmountSourceHash']) {
        Object.defineProperty(instance, name, {
            get: () => values[name],
            set: (v: unknown) => { values[name] = v; },
            configurable: true,
        });
    }
    Object.defineProperty(instance, 'IsSaved', { value: opts.isSaved ?? true });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: {} });
    Object.defineProperty(instance, '_orderStatusWarnings', { value: [] });
    Object.defineProperty(instance, 'Get', { value: (name: string) => values[name] ?? null });
    Object.defineProperty(instance, 'Set', { value: (name: string, v: unknown) => { values[name] = v; } });
    Object.defineProperty(instance, 'GetFieldByName', {
        value: (name: string) => ({
            Dirty: dirty.has(name),
            OldValue: name in oldValues ? oldValues[name] : values[name],
            ResetOldValue: () => dirty.delete(name),
        }),
    });
    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            Entities: [{ Name: ORDER_HEADER_ENTITY, Fields: (opts.orderFields ?? ['TotalGross']).map((Name) => ({ Name })) }],
            RunView: async (params: { Fields: string[] }) => {
                requested.push(params.Fields);
                return { Success: true, Results: opts.row ? [opts.row] : [] };
            },
            ExecuteSQL: async (sql: string, params: Record<string, unknown>) => {
                statements.push({ sql, params });
                return [];
            },
        },
    });
    return { instance, values, requested, statements };
}

const RECURRING = ['TotalGross', 'RecurringMonthlyTotal', 'RecurringAnnualTotal'];

describe('copying MRR and ARR from the order', () => {
    it('asks for the recurring totals only when the host has them', async () => {
        const old = deal({ row: { TotalGross: 100 } });
        await old.instance.refreshAmountFromOrder();
        expect(old.requested[0]).toEqual(['TotalGross']);

        const current = deal({ orderFields: RECURRING, row: { TotalGross: 100, RecurringMonthlyTotal: 50, RecurringAnnualTotal: 600 } });
        await current.instance.refreshAmountFromOrder();
        expect(current.requested[0]).toEqual(RECURRING);
    });

    it('writes MRR and ARR with Amount, as orders states them', async () => {
        const d = deal({ orderFields: RECURRING, row: { TotalGross: 1200, RecurringMonthlyTotal: 50, RecurringAnnualTotal: 600 } });
        await d.instance.refreshAmountFromOrder();

        expect(d.statements).toHaveLength(1);
        expect(d.statements[0].sql).toContain('MRR = @MRR');
        expect(d.statements[0].sql).toContain('ARR = @ARR');
        expect(d.statements[0].params).toMatchObject({ amount: 1200, MRR: 50, ARR: 600 });
        expect(d.values).toMatchObject({ Amount: 1200, MRR: 50, ARR: 600, AmountIsComputed: true });
    });

    it('copies a zero for an order with no subscription lines', async () => {
        const d = deal({ orderFields: RECURRING, row: { TotalGross: 900, RecurringMonthlyTotal: 0, RecurringAnnualTotal: 0 } });
        await d.instance.refreshAmountFromOrder();
        expect(d.statements[0].params).toMatchObject({ MRR: 0, ARR: 0 });
    });

    it('leaves MRR and ARR alone on a host whose orders release has no recurring totals', async () => {
        const d = deal({ row: { TotalGross: 1200 }, values: { MRR: 75, ARR: 900 } });
        await d.instance.refreshAmountFromOrder();
        expect(d.statements[0].sql).not.toContain('MRR');
        expect(d.values).toMatchObject({ Amount: 1200, MRR: 75, ARR: 900 });
    });

    it('rewrites a current Amount when MRR or ARR has not caught up', async () => {
        const d = deal({ orderFields: RECURRING, row: { TotalGross: 1200, RecurringMonthlyTotal: 50, RecurringAnnualTotal: 600 } });
        await d.instance.refreshAmountFromOrder();
        const hash = d.values.AmountSourceHash;
        const again = deal({
            orderFields: RECURRING,
            row: { TotalGross: 1200, RecurringMonthlyTotal: 50, RecurringAnnualTotal: 600 },
            values: { Amount: 1200, AmountIsComputed: true, AmountSourceHash: hash, MRR: null, ARR: null },
        });
        await again.instance.refreshAmountFromOrder();
        expect(again.statements).toHaveLength(1);

        const current = deal({
            orderFields: RECURRING,
            row: { TotalGross: 1200, RecurringMonthlyTotal: 50, RecurringAnnualTotal: 600 },
            values: { Amount: 1200, AmountIsComputed: true, AmountSourceHash: hash, MRR: 50, ARR: 600 },
        });
        await current.instance.refreshAmountFromOrder();
        expect(current.statements).toHaveLength(0);
    });
});

describe('typing Amount, MRR or ARR', () => {
    it('is refused on a deal whose saved row says its money comes from the order', () => {
        const d = deal({ dirty: ['MRR'], oldValues: { AmountIsComputed: true } });
        expect(d.instance.orderPricedEditRefusal()).toMatch(/cannot be typed on a deal with products/);
    });

    it('is allowed on a deal without products', () => {
        const d = deal({ dirty: ['Amount', 'MRR', 'ARR'], oldValues: { AmountIsComputed: false } });
        expect(d.instance.orderPricedEditRefusal()).toBeNull();
    });

    it('reads the SAVED flag, so a typed deal can take its first products in the same save', () => {
        const d = deal({ dirty: ['Amount'], oldValues: { AmountIsComputed: false }, values: { AmountIsComputed: true } });
        expect(d.instance.orderPricedEditRefusal()).toBeNull();
    });

    it('is allowed on a new deal', () => {
        const d = deal({ dirty: ['Amount'], isSaved: false, oldValues: { AmountIsComputed: true } });
        expect(d.instance.orderPricedEditRefusal()).toBeNull();
    });

    it('does not refuse a save that leaves the three alone', () => {
        const d = deal({ dirty: ['Description'], oldValues: { AmountIsComputed: true } });
        expect(d.instance.orderPricedEditRefusal()).toBeNull();
    });
});
