import { describe, expect, it } from 'vitest';

import { BookSlippedCount } from '../lib/pages/dashboard-inspect';
import { RosterRow } from './helpers/roster-row';

/**
 * THE RAIL BADGE COUNTS THE WHOLE BOOK, WHATEVER THE DASHBOARD'S FILTER BAR HOLDS.
 *
 * The badge sits outside the dashboard, so narrowing the dashboard to one owner must not change it.
 */

const slipped = (o: Parameters<typeof RosterRow>[0] = {}) =>
    RosterRow({ IsOpen: true, IsPastExpectedClose: true, PipelineIncludeInForecast: true, ...o });

const book = [
    slipped({ ID: 'a' }),
    slipped({ ID: 'b' }),
    slipped({ ID: 'historical', PipelineIncludeInForecast: false }),
    RosterRow({ ID: 'on-time', IsOpen: true, IsPastExpectedClose: false, PipelineIncludeInForecast: true }),
];

describe('BookSlippedCount', () => {
    it("uses the summary's count when no filter is set", () => {
        expect(BookSlippedCount(book, 7, false)).toBe(7);
    });

    it('ignores the narrowed summary and counts the board roster when a filter is set', () => {
        expect(BookSlippedCount(book, 1, true)).toBe(2);
    });

    it('counts the board roster when the summary did not run', () => {
        expect(BookSlippedCount(book, null, false)).toBe(2);
    });

    it('leaves out open deals in pipelines kept out of the forecast, as the summary does', () => {
        expect(BookSlippedCount([slipped({ PipelineIncludeInForecast: false })], null, true)).toBe(0);
    });
});
