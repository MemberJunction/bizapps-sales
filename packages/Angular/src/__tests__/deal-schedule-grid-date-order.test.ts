import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { RunViewParams } from '@memberjunction/core';
import { MJSDealSchedulePanel, SCHEDULE_DATE_ORDER } from '../lib/form-panels/deal-form.panels';

/**
 * THE PAYMENT SCHEDULE GRID LISTS INSTALMENTS BY DATE (bizapps-sales#314).
 *
 * The relationship params carry no sort, and with none the grid sends no ORDER BY, so instalments
 * came back in storage order. The panel adds the sort; these pin that it does, that it keeps the
 * relationship filter, and that it leaves alone the two cases where it has nothing to sort.
 */

type Panel = { ScheduleParams: RunViewParams };

function panel(built: RunViewParams) {
    const asked: Array<[string, string | undefined]> = [];
    const p = Object.create(MJSDealSchedulePanel.prototype) as Panel;
    Object.defineProperty(p, 'Entity', { value: 'MJ_BizApps_Sales: Deal Payment Schedules' });
    Object.defineProperty(p, 'FormComponent', {
        value: {
            BuildRelationshipViewParamsByEntityName: (entity: string, joinField?: string) => {
                asked.push([entity, joinField]);
                return { ...built };
            },
        },
    });
    return { p, asked };
}

describe('the deal Payment schedule grid', () => {
    it('sorts by payment date, then Display Order within a date', () => {
        const { p } = panel({ EntityName: 'MJ_BizApps_Sales: Deal Payment Schedules', ExtraFilter: "[DealID] = 'deal-1'" });
        expect(p.ScheduleParams.OrderBy).toBe(SCHEDULE_DATE_ORDER);
        expect(SCHEDULE_DATE_ORDER).toMatch(/PaymentDate ASC, DisplayOrder ASC$/);
    });

    it('puts undated instalments first explicitly, not by NULL placement', () => {
        // SQL Server sorts NULL first ascending and PostgreSQL last; only an explicit key agrees on both.
        expect(SCHEDULE_DATE_ORDER.startsWith('CASE WHEN PaymentDate IS NULL THEN 0 ELSE 1 END,')).toBe(true);
    });

    it('keeps the relationship filter, so the grid still shows only this deal', () => {
        const { p, asked } = panel({ EntityName: 'MJ_BizApps_Sales: Deal Payment Schedules', ExtraFilter: "[DealID] = 'deal-1'" });
        const params = p.ScheduleParams;
        expect(params.ExtraFilter).toBe("[DealID] = 'deal-1'");
        expect(params.EntityName).toBe('MJ_BizApps_Sales: Deal Payment Schedules');
        expect(asked).toEqual([['MJ_BizApps_Sales: Deal Payment Schedules', 'DealID']]);
    });

    it('adds no sort when no relationship was found', () => {
        // An OrderBy on its own would hand the grid params that name no entity to sort.
        const { p } = panel({});
        expect(p.ScheduleParams).toEqual({});
    });

    it('leaves a saved view to its own sort', () => {
        const { p } = panel({ ViewID: 'view-1', ExtraFilter: "[DealID] = 'deal-1'" });
        expect(p.ScheduleParams.OrderBy).toBeUndefined();
    });
});
