import '@angular/compiler';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';

/**
 * A legacy deal that carries only `ClosedAt` shows ONE close day everywhere (bc-aidp-next-golive#168).
 *
 * `ClosedAt` is an instant. The overview's sales cycle and close variance already read it on the
 * BUSINESS day (`closeDay`), but the close-date labels — the Timing row, the close tile and the hero's
 * "Closed" stat — formatted the same instant by its UTC day. A deal closed at 9:30 PM CDT on 30 September
 * (02:30Z on 1 October) then read "Closed Oct 1" beside "on time" and "0 days", both counted from 30
 * September: one screen, two days.
 *
 * THE INSTANT IS AN EVENING ONE, west of Greenwich, because that is the only window where the UTC day and
 * the business day differ; a daytime fixture passes through the defect. Each case also runs under three
 * VIEWER zones, because the labels format with `timeZone: 'UTC'` and must not depend on the browser.
 *
 * `CloseVariance` is covered here as well: reverting it to the raw `ActualCloseDate ?? ClosedAt` used to
 * leave the whole suite green (the adversarial review's mutation run on #154).
 */
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

/** A `DATE` column's value, as the driver delivers it: UTC midnight of the day. */
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Closed 9:30 PM CDT 30 Sep = 11:30 AM JST 1 Oct = 3:30 PM NZDT 1 Oct. Expected to close 30 Sep. */
const legacyRow = () =>
    ({
        IsSaved: true,
        CompanyID: COMPANY,
        ExpectedCloseDate: day('2026-09-30'),
        ActualCloseDate: null,
        ClosedAt: new Date('2026-10-01T02:30:00.000Z'),
        Get: (f: string) => (f === '__mj_CreatedAt' ? new Date('2026-09-30T15:00:00.000Z') : null),
    }) as unknown as DealEntity;

function withRecord<T extends object>(proto: T, record: DealEntity): T {
    const panel = Object.create(proto) as T;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    return panel;
}

const overview = (r: DealEntity) => withRecord(MJSDealOverviewPanel.prototype, r) as MJSDealOverviewPanel;
const hero = (r: DealEntity) => withRecord(MJSDealHeroPanel.prototype, r) as MJSDealHeroPanel;

/** What `DateLabel` prints for a calendar day, in this runtime's default locale. */
const label = (iso: string): string =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });

describe('a ClosedAt-only deal shows the business close day in every label', () => {
    const originalTZ = process.env.TZ;
    afterEach(() => {
        vi.restoreAllMocks();
    });
    afterAll(() => {
        // Assigning undefined would store the STRING "undefined"; delete restores "no zone set".
        if (originalTZ === undefined) delete process.env.TZ;
        else process.env.TZ = originalTZ;
    });

    const cases: Array<{ zone: string; closeDay: string; variance: string }> = [
        { zone: 'America/Chicago', closeDay: '2026-09-30', variance: 'on time' },
        { zone: 'Asia/Tokyo', closeDay: '2026-10-01', variance: '1 day late' },
        { zone: 'Pacific/Auckland', closeDay: '2026-10-01', variance: '1 day late' },
    ];

    for (const viewer of ['America/Chicago', 'Asia/Tokyo', 'Pacific/Auckland']) {
        for (const { zone, closeDay, variance } of cases) {
            it(`business zone ${zone}, viewer ${viewer}: every label names ${closeDay}`, () => {
                process.env.TZ = viewer;
                const resolve = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Resolve').mockReturnValue(zone);
                const o = overview(legacyRow());
                const h = hero(legacyRow());

                expect(o.CloseVariance).toBe(variance);
                expect(o.ClosedDateLabel).toBe(label(closeDay));
                expect(o.CloseClock.label).toBe(label(closeDay));
                expect(h.CloseStatValue).toBe(label(closeDay));
                expect(resolve).toHaveBeenCalledWith(COMPANY);
            });
        }
    }

    it('premise: the evening instant\'s UTC day is the 1st, so the Chicago case is not vacuous', () => {
        expect(legacyRow().ClosedAt!.toISOString().slice(0, 10)).toBe('2026-10-01');
    });

    it('a stamped ActualCloseDate is shown as stored, without asking for a zone', () => {
        const resolve = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Resolve').mockReturnValue('Asia/Tokyo');
        const r = { ...legacyRow(), ActualCloseDate: day('2026-09-30') } as unknown as DealEntity;
        expect(overview(r).ClosedDateLabel).toBe(label('2026-09-30'));
        expect(hero(r).CloseStatValue).toBe(label('2026-09-30'));
        expect(overview(r).CloseVariance).toBe('on time');
        expect(resolve).not.toHaveBeenCalled();
    });
});
