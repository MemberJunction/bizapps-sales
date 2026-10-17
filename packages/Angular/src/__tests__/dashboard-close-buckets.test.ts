/**
 * @fileoverview The close-date buckets cover every open deal: each one lands in exactly one bucket.
 *
 * Later used to start after the end of NEXT month while Rest of month stopped at the end of this one,
 * so a deal due next month was counted nowhere.
 */
import { describe, expect, it } from 'vitest';

import { CloseBuckets, FilterInspect } from '../lib/pages/dashboard-inspect';
import { RosterRow } from './helpers/roster-row';

const open = (ID: string, ExpectedCloseDate: string | null, Amount = 10) =>
    RosterRow({ ID, IsOpen: true, ExpectedCloseDate, Amount });

describe('CloseBuckets', () => {
    it('puts a deal due next month in Later', () => {
        const rows = [open('next-month', '2026-11-14')];
        expect(FilterInspect(rows, 'later', '2026-10-10').map((d) => d.ID)).toEqual(['next-month']);
    });

    it('near month end, a deal due just after the week lands in Later', () => {
        // On 28 Oct the week runs to 4 Nov, so Rest of month is empty and Later starts after the week.
        const rows = [open('in-week', '2026-11-03'), open('after-week', '2026-11-05')];
        expect(FilterInspect(rows, 'month', '2026-10-28')).toEqual([]);
        expect(FilterInspect(rows, 'week', '2026-10-28').map((d) => d.ID)).toEqual(['in-week']);
        expect(FilterInspect(rows, 'later', '2026-10-28').map((d) => d.ID)).toEqual(['after-week']);
    });

    it('counts every open deal exactly once', () => {
        const dates = ['2026-10-01', '2026-10-10', '2026-10-17', '2026-10-31', '2026-11-30', '2027-03-01', null];
        for (const today of ['2026-10-10', '2026-10-28', '2026-12-30']) {
            // The server flags a deal past its close date; the fixture does the same for each day.
            const rows = [
                ...dates.map((date, i) => RosterRow({
                    ID: `d${i}`, IsOpen: true, ExpectedCloseDate: date, Amount: 10,
                    IsPastExpectedClose: date !== null && date < today,
                })),
                RosterRow({ ID: 'won', IsWon: true, ExpectedCloseDate: '2026-11-15', Amount: 10 }),
            ];
            const buckets = CloseBuckets(rows, today);
            const ids = buckets.flatMap((b) => FilterInspect(rows, b.Key, today).map((d) => d.ID));
            expect(new Set(ids).size).toBe(ids.length);
            expect(buckets.reduce((n, b) => n + b.Count, 0)).toBe(rows.filter((d) => d.IsOpen).length);
        }
    });
});
