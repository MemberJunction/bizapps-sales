import { describe, expect, it, vi } from 'vitest';
import { DealPaymentScheduleEntity } from '@mj-biz-apps/sales-entities';
import * as scheduleSync from '../deal-schedule-to-order.js';
import { DealPaymentScheduleEntityServer } from '../DealPaymentScheduleEntityServer.js';

describe('DealPaymentScheduleEntityServer DisplayOrder numbering (#444)', () => {
    function buildRow(opts: {
        isSaved: boolean;
        dealID: string | null;
        displayOrder: number | null;
        existingMax?: number | null;
    }) {
        const row = Object.create(DealPaymentScheduleEntityServer.prototype) as DealPaymentScheduleEntityServer;
        let currentDisplayOrder = opts.displayOrder;
        const runViewCalls: Array<Record<string, unknown>> = [];

        Object.defineProperty(row, 'IsSaved', { value: opts.isSaved, configurable: true });
        Object.defineProperty(row, 'DealID', { value: opts.dealID, configurable: true });
        Object.defineProperty(row, 'DisplayOrder', {
            get: () => currentDisplayOrder as number,
            set: (v: number) => {
                currentDisplayOrder = v;
            },
            configurable: true,
        });
        Object.defineProperty(row, 'ContextCurrentUser', { value: { ID: 'user-1' }, configurable: true });
        Object.defineProperty(row, 'Fields', { value: [], configurable: true });
        Object.defineProperty(row, 'ProviderToUse', {
            value: {
                RunView: vi.fn(async (params: Record<string, unknown>) => {
                    runViewCalls.push(params);
                    if (params.EntityName === 'MJ_BizApps_Sales: Deal Payment Schedules') {
                        return {
                            Success: true,
                            Results: opts.existingMax != null ? [{ DisplayOrder: opts.existingMax }] : [],
                        };
                    }
                    return { Success: true, Results: [{ OrderID: null, DealStatusTypeID: null }] };
                }),
            },
            configurable: true,
        });

        return { row, getDisplayOrder: () => currentDisplayOrder, runViewCalls };
    }

    it('numbers the first inserted row with DisplayOrder 0 as 1', async () => {
        const superSave = vi.spyOn(DealPaymentScheduleEntity.prototype, 'Save').mockResolvedValue(true);
        const wonSpy = vi.spyOn(scheduleSync, 'WonDealOrderID').mockResolvedValue(null);
        try {
            const { row, getDisplayOrder } = buildRow({
                isSaved: false,
                dealID: 'deal-1',
                displayOrder: 0,
                existingMax: null,
            });
            expect(await row.Save()).toBe(true);
            expect(getDisplayOrder()).toBe(1);
        } finally {
            wonSpy.mockRestore();
            superSave.mockRestore();
        }
    });

    it('numbers subsequent inserted rows with max(DisplayOrder) + 1 for the deal', async () => {
        const superSave = vi.spyOn(DealPaymentScheduleEntity.prototype, 'Save').mockResolvedValue(true);
        const wonSpy = vi.spyOn(scheduleSync, 'WonDealOrderID').mockResolvedValue(null);
        try {
            const { row, getDisplayOrder } = buildRow({
                isSaved: false,
                dealID: 'deal-1',
                displayOrder: 0,
                existingMax: 3,
            });
            expect(await row.Save()).toBe(true);
            expect(getDisplayOrder()).toBe(4);
        } finally {
            wonSpy.mockRestore();
            superSave.mockRestore();
        }
    });

    it('leaves an explicit non-zero DisplayOrder untouched on insert and update', async () => {
        const superSave = vi.spyOn(DealPaymentScheduleEntity.prototype, 'Save').mockResolvedValue(true);
        const wonSpy = vi.spyOn(scheduleSync, 'WonDealOrderID').mockResolvedValue(null);
        try {
            const { row, getDisplayOrder, runViewCalls } = buildRow({
                isSaved: false,
                dealID: 'deal-1',
                displayOrder: 7,
                existingMax: 3,
            });
            expect(await row.Save()).toBe(true);
            expect(getDisplayOrder()).toBe(7);
            expect(runViewCalls.some((c) => c.EntityName === 'MJ_BizApps_Sales: Deal Payment Schedules')).toBe(false);
        } finally {
            wonSpy.mockRestore();
            superSave.mockRestore();
        }
    });
});
