/**
 * Audience selection for the Lapsed Close Date Digest: which deals reach which recipient, and how they
 * are grouped. This is the pure core; Task 7 owns the query and the open-deal filter.
 *
 * THE DST CASE IS PINNED ACROSS THE US FALL-BACK. 25 Oct to 8 Nov 2026 spans 1 Nov, when a local day is
 * 25 hours long. Subtracting two local-midnight Dates there gives 14.04 days, and a floor or a round
 * then decides whether the answer is 14 by luck. `ComputeDaysLapsed` works on UTC-midnight instants, so
 * the difference is exactly 14 whatever zone the process runs in. The test sets TZ to a zone that
 * observes the change so that it fails against a naive local-time implementation instead of passing
 * only on a machine that happens to run in UTC.
 *
 * THE MinDaysLapsed BOUNDARY IS PINNED ON BOTH SIDES. The floor is strict (`>`): at 14 a deal is
 * excluded, at 15 it is kept. A test that only checked 15 would stay green if the code used `>=`.
 *
 * A never-set close date has no day count, so it can only be judged by IncludeMissingCloseDate, never by
 * the floor. The tests pass `null` explicitly because the compiler does not enforce null handling here
 * (`strict` is off).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import {
    ComputeDaysLapsed,
    SelectForAudience,
    type DigestAudience,
    type LapsedDeal,
} from '../digest/audience.js';

/** Put the process zone back; assigning undefined would store the string "undefined". */
function restoreTZ(original: string | undefined): void {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
}

const MIRA = 'cccccccc-0000-4000-8000-000000000001';
const SIGNAL = 'cccccccc-0000-4000-8000-000000000002';
const TERRA = 'cccccccc-0000-4000-8000-000000000003';

function audience(overrides: Partial<DigestAudience> = {}): DigestAudience {
    return {
        ID: 'aaaaaaaa-0000-4000-8000-000000000001', Code: 'TEST', Name: 'Test',
        IsPortfolioWide: true, MinDaysLapsed: null, IncludeMissingCloseDate: true,
        SendWhenEmpty: false, GroupByCompany: true,
        SubjectTemplate: null, IntroTemplate: null, EmptyMessage: null, DisplayRank: 10,
        ...overrides,
    };
}

let seq = 0;
function deal(companyID: string, companyName: string, daysLapsed: number | null, name?: string): LapsedDeal {
    seq += 1;
    return {
        ID: `dddddddd-0000-4000-8000-${String(seq).padStart(12, '0')}`,
        Name: name ?? `Deal ${seq}`, CompanyID: companyID, CompanyName: companyName,
        OwnerName: 'Owner', Amount: null, CurrencyID: null,
        ExpectedCloseDate: daysLapsed === null ? null : ToCalendarDay('2026-10-01')!,
        DaysLapsed: daysLapsed, StageName: 'Stage',
    };
}

describe('ComputeDaysLapsed', () => {
    const originalTZ = process.env.TZ;
    afterEach(() => restoreTZ(originalTZ));

    it('returns null when the close date was never set', () => {
        expect(ComputeDaysLapsed(null, ToCalendarDay('2026-11-23')!)).toBeNull();
    });
    it('returns 0 for a deal closing today — today is not lapsed', () => {
        expect(ComputeDaysLapsed(ToCalendarDay('2026-11-23')!, ToCalendarDay('2026-11-23')!)).toBe(0);
    });
    it('counts whole days across a DST transition exactly', () => {
        // 1 Nov 2026 is the US DST fall-back; a naive local-time subtraction gives 14.04 days.
        process.env.TZ = 'America/Chicago';
        expect(ComputeDaysLapsed(ToCalendarDay('2026-10-25')!, ToCalendarDay('2026-11-08')!)).toBe(14);
    });
    it('clamps a close date in the future at 0', () => {
        expect(ComputeDaysLapsed(ToCalendarDay('2026-11-30')!, ToCalendarDay('2026-11-23')!)).toBe(0);
    });
});

describe('SelectForAudience', () => {
    it('keeps only the recipient company when the audience is not portfolio-wide', () => {
        const deals = [deal(MIRA, 'Mira', 3), deal(SIGNAL, 'signal.example', 3)];
        const groups = SelectForAudience(deals, audience({ IsPortfolioWide: false }), MIRA);
        expect(groups).toHaveLength(1);
        expect(groups[0].CompanyID).toBe(MIRA);
        expect(groups[0].Deals).toEqual([deals[0]]);
    });
    it('returns no deals for a company audience with no recipient company', () => {
        const groups = SelectForAudience([deal(MIRA, 'Mira', 3)], audience({ IsPortfolioWide: false }), null);
        expect(groups).toEqual([]);
    });
    it('returns every company when the audience is portfolio-wide', () => {
        const deals = [deal(TERRA, 'Terra Labs', 3), deal(MIRA, 'Mira', 3), deal(MIRA, 'Mira', 5)];
        const groups = SelectForAudience(deals, audience({ IsPortfolioWide: true }), null);
        expect(groups.map(g => g.CompanyName)).toEqual(['Mira', 'Terra Labs']);
        expect(groups[0].Deals).toHaveLength(2);
        expect(groups[1].Deals).toHaveLength(1);
    });
    it('applies MinDaysLapsed as a strict floor', () => {
        const at14 = deal(MIRA, 'Mira', 14, 'at floor');
        const at15 = deal(MIRA, 'Mira', 15, 'past floor');
        const groups = SelectForAudience([at14, at15], audience({ MinDaysLapsed: 14 }), null);
        expect(groups).toHaveLength(1);
        expect(groups[0].Deals.map(d => d.Name)).toEqual(['past floor']);
    });
    it('keeps never-set close dates regardless of MinDaysLapsed when IncludeMissingCloseDate', () => {
        const never = deal(MIRA, 'Mira', null, 'never set');
        const groups = SelectForAudience([never], audience({ MinDaysLapsed: 14, IncludeMissingCloseDate: true }), null);
        expect(groups).toHaveLength(1);
        expect(groups[0].Deals).toEqual([never]);
    });
    it('drops never-set close dates when IncludeMissingCloseDate is false', () => {
        const groups = SelectForAudience(
            [deal(MIRA, 'Mira', null)], audience({ MinDaysLapsed: null, IncludeMissingCloseDate: false }), null);
        expect(groups).toEqual([]);
    });
    it('applies no floor when MinDaysLapsed is null', () => {
        const groups = SelectForAudience([deal(MIRA, 'Mira', 1)], audience({ MinDaysLapsed: null }), null);
        expect(groups).toHaveLength(1);
    });
    it('sorts groups by company name, case-insensitively', () => {
        const deals = [deal(TERRA, 'Terra Labs', 3), deal(SIGNAL, 'signal.example', 3), deal(MIRA, 'Mira', 3)];
        const groups = SelectForAudience(deals, audience(), null);
        expect(groups.map(g => g.CompanyName)).toEqual(['Mira', 'signal.example', 'Terra Labs']);
    });
});
