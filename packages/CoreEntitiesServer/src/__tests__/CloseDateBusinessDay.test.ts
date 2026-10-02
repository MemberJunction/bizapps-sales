/**
 * A close stamps the BUSINESS day it happened on, not the UTC day (bc-aidp-next-golive#168).
 *
 * `stampClose` used to build `ActualCloseDate` from `now`'s UTC parts. `ActualCloseDate` is a `DATE` —
 * the day a win lands in, which is what bookings, win rate and every period window key on — and "what
 * day is it" is the one question the business zone answers. From 19:00 Central the UTC day is already
 * tomorrow, so a deal won on the evening of 30 September was stamped 1 October and counted in
 * October's figures.
 *
 * THE PINNED INSTANT IS WEST OF GREENWICH: `2026-10-01T02:30:00Z` is 21:30 on 30 September in
 * America/Chicago, and the last evening of a month, which is where the wrong day also moves the win
 * into the wrong period. An instant where the zones agree would leave this file green through the
 * defect it exists for.
 *
 * `Object.create` holds the operation without standing up metadata, the same way `AbsentStatusLock`
 * holds the entity. `stampClose` is synchronous and touches only the deal it is handed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { CloseDealOperation } from '../CloseDealOperation.js';

const BUSINESS_ZONE = 'America/Chicago';
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

/** 21:30 on 30 September in Chicago; already 1 October in UTC. */
const EVENING_ON_MONTH_END = new Date('2026-10-01T02:30:00.000Z');

/** The slice of the deal `stampClose` writes, plus the two things it reads. */
interface StampedDeal {
    CompanyID: string;
    DealStatusTypeID: string | null;
    PipelineStageID: string | null;
    LossReasonID: string | null;
    LossNotes: string | null;
    ClosedAt: Date | null;
    ClosedByUserID: string | null;
    ActualCloseDate: Date | null;
    DeclareTransition(kind: string, note: string): void;
}

type Stamp = {
    stampClose(
        deal: StampedDeal,
        input: { DealID: string; DealStatusTypeID: string },
        target: { ID: string },
        routing: never[],
        user: { ID: string },
        derivedClosingStageID: string | null,
        lossReasonName: string | null,
    ): void;
};

function close(): StampedDeal {
    const deal: StampedDeal = {
        CompanyID: COMPANY,
        DealStatusTypeID: null,
        PipelineStageID: null,
        LossReasonID: null,
        LossNotes: null,
        ClosedAt: null,
        ClosedByUserID: null,
        ActualCloseDate: null,
        DeclareTransition: () => undefined,
    };
    const op = Object.create(CloseDealOperation.prototype) as Stamp;
    op.stampClose(deal, { DealID: 'd1', DealStatusTypeID: 'won' }, { ID: 'won' }, [], { ID: 'u1' }, null, null);
    return deal;
}

describe('stampClose stamps ActualCloseDate on the business day', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(EVENING_ON_MONTH_END);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('is 30 SEPTEMBER at 9:30 PM Central, though UTC has already rolled to 1 October', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);

        const deal = close();

        expect(deal.ActualCloseDate?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    });

    /**
     * The premise, asserted rather than assumed — CLAUDE.md rule 8. Unconfigured, the engine fails open
     * to UTC; if that ever stopped being so, the test above could pass while proving nothing.
     */
    it('is 1 October at the same instant when the zone is UTC, which was the old behaviour everywhere', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue('UTC');

        expect(close().ActualCloseDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it("asks for the deal's own company, so a per-company zone needs no change here when it lands", () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
        const today = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Today');

        close();

        expect(today).toHaveBeenCalledWith(COMPANY);
    });

    /**
     * The DAY moves to the business zone; the shape does not. A `DATE` round-trips as UTC midnight and
     * every reader takes its UTC parts, so the instant 30 September began in Chicago
     * (`2026-09-30T05:00:00Z`) would be the wrong value even though it is "the right day".
     */
    it('stores UTC midnight of that day, and leaves ClosedAt as the real instant', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);

        const deal = close();

        expect(deal.ActualCloseDate?.getUTCHours()).toBe(0);
        expect(deal.ClosedAt?.toISOString()).toBe(EVENING_ON_MONTH_END.toISOString());
    });
});
