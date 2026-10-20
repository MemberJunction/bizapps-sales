import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';

/**
 * "Sales cycle" counts from the BUSINESS day the deal was created to the business day it closed
 * (bc-aidp-next-golive#168).
 *
 * `ActualCloseDate` is stamped on the business day. `__mj_CreatedAt` is an instant, and the label used
 * to take its UTC day — which, from the evening on in Central (6 PM in standard time, 7 PM in daylight
 * time), is already tomorrow. So a deal created and closed on the same Central evening read "—" (a
 * negative cycle), and any deal created in the evening read a day short.
 *
 * THE INSTANTS ARE PINNED TO THE EVENING, west of Greenwich, because that is the only window where the
 * two days differ; a daytime fixture would pass through the defect. Both daylight and standard time
 * are covered because the UTC rollover is an hour apart in them.
 *
 * Real `MJSDealOverviewPanel` through `Object.create`, like deal-overview-closed.test.ts.
 */
const BUSINESS_ZONE = 'America/Chicago';
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

/** A `DATE` column's value, as the driver delivers it: UTC midnight of the day. */
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const closedDeal = (createdAt: string, over: Partial<Record<string, unknown>> = {}) =>
    ({
        IsSaved: true,
        CompanyID: COMPANY,
        ExpectedCloseDate: null,
        ActualCloseDate: null,
        ClosedAt: null,
        Get: (f: string) => (f === '__mj_CreatedAt' ? new Date(createdAt) : null),
        ...over,
    }) as unknown as DealEntity;

const overviewWith = (record: DealEntity) => {
    const panel = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    return panel;
};

describe('SalesCycleLabel measures business day to business day', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const inChicago = () =>
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Resolve').mockReturnValue(BUSINESS_ZONE);

    it('is "0 days" for a deal created and closed on the same Central evening', () => {
        inChicago();
        // Created 8 PM CDT 30 Sep (01:00Z on 1 Oct); closed 9:30 PM CDT, so ActualCloseDate is 30 Sep.
        const panel = overviewWith(
            closedDeal('2026-10-01T01:00:00.000Z', {
                ClosedAt: new Date('2026-10-01T02:30:00.000Z'),
                ActualCloseDate: day('2026-09-30'),
            }),
        );
        expect(panel.SalesCycleLabel).toBe('0 days');
    });

    it('counts a full five days for a deal created on a daylight-time evening', () => {
        inChicago();
        // Created 8:30 PM CDT 25 Sep (01:30Z on 26 Sep); closed 30 Sep.
        const panel = overviewWith(
            closedDeal('2026-09-26T01:30:00.000Z', { ActualCloseDate: day('2026-09-30') }),
        );
        expect(panel.SalesCycleLabel).toBe('5 days');
    });

    it('counts a full three days for a deal created at 6:30 PM in standard time', () => {
        inChicago();
        // Created 6:30 PM CST 30 Nov (00:30Z on 1 Dec); closed 3 Dec.
        const panel = overviewWith(
            closedDeal('2026-12-01T00:30:00.000Z', { ActualCloseDate: day('2026-12-03') }),
        );
        expect(panel.SalesCycleLabel).toBe('3 days');
    });

    it('takes a legacy row\'s ClosedAt on the business day too, when ActualCloseDate is absent', () => {
        inChicago();
        // Created 10 AM CDT 30 Sep; ClosedAt 9:30 PM CDT the same day (UTC day 1 Oct).
        const panel = overviewWith(
            closedDeal('2026-09-30T15:00:00.000Z', { ClosedAt: new Date('2026-10-01T02:30:00.000Z') }),
        );
        expect(panel.SalesCycleLabel).toBe('0 days');
    });

    it("asks for the deal's own company's zone", () => {
        const resolve = inChicago();
        overviewWith(closedDeal('2026-10-01T01:00:00.000Z', { ActualCloseDate: day('2026-09-30') })).SalesCycleLabel;
        expect(resolve).toHaveBeenCalledWith(COMPANY);
    });

    /** The premise (CLAUDE.md rule 8): with the zone at UTC the same instants give the UTC answer. */
    it('premise: in UTC the evening-created deal reads one day shorter', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Resolve').mockReturnValue('UTC');
        const panel = overviewWith(
            closedDeal('2026-09-26T01:30:00.000Z', { ActualCloseDate: day('2026-09-30') }),
        );
        expect(panel.SalesCycleLabel).toBe('4 days');
    });
});
